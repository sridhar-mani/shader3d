import type {
  WGSLType,
  VectorType,
  MatrixType,
  PrimitiveType,
  Expression,
  Identifier,
  Literal,
  BinaryExpression,
  CallExpression,
  MemberExpression,
  VariableDeclaration,
  FunctionDeclaration,
} from '../types';
import { TypeRegistry, globalRegistry } from './type-registry';
import { validateSwizzle } from './swizzle';

export interface InferenceContext {
  variables: Map<string, WGSLType>;
  functions: Map<string, { params: WGSLType[]; returnType: WGSLType }>;
  structs: Map<string, { name: string; type: WGSLType }[]>;
  typeVars: Map<string, WGSLType | null>;
  constraints: TypeConstraint[];
}

export interface TypeConstraint {
  kind: 'equal' | 'subtype' | 'numeric' | 'vector';
  left: WGSLType | string;
  right: WGSLType | string;
  location?: { line: number; column: number };
}

export interface InferenceResult {
  type: WGSLType | null;
  constraints: TypeConstraint[];
  errors: InferenceError[];
}

export interface InferenceError {
  message: string;
  location?: { line: number; column: number };
  expected?: WGSLType;
  got?: WGSLType;
}

const NUMERIC_TYPES = new Set(['f32', 'f16', 'i32', 'u32']);
const SIGNED_NUMERIC_TYPES = new Set(['f32', 'f16', 'i32']);

export function createContext(): InferenceContext {
  return {
    variables: new Map(),
    functions: new Map(),
    structs: new Map(),
    typeVars: new Map(),
    constraints: [],
  };
}

export function inferType(
  expr: Expression,
  ctx: InferenceContext,
  registry: TypeRegistry = globalRegistry
): InferenceResult {
  const errors: InferenceError[] = [];
  const constraints: TypeConstraint[] = [];

  function infer(e: Expression): WGSLType | null {
    switch (e.type) {
      case 'Literal':
        return inferLiteral(e as Literal);

      case 'Identifier':
        return inferIdentifier(e as Identifier, ctx);

      case 'BinaryExpression':
        return inferBinaryExpression(e as BinaryExpression, ctx, infer, errors, constraints);

      case 'CallExpression':
        return inferCallExpression(e as CallExpression, ctx, registry, infer, errors);

      case 'MemberExpression':
        return inferMemberExpression(e as MemberExpression, ctx, infer, errors);

      case 'UnaryExpression':
        return infer((e as any).argument);

      case 'ArrayExpression':
        return inferArrayExpression(e as any, infer, errors);

      case 'AssignmentExpression':
        return infer((e as any).right);

      default:
        return null;
    }
  }

  const type = infer(expr);
  return { type, constraints, errors };
}

function inferLiteral(lit: Literal): WGSLType {
  if (typeof lit.value === 'boolean') {
    return { kind: 'primitive', name: 'bool' };
  }

  if (typeof lit.value === 'number') {
    if (Number.isInteger(lit.value) && !lit.raw.includes('.')) {
      if (lit.raw.endsWith('u')) {
        return { kind: 'primitive', name: 'u32' };
      }
      if (lit.raw.endsWith('i')) {
        return { kind: 'primitive', name: 'i32' };
      }
      return { kind: 'primitive', name: 'i32' };
    }
    if (lit.raw.endsWith('h')) {
      return { kind: 'primitive', name: 'f16' };
    }
    return { kind: 'primitive', name: 'f32' };
  }

  return { kind: 'primitive', name: 'f32' };
}

function inferIdentifier(id: Identifier, ctx: InferenceContext): WGSLType | null {
  return ctx.variables.get(id.name) || null;
}

