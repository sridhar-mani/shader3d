// Transformer - AST to WGSL IR

import type {
  Program,
  FunctionDeclaration,
  VariableDeclaration,
  StructDeclaration,
  Statement,
  Expression,
  WGSLType,
  Decorator,
  UniformBinding,
  Diagnostic,
  IfStatement,
  BlockStatement,
} from './types';
import { MATH_MAPPING, BUILTIN_FUNCTIONS, TYPE_MAP } from './parser';

// WGSL Intermediate Representation
export interface WGSLIR {
  structs: WGSLStruct[];
  uniforms: WGSLUniform[];
  functions: WGSLFunction[];
  entryPoints: WGSLEntryPoint[];
}

export interface WGSLStruct {
  name: string;
  fields: Array<{ name: string; type: string; decorators: string[] }>;
}

export interface WGSLUniform {
  name: string;
  type: string;
  group: number;
  binding: number;
}

export interface WGSLFunction {
  name: string;
  params: Array<{ name: string; type: string; decorators: string[] }>;
  returnType: string;
  body: string[];
  isEntryPoint: boolean;
  stage?: 'vertex' | 'fragment' | 'compute';
  decorators: string[];
}

export interface WGSLEntryPoint {
  name: string;
  stage: 'vertex' | 'fragment' | 'compute';
  function: WGSLFunction;
}

// Symbol Table for tracking variables and their types
interface Symbol {
  name: string;
  type: WGSLType | null;
  kind: 'variable' | 'parameter' | 'uniform' | 'function';
  scope: 'global' | 'local';
}

class SymbolTable {
  private scopes: Map<string, Symbol>[] = [new Map()];

  enterScope() {
    this.scopes.push(new Map());
  }

  exitScope() {
    this.scopes.pop();
  }

  define(symbol: Symbol) {
    this.scopes[this.scopes.length - 1].set(symbol.name, symbol);
  }

  lookup(name: string): Symbol | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const symbol = this.scopes[i].get(name);
      if (symbol) return symbol;
    }
    return undefined;
  }

  isUniform(name: string): boolean {
    const symbol = this.lookup(name);
    return symbol?.kind === 'uniform';
  }
}

export class Transformer {
  private symbolTable = new SymbolTable();
  private diagnostics: Diagnostic[] = [];
  private currentBindingIndex = 0;
  private uniforms: WGSLUniform[] = [];
  private detectedUniforms = new Set<string>();

  // Built-in uniforms that should be auto-detected
  private builtinUniforms: Record<string, { type: string; defaultValue?: string }> = {
    time: { type: 'f32' },
    resolution: { type: 'vec2<f32>' },
    mouse: { type: 'vec2<f32>' },
    frame: { type: 'u32' },
    deltaTime: { type: 'f32' },
  };

  transform(ast: Program): { ir: WGSLIR; diagnostics: Diagnostic[] } {
    this.symbolTable = new SymbolTable();
    this.diagnostics = [];
    this.currentBindingIndex = 0;
    this.uniforms = [];
    this.detectedUniforms = new Set();

    // First pass: collect structs
    const structs = ast.structs.map((s) => this.transformStruct(s));

    // Second pass: analyze for uniforms
    for (const stmt of ast.body) {
      if (stmt.type === 'FunctionDeclaration') {
        this.analyzeForUniforms(stmt);
      }
    }

    // Generate uniform bindings
    for (const name of this.detectedUniforms) {
      const builtin = this.builtinUniforms[name];
      if (builtin) {
        this.uniforms.push({
          name,
          type: builtin.type,
          group: 0,
          binding: this.currentBindingIndex++,
        });
        this.symbolTable.define({
          name,
          type: null,
          kind: 'uniform',
          scope: 'global',
        });
      }
    }

    // Third pass: transform functions
    const functions: WGSLFunction[] = [];
    const entryPoints: WGSLEntryPoint[] = [];

    for (const stmt of ast.body) {
      if (stmt.type === 'FunctionDeclaration') {
        const fn = this.transformFunction(stmt);
        functions.push(fn);

        if (fn.isEntryPoint && fn.stage) {
          entryPoints.push({
            name: fn.name,
            stage: fn.stage,
            function: fn,
          });
        }
      }
    }

    return {
      ir: {
        structs,
        uniforms: this.uniforms,
        functions,
        entryPoints,
      },
      diagnostics: this.diagnostics,
    };
  }

