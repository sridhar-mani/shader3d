import type {
  WGSLType,
  VectorType,
  MatrixType,
  PrimitiveType,
  Program,
  FunctionDeclaration,
  VariableDeclaration,
  Expression,
  Statement,
  Diagnostic,
  StructDeclaration,
} from '../types';
import { TypeRegistry, globalRegistry } from './type-registry';
import { validateSwizzle } from './swizzle';
import {
  inferType,
  createContext,
  addVariable,
  addFunction,
  addStruct,
  InferenceContext,
} from './type-inference';

export interface TypeCheckResult {
  valid: boolean;
  diagnostics: Diagnostic[];
  typeMap: Map<Expression, WGSLType>;
}

export interface TypeCheckOptions {
  strictMode?: boolean;
  allowImplicitConversions?: boolean;
  warnOnNarrowingConversions?: boolean;
}

const DEFAULT_OPTIONS: TypeCheckOptions = {
  strictMode: false,
  allowImplicitConversions: true,
  warnOnNarrowingConversions: true,
};

export class TypeChecker {
  private registry: TypeRegistry;
  private context: InferenceContext;
  private diagnostics: Diagnostic[] = [];
  private typeMap = new Map<Expression, WGSLType>();
  private options: TypeCheckOptions;

  constructor(registry: TypeRegistry = globalRegistry, options: TypeCheckOptions = {}) {
    this.registry = registry;
    this.context = createContext();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  check(program: Program): TypeCheckResult {
    this.diagnostics = [];
    this.typeMap.clear();

    for (const struct of program.structs) {
      this.checkStruct(struct);
    }

    for (const uniform of program.uniforms) {
      addVariable(this.context, uniform.name, uniform.bindingType);
    }

    for (const stmt of program.body) {
      if (stmt.type === 'FunctionDeclaration') {
        const func = stmt as FunctionDeclaration;
        const paramTypes = func.params.map((p) => p.paramType);
        if (func.returnType) {
          addFunction(this.context, func.name, paramTypes, func.returnType);
        }
      }
    }

    for (const stmt of program.body) {
      this.checkStatement(stmt);
    }

    return {
      valid: this.diagnostics.filter((d) => d.severity === 'error').length === 0,
      diagnostics: this.diagnostics,
      typeMap: this.typeMap,
    };
  }

  private checkStruct(struct: StructDeclaration): void {
    const fields: { name: string; type: WGSLType }[] = [];

    const fieldNames = new Set<string>();
    for (const field of struct.fields) {
      if (fieldNames.has(field.name)) {
        this.error(
          `Duplicate field name '${field.name}' in struct '${struct.name}'`,
          struct.loc?.start
        );
      }
      fieldNames.add(field.name);
      fields.push({ name: field.name, type: field.fieldType });
    }

    this.registry.registerStruct(struct.name, fields);
    addStruct(this.context, struct.name, fields);
  }

  private checkStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'FunctionDeclaration':
        this.checkFunction(stmt as FunctionDeclaration);
        break;
      case 'VariableDeclaration':
        this.checkVariableDeclaration(stmt as VariableDeclaration);
        break;
      case 'BlockStatement':
        for (const s of (stmt as any).body) {
          this.checkStatement(s);
        }
        break;
      case 'ReturnStatement':
        if ((stmt as any).argument) {
          this.checkExpression((stmt as any).argument);
        }
        break;
      case 'IfStatement':
        this.checkExpression((stmt as any).test);
        this.checkStatement((stmt as any).consequent);
        if ((stmt as any).alternate) {
          this.checkStatement((stmt as any).alternate);
        }
        break;
      case 'ForStatement':
        if ((stmt as any).init) this.checkStatement((stmt as any).init);
        if ((stmt as any).test) this.checkExpression((stmt as any).test);
        if ((stmt as any).update) this.checkExpression((stmt as any).update);
        this.checkStatement((stmt as any).body);
        break;
      case 'WhileStatement':
        this.checkExpression((stmt as any).test);
        this.checkStatement((stmt as any).body);
        break;
      case 'ExpressionStatement':
        this.checkExpression((stmt as any).expression);
        break;
    }
  }

  private checkFunction(func: FunctionDeclaration): void {
    const savedVars = new Map(this.context.variables);

    for (const param of func.params) {
      addVariable(this.context, param.name, param.paramType);
    }

    const hasStageDecorator = func.decorators.some((d) =>
      ['vertex', 'fragment', 'compute'].includes(d.name)
    );

    if (hasStageDecorator) {
      this.validateEntryPoint(func);
    }

    for (const stmt of func.body.body) {
      this.checkStatement(stmt);

      if (stmt.type === 'ReturnStatement' && (stmt as any).argument && func.returnType) {
        const returnType = this.getExpressionType((stmt as any).argument);
        if (returnType && !this.typesMatch(returnType, func.returnType)) {
          this.error(
            `Return type mismatch: expected '${this.typeToString(func.returnType)}', got '${this.typeToString(returnType)}'`,
            stmt.loc?.start,
            [
              `Change return type to '${this.typeToString(returnType)}'`,
              `Convert return value to '${this.typeToString(func.returnType)}'`,
            ]
          );
        }
      }
    }

    this.context.variables = savedVars;
  }

  private validateEntryPoint(func: FunctionDeclaration): void {
    const stage = func.decorators.find((d) =>
      ['vertex', 'fragment', 'compute'].includes(d.name)
    )?.name;

    if (stage === 'vertex') {
      if (!func.returnType) {
        this.error(`Vertex shader '${func.name}' must have a return type`, func.loc?.start);
      } else if (!this.isValidVertexOutput(func.returnType)) {
        this.error(
          `Vertex shader must return vec4<f32> for position or a struct with @builtin(position)`,
          func.loc?.start
        );
      }
    }

    if (stage === 'fragment') {
      if (!func.returnType) {
        this.error(`Fragment shader '${func.name}' must have a return type`, func.loc?.start);
      } else if (!this.isValidFragmentOutput(func.returnType)) {
        this.error(
          `Fragment shader must return vec4<f32> or a struct with @location attributes`,
          func.loc?.start
        );
      }
    }

    if (stage === 'compute') {
      const workgroupSize = func.decorators.find((d) => d.name === 'workgroup_size');
      if (!workgroupSize) {
        this.warning(
          `Compute shader '${func.name}' should have @workgroup_size decorator`,
          func.loc?.start
        );
      }
    }
  }

  private isValidVertexOutput(type: WGSLType): boolean {
    if (type.kind === 'vector' && type.size === 4 && type.elementType === 'f32') {
      return true;
    }
    if (type.kind === 'struct') {
      return true;
    }
    return false;
  }

  private isValidFragmentOutput(type: WGSLType): boolean {
    if (type.kind === 'vector' && type.size === 4) {
      return true;
    }
    if (type.kind === 'struct') {
      return true;
    }
    return false;
  }

  private checkVariableDeclaration(decl: VariableDeclaration): void {
    if (decl.init) {
      const initType = this.getExpressionType(decl.init);

      if (decl.varType && initType) {
        if (!this.typesMatch(initType, decl.varType)) {
          if (
            this.options.allowImplicitConversions &&
            this.canImplicitlyConvert(initType, decl.varType)
          ) {
            if (
              this.options.warnOnNarrowingConversions &&
              this.isNarrowingConversion(initType, decl.varType)
            ) {
              this.warning(
                `Narrowing conversion from '${this.typeToString(initType)}' to '${this.typeToString(decl.varType)}'`,
                decl.loc?.start
              );
            }
          } else {
            this.error(
              `Type mismatch: cannot assign '${this.typeToString(initType)}' to '${this.typeToString(decl.varType)}'`,
              decl.loc?.start,
              [
                `Change variable type to '${this.typeToString(initType)}'`,
                `Convert value to '${this.typeToString(decl.varType)}'`,
              ]
            );
          }
        }
      }

      const finalType = decl.varType || initType;
      if (finalType) {
        addVariable(this.context, decl.name, finalType);
      }
    } else if (decl.varType) {
      addVariable(this.context, decl.name, decl.varType);
    }
  }

  private checkExpression(expr: Expression): void {
    const result = inferType(expr, this.context, this.registry);

    for (const err of result.errors) {
      this.error(err.message, err.location);
    }

    if (result.type) {
      this.typeMap.set(expr, result.type);
    }
  }

  private getExpressionType(expr: Expression): WGSLType | null {
    if (this.typeMap.has(expr)) {
      return this.typeMap.get(expr)!;
    }

    const result = inferType(expr, this.context, this.registry);
    if (result.type) {
      this.typeMap.set(expr, result.type);
    }

    for (const err of result.errors) {
      this.error(err.message, err.location);
    }

    return result.type;
  }

  private typesMatch(a: WGSLType, b: WGSLType): boolean {
    if (a.kind !== b.kind) return false;

    switch (a.kind) {
      case 'primitive':
        return a.name === (b as PrimitiveType).name;
      case 'vector':
        const bVec = b as VectorType;
        return a.size === bVec.size && a.elementType === bVec.elementType;
      case 'matrix':
        const bMat = b as MatrixType;
        return a.rows === bMat.rows && a.cols === bMat.cols && a.elementType === bMat.elementType;
      case 'struct':
        return a.name === (b as { kind: 'struct'; name: string }).name;
      case 'array':
        if (b.kind !== 'array') return false;
        if (a.size !== b.size) return false;
        return this.typesMatch(a.elementType, b.elementType);
      default:
        return false;
    }
  }

  private canImplicitlyConvert(from: WGSLType, to: WGSLType): boolean {
    if (from.kind === 'primitive' && to.kind === 'primitive') {
      if (from.name === 'i32' && to.name === 'f32') return true;
      if (from.name === 'u32' && to.name === 'f32') return true;
    }
    return false;
  }

  private isNarrowingConversion(from: WGSLType, to: WGSLType): boolean {
    if (from.kind === 'primitive' && to.kind === 'primitive') {
      if (from.name === 'f32' && to.name === 'f16') return true;
      if (from.name === 'i32' && to.name === 'u32') return true;
      if (from.name === 'f32' && (to.name === 'i32' || to.name === 'u32')) return true;
    }
    return false;
  }

  private typeToString(type: WGSLType): string {
    return this.registry.typeToString(type);
  }

  private error(
    message: string,
    location?: { line: number; column: number },
    suggestions?: string[]
  ): void {
    this.diagnostics.push({
      severity: 'error',
      message,
      loc: location ? { start: location, end: location } : undefined,
      suggestions,
    });
  }

  private warning(message: string, location?: { line: number; column: number }): void {
    this.diagnostics.push({
      severity: 'warning',
      message,
      loc: location ? { start: location, end: location } : undefined,
    });
  }
}

export function typeCheck(program: Program, options?: TypeCheckOptions): TypeCheckResult {
  const checker = new TypeChecker(globalRegistry, options);
  return checker.check(program);
}