function inferBinaryExpression(
  expr: BinaryExpression,
  ctx: InferenceContext,
  infer: (e: Expression) => WGSLType | null,
  errors: InferenceError[],
  constraints: TypeConstraint[]
): WGSLType | null {
  const leftType = infer(expr.left);
  const rightType = infer(expr.right);

  if (!leftType || !rightType) {
    return null;
  }

  const comparisonOps = ['==', '!=', '<', '>', '<=', '>='];
  if (comparisonOps.includes(expr.operator)) {
    return { kind: 'primitive', name: 'bool' };
  }

  const logicalOps = ['&&', '||'];
  if (logicalOps.includes(expr.operator)) {
    if (leftType.kind !== 'primitive' || leftType.name !== 'bool') {
      errors.push({
        message: `Logical operator '${expr.operator}' requires bool operands`,
        expected: { kind: 'primitive', name: 'bool' },
        got: leftType,
        location: expr.loc?.start,
      });
    }
    return { kind: 'primitive', name: 'bool' };
  }

  const arithmeticOps = ['+', '-', '*', '/', '%'];
  if (arithmeticOps.includes(expr.operator)) {
    return inferArithmeticResult(leftType, rightType, expr.operator, errors, expr.loc?.start);
  }

  return leftType;
}

function inferArithmeticResult(
  left: WGSLType,
  right: WGSLType,
  operator: string,
  errors: InferenceError[],
  location?: { line: number; column: number }
): WGSLType | null {
  if (left.kind === 'primitive' && right.kind === 'primitive') {
    if (!typesCompatible(left, right)) {
      errors.push({
        message: `Cannot apply '${operator}' to incompatible types '${left.name}' and '${right.name}'`,
        expected: left,
        got: right,
        location,
      });
      return null;
    }
    return left;
  }

  if (left.kind === 'vector' && right.kind === 'primitive') {
    if (left.elementType !== right.name && !isImplicitlyConvertible(right.name, left.elementType)) {
      errors.push({
        message: `Cannot apply '${operator}' to vec${left.size}<${left.elementType}> and ${right.name}`,
        location,
      });
      return null;
    }
    return left;
  }

  if (left.kind === 'primitive' && right.kind === 'vector') {
    if (right.elementType !== left.name && !isImplicitlyConvertible(left.name, right.elementType)) {
      errors.push({
        message: `Cannot apply '${operator}' to ${left.name} and vec${right.size}<${right.elementType}>`,
        location,
      });
      return null;
    }
    return right;
  }

  if (left.kind === 'vector' && right.kind === 'vector') {
    if (left.size !== right.size || left.elementType !== right.elementType) {
      errors.push({
        message: `Cannot apply '${operator}' to vec${left.size}<${left.elementType}> and vec${right.size}<${right.elementType}>`,
        location,
      });
      return null;
    }
    return left;
  }

  if (operator === '*') {
    if (left.kind === 'matrix' && right.kind === 'vector') {
      if (left.cols !== right.size) {
        errors.push({
          message: `Matrix-vector multiplication requires mat${left.cols}x${left.rows} * vec${left.cols}, got vec${right.size}`,
          location,
        });
        return null;
      }
      return { kind: 'vector', size: left.rows, elementType: left.elementType };
    }

    if (left.kind === 'vector' && right.kind === 'matrix') {
      errors.push({
        message: `Invalid vector * matrix multiplication. Use matrix * vector instead`,
        location,
      });
      return null;
    }

    if (left.kind === 'matrix' && right.kind === 'matrix') {
      if (left.cols !== right.rows) {
        errors.push({
          message: `Matrix multiplication requires mat${left.cols}x${left.rows} * mat${right.cols}x${right.rows} where left.cols == right.rows`,
          location,
        });
        return null;
      }
      return { kind: 'matrix', rows: left.rows, cols: right.cols, elementType: left.elementType };
    }

    if (left.kind === 'matrix' && right.kind === 'primitive') {
      return left;
    }

    if (left.kind === 'primitive' && right.kind === 'matrix') {
      return right;
    }
  }

  return null;
}