  private analyzeForUniforms(fn: FunctionDeclaration) {
    this.visitExpression(fn.body, (expr) => {
      if (expr.type === 'Identifier') {
        const name = expr.name;
        if (this.builtinUniforms[name]) {
          this.detectedUniforms.add(name);
        }
      }
    });
  }

  private visitExpression(node: Statement | Expression, visitor: (expr: Expression) => void) {
    if (!node) return;

    if ('type' in node) {
      if (node.type === 'BlockStatement') {
        for (const stmt of node.body) {
          this.visitExpression(stmt, visitor);
        }
      } else if (node.type === 'ReturnStatement') {
        if (node.argument) {
          visitor(node.argument);
          this.visitExpression(node.argument, visitor);
        }
      } else if (node.type === 'ExpressionStatement') {
        visitor(node.expression);
        this.visitExpression(node.expression, visitor);
      } else if (node.type === 'IfStatement') {
        visitor(node.test);
        this.visitExpression(node.test, visitor);
        this.visitExpression(node.consequent, visitor);
        if (node.alternate) this.visitExpression(node.alternate, visitor);
      } else if (node.type === 'ForStatement') {
        if (node.test) {
          visitor(node.test);
          this.visitExpression(node.test, visitor);
        }
        if (node.update) {
          visitor(node.update);
          this.visitExpression(node.update, visitor);
        }
        this.visitExpression(node.body, visitor);
      } else if (node.type === 'WhileStatement') {
        visitor(node.test);
        this.visitExpression(node.test, visitor);
        this.visitExpression(node.body, visitor);
      } else if (node.type === 'VariableDeclaration') {
        if (node.init) {
          visitor(node.init);
          this.visitExpression(node.init, visitor);
        }
      } else if (node.type === 'BinaryExpression') {
        visitor(node.left);
        visitor(node.right);
        this.visitExpression(node.left, visitor);
        this.visitExpression(node.right, visitor);
      } else if (node.type === 'CallExpression') {
        visitor(node.callee);
        this.visitExpression(node.callee, visitor);
        for (const arg of node.arguments) {
          visitor(arg);
          this.visitExpression(arg, visitor);
        }
      } else if (node.type === 'MemberExpression') {
        visitor(node.object);
        this.visitExpression(node.object, visitor);
      } else if (node.type === 'UnaryExpression') {
        visitor(node.argument);
        this.visitExpression(node.argument, visitor);
      } else if (node.type === 'AssignmentExpression') {
        visitor(node.left);
        visitor(node.right);
        this.visitExpression(node.left, visitor);
        this.visitExpression(node.right, visitor);
      }
    }
  }

  private transformStruct(struct: StructDeclaration): WGSLStruct {
    return {
      name: struct.name,
      fields: struct.fields.map((f) => ({
        name: f.name,
        type: this.typeToWGSL(f.fieldType),
        decorators: f.decorators.map((d) => this.decoratorToWGSL(d)),
      })),
    };
  }

  private transformFunction(fn: FunctionDeclaration): WGSLFunction {
    this.symbolTable.enterScope();

    // Register parameters
    for (const param of fn.params) {
      this.symbolTable.define({
        name: param.name,
        type: param.paramType,
        kind: 'parameter',
        scope: 'local',
      });
    }

    // Detect entry point stage
    let stage: 'vertex' | 'fragment' | 'compute' | undefined;
    let isEntryPoint = false;
    const decoratorStrings: string[] = [];

    for (const dec of fn.decorators) {
      if (dec.name === 'vertex') {
        stage = 'vertex';
        isEntryPoint = true;
        decoratorStrings.push('@vertex');
      } else if (dec.name === 'fragment') {
        stage = 'fragment';
        isEntryPoint = true;
        decoratorStrings.push('@fragment');
      } else if (dec.name === 'compute') {
        stage = 'compute';
        isEntryPoint = true;
        const workgroup = dec.args.length > 0 ? dec.args : [1, 1, 1];
        decoratorStrings.push(`@compute @workgroup_size(${workgroup.join(', ')})`);
      } else {
        decoratorStrings.push(this.decoratorToWGSL(dec));
      }
    }

    // Transform parameters
    const params = fn.params.map((p) => ({
      name: p.name,
      type: this.typeToWGSL(p.paramType),
      decorators: p.decorators.map((d) => this.decoratorToWGSL(d)),
    }));

    // Transform body
    const body = this.transformBlock(fn.body);

    this.symbolTable.exitScope();

    return {
      name: fn.name,
      params,
      returnType: fn.returnType ? this.typeToWGSL(fn.returnType) : 'void',
      body,
      isEntryPoint,
      stage,
      decorators: decoratorStrings,
    };
  }