function inferCallExpression(
  expr: CallExpression,
  ctx: InferenceContext,
  registry: TypeRegistry,
  infer: (e: Expression) => WGSLType | null,
  errors: InferenceError[]
): WGSLType | null {
  let funcName = '';

  if (expr.callee.type === 'Identifier') {
    funcName = (expr.callee as Identifier).name;
  } else if (expr.callee.type === 'MemberExpression') {
    const member = expr.callee as MemberExpression;
    if (member.object.type === 'Identifier' && (member.object as Identifier).name === 'Math') {
      funcName = (member.property as Identifier).name;
    }
  }

  const vectorConstructors = [
    'vec2',
    'vec3',
    'vec4',
    'vec2f',
    'vec3f',
    'vec4f',
    'vec2i',
    'vec3i',
    'vec4i',
    'vec2u',
    'vec3u',
    'vec4u',
    'vec2h',
    'vec3h',
    'vec4h',
  ];
  if (vectorConstructors.some((v) => funcName.startsWith(v))) {
    return inferVectorConstructor(funcName, expr.arguments, infer, errors, expr.loc?.start);
  }

  const matrixConstructors = /^mat(\d)x(\d)([fh])?$/;
  const matMatch = funcName.match(matrixConstructors);
  if (matMatch) {
    const cols = parseInt(matMatch[1]) as 2 | 3 | 4;
    const rows = parseInt(matMatch[2]) as 2 | 3 | 4;
    const elemType = (matMatch[3] === 'h' ? 'f16' : 'f32') as 'f32' | 'f16';
    return { kind: 'matrix', rows, cols, elementType: elemType };
  }

  const builtinResult = inferBuiltinCall(funcName, expr.arguments, infer);
  if (builtinResult) {
    return builtinResult;
  }

  const funcDef = ctx.functions.get(funcName);
  if (funcDef) {
    return funcDef.returnType;
  }

  return null;
}

function inferVectorConstructor(
  funcName: string,
  args: Expression[],
  infer: (e: Expression) => WGSLType | null,
  errors: InferenceError[],
  location?: { line: number; column: number }
): VectorType | null {
  const sizeMatch = funcName.match(/vec(\d)/);
  if (!sizeMatch) return null;

  const size = parseInt(sizeMatch[1]) as 2 | 3 | 4;
  let elemType: 'f32' | 'f16' | 'i32' | 'u32' | 'bool' = 'f32';

  if (funcName.endsWith('f')) elemType = 'f32';
  else if (funcName.endsWith('h')) elemType = 'f16';
  else if (funcName.endsWith('i')) elemType = 'i32';
  else if (funcName.endsWith('u')) elemType = 'u32';

  let componentCount = 0;
  for (const arg of args) {
    const argType = infer(arg);
    if (!argType) continue;

    if (argType.kind === 'primitive') {
      componentCount += 1;
    } else if (argType.kind === 'vector') {
      componentCount += argType.size;
    }
  }

  if (componentCount !== size && componentCount !== 1) {
    errors.push({
      message: `vec${size} constructor requires ${size} components or 1 scalar for splat, got ${componentCount}`,
      location,
    });
  }

  return { kind: 'vector', size, elementType: elemType };
}

function inferBuiltinCall(
  funcName: string,
  args: Expression[],
  infer: (e: Expression) => WGSLType | null
): WGSLType | null {
  const scalarFuncs = [
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'sinh',
    'cosh',
    'tanh',
    'exp',
    'exp2',
    'log',
    'log2',
    'sqrt',
    'inverseSqrt',
    'abs',
    'sign',
    'floor',
    'ceil',
    'round',
    'trunc',
    'fract',
    'saturate',
    'radians',
    'degrees',
  ];
  if (scalarFuncs.includes(funcName) && args.length >= 1) {
    const argType = infer(args[0]);
    if (argType) return argType;
  }

  const binaryFuncs = ['min', 'max', 'pow', 'atan2', 'step'];
  if (binaryFuncs.includes(funcName) && args.length >= 2) {
    const argType = infer(args[0]);
    if (argType) return argType;
  }

  const ternaryFuncs = ['clamp', 'mix', 'smoothstep', 'fma'];
  if (ternaryFuncs.includes(funcName) && args.length >= 3) {
    const argType = infer(args[0]);
    if (argType) return argType;
  }

  if (funcName === 'dot' && args.length === 2) {
    const argType = infer(args[0]);
    if (argType?.kind === 'vector') {
      return { kind: 'primitive', name: argType.elementType };
    }
  }

  if (funcName === 'cross' && args.length === 2) {
    const argType = infer(args[0]);
    if (argType?.kind === 'vector' && argType.size === 3) {
      return argType;
    }
  }

  if (funcName === 'length' && args.length === 1) {
    const argType = infer(args[0]);
    if (argType?.kind === 'vector') {
      return { kind: 'primitive', name: argType.elementType };
    }
  }

  if (funcName === 'distance' && args.length === 2) {
    const argType = infer(args[0]);
    if (argType?.kind === 'vector') {
      return { kind: 'primitive', name: argType.elementType };
    }
  }

  if (funcName === 'normalize' && args.length === 1) {
    return infer(args[0]);
  }

  if (funcName === 'reflect' && args.length === 2) {
    return infer(args[0]);
  }

  if (funcName === 'refract' && args.length === 3) {
    return infer(args[0]);
  }

  return null;
}

function inferMemberExpression(
  expr: MemberExpression,
  ctx: InferenceContext,
  infer: (e: Expression) => WGSLType | null,
  errors: InferenceError[]
): WGSLType | null {
  const objType = infer(expr.object);
  if (!objType) return null;

  if (objType.kind === 'vector' && !expr.computed) {
    const propName = (expr.property as Identifier).name;
    const swizzleResult = validateSwizzle(objType, propName);

    if (!swizzleResult.valid) {
      errors.push({
        message: swizzleResult.error || `Invalid swizzle '${propName}' for vec${objType.size}`,
        location: expr.loc?.start,
      });
      return null;
    }

    return swizzleResult.resultType;
  }

  if (objType.kind === 'struct') {
    const propName = (expr.property as Identifier).name;
    const fields = ctx.structs.get(objType.name);
    if (fields) {
      const field = fields.find((f) => f.name === propName);
      if (field) {
        return field.type;
      }
      errors.push({
        message: `Struct '${objType.name}' has no field '${propName}'`,
        location: expr.loc?.start,
      });
    }
    return null;
  }

  if (objType.kind === 'array' && expr.computed) {
    return objType.elementType;
  }

  return null;
}

function inferArrayExpression(
  expr: { elements: Expression[] },
  infer: (e: Expression) => WGSLType | null,
  errors: InferenceError[]
): WGSLType | null {
  if (expr.elements.length === 0) {
    return null;
  }

  const elemType = infer(expr.elements[0]);
  if (!elemType) return null;

  return { kind: 'array', elementType: elemType, size: expr.elements.length };
}

function typesCompatible(a: WGSLType, b: WGSLType): boolean {
  if (a.kind !== b.kind) return false;

  if (a.kind === 'primitive' && b.kind === 'primitive') {
    return a.name === b.name;
  }

  if (a.kind === 'vector' && b.kind === 'vector') {
    return a.size === b.size && a.elementType === b.elementType;
  }

  if (a.kind === 'matrix' && b.kind === 'matrix') {
    return a.rows === b.rows && a.cols === b.cols && a.elementType === b.elementType;
  }

  if (a.kind === 'struct' && b.kind === 'struct') {
    return a.name === b.name;
  }

  return false;
}

function isImplicitlyConvertible(from: string, to: string): boolean {
  if (from === to) return true;
  if (from === 'i32' && to === 'f32') return true;
  if (from === 'u32' && to === 'f32') return true;
  return false;
}

export function addVariable(ctx: InferenceContext, name: string, type: WGSLType): void {
  ctx.variables.set(name, type);
}

export function addFunction(
  ctx: InferenceContext,
  name: string,
  params: WGSLType[],
  returnType: WGSLType
): void {
  ctx.functions.set(name, { params, returnType });
}

export function addStruct(
  ctx: InferenceContext,
  name: string,
  fields: { name: string; type: WGSLType }[]
): void {
  ctx.structs.set(name, fields);
}