  private transformBlock(block: { body: Statement[] }): string[] {
    const lines: string[] = [];

    for (const stmt of block.body) {
      lines.push(...this.transformStatement(stmt));
    }

    return lines;
  }

  private transformStatement(stmt: Statement): string[] {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return [this.transformVariableDeclaration(stmt)];

      case 'ReturnStatement':
        if (stmt.argument) {
          return [`return ${this.transformExpression(stmt.argument)};`];
        }
        return ['return;'];

      case 'ExpressionStatement':
        return [`${this.transformExpression(stmt.expression)};`];

      case 'IfStatement':
        return this.transformIfStatement(stmt);

      case 'ForStatement':
        return this.transformForStatement(stmt);

      case 'WhileStatement':
        return this.transformWhileStatement(stmt);

      case 'BlockStatement':
        return this.transformBlock(stmt);

      default:
        return [];
    }
  }

  private transformVariableDeclaration(decl: VariableDeclaration): string {
    const kind = decl.kind === 'const' ? 'let' : decl.kind; // WGSL uses 'let' for constants in functions
    const typeStr = decl.varType ? `: ${this.typeToWGSL(decl.varType)}` : '';
    const init = decl.init ? ` = ${this.transformExpression(decl.init)}` : '';

    this.symbolTable.define({
      name: decl.name,
      type: decl.varType,
      kind: 'variable',
      scope: 'local',
    });

    return `${kind} ${decl.name}${typeStr}${init};`;
  }

  private transformIfStatement(stmt: IfStatement): string[] {
    const lines: string[] = [];
    lines.push(`if (${this.transformExpression(stmt.test)}) {`);
    lines.push(...this.transformBlock(stmt.consequent).map((l) => '    ' + l));
    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        const elseIf = this.transformIfStatement(stmt.alternate as IfStatement);
        lines.push(`} else ${elseIf[0]}`);
        lines.push(...elseIf.slice(1));
      } else if (stmt.alternate.type === 'BlockStatement') {
        lines.push('} else {');
        lines.push(...this.transformBlock(stmt.alternate as BlockStatement).map((l) => '    ' + l));
        lines.push('}');
      }
    } else {
      lines.push('}');
    }
    return lines;
  }

  private transformForStatement(stmt: {
    init: VariableDeclaration | null;
    test: Expression | null;
    update: Expression | null;
    body: { body: Statement[] };
  }): string[] {
    const lines: string[] = [];
    const init = stmt.init ? this.transformVariableDeclaration(stmt.init).slice(0, -1) : '';
    const test = stmt.test ? this.transformExpression(stmt.test) : 'true';
    const update = stmt.update ? this.transformExpression(stmt.update) : '';

    lines.push(`for (${init}; ${test}; ${update}) {`);
    lines.push(...this.transformBlock(stmt.body).map((l) => '    ' + l));
    lines.push('}');
    return lines;
  }

  private transformWhileStatement(stmt: {
    test: Expression;
    body: { body: Statement[] };
  }): string[] {
    const lines: string[] = [];
    lines.push(`while (${this.transformExpression(stmt.test)}) {`);
    lines.push(...this.transformBlock(stmt.body).map((l) => '    ' + l));
    lines.push('}');
    return lines;
  }

  private transformExpression(expr: Expression): string {
    switch (expr.type) {
      case 'Identifier':
        return expr.name;

      case 'Literal':
        if (typeof expr.value === 'number') {
          // Ensure floats have decimal point for WGSL
          const str = String(expr.value);
          if (!str.includes('.') && !str.includes('e')) {
            return str + '.0';
          }
          return str;
        }
        if (typeof expr.value === 'boolean') {
          return expr.value ? 'true' : 'false';
        }
        return String(expr.value);

      case 'BinaryExpression':
        return `(${this.transformExpression(expr.left)} ${expr.operator} ${this.transformExpression(expr.right)})`;

      case 'UnaryExpression':
        if (expr.prefix) {
          return `${expr.operator}${this.transformExpression(expr.argument)}`;
        }
        return `${this.transformExpression(expr.argument)}${expr.operator}`;

      case 'CallExpression':
        return this.transformCallExpression(expr);

      case 'MemberExpression':
        return this.transformMemberExpression(expr);

      case 'AssignmentExpression':
        return `${this.transformExpression(expr.left)} ${expr.operator} ${this.transformExpression(expr.right)}`;

      case 'ArrayExpression':
        return `array(${expr.elements.map((e) => this.transformExpression(e)).join(', ')})`;

      default:
        return '';
    }
  }

  private transformCallExpression(expr: { callee: Expression; arguments: Expression[] }): string {
    let calleeName = '';

    if (expr.callee.type === 'Identifier') {
      calleeName = expr.callee.name;
    } else if (expr.callee.type === 'MemberExpression') {
      // Handle Math.sin() etc
      const fullName = this.getMemberExpressionName(expr.callee);
      const mapped = MATH_MAPPING[fullName];
      if (mapped) {
        calleeName = mapped;
      } else {
        calleeName = this.transformExpression(expr.callee);
      }
    }

    // Handle type constructors
    if (TYPE_MAP[calleeName]) {
      const type = TYPE_MAP[calleeName];
      if (type.kind === 'vector') {
        const wgslType = `vec${type.size}<${type.elementType}>`;
        return `${wgslType}(${expr.arguments.map((a) => this.transformExpression(a)).join(', ')})`;
      }
      if (type.kind === 'matrix') {
        const wgslType = `mat${type.rows}x${type.cols}<${type.elementType}>`;
        return `${wgslType}(${expr.arguments.map((a) => this.transformExpression(a)).join(', ')})`;
      }
    }

    const args = expr.arguments.map((a) => this.transformExpression(a)).join(', ');
    return `${calleeName}(${args})`;
  }

  private transformMemberExpression(expr: {
    object: Expression;
    property: Expression;
    computed: boolean;
  }): string {
    if (expr.computed) {
      return `${this.transformExpression(expr.object)}[${this.transformExpression(expr.property)}]`;
    }

    // Check for Math.PI, Math.E etc
    const fullName = this.getMemberExpressionName(expr);
    const mapped = MATH_MAPPING[fullName];
    if (mapped) {
      return mapped;
    }

    const propName =
      expr.property.type === 'Identifier'
        ? expr.property.name
        : this.transformExpression(expr.property);
    return `${this.transformExpression(expr.object)}.${propName}`;
  }

  private getMemberExpressionName(expr: {
    object: Expression;
    property: Expression;
    computed: boolean;
  }): string {
    const obj =
      expr.object.type === 'Identifier'
        ? expr.object.name
        : expr.object.type === 'MemberExpression'
          ? this.getMemberExpressionName(expr.object)
          : '';
    const prop = expr.property.type === 'Identifier' ? expr.property.name : '';
    return `${obj}.${prop}`;
  }

  private typeToWGSL(type: WGSLType): string {
    switch (type.kind) {
      case 'primitive':
        return type.name;

      case 'vector':
        return `vec${type.size}<${type.elementType}>`;

      case 'matrix':
        return `mat${type.rows}x${type.cols}<${type.elementType}>`;

      case 'array':
        const elemType = this.typeToWGSL(type.elementType);
        if (type.size !== undefined) {
          return `array<${elemType}, ${type.size}>`;
        }
        return `array<${elemType}>`;

      case 'struct':
        return type.name;

      case 'sampler':
        return type.comparison ? 'sampler_comparison' : 'sampler';

      case 'texture':
        return `texture_${type.dimension}<${type.sampleType}>`;

      default:
        return 'f32';
    }
  }

  private decoratorToWGSL(dec: Decorator): string {
    const args = dec.args.length > 0 ? `(${dec.args.join(', ')})` : '';
    return `@${dec.name}${args}`;
  }
}

export function transform(ast: Program): { ir: WGSLIR; diagnostics: Diagnostic[] } {
  const transformer = new Transformer();
  return transformer.transform(ast);
}
