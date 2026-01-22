// AST Node Types

export type NodeType =
  | 'Program'
  | 'FunctionDeclaration'
  | 'VariableDeclaration'
  | 'StructDeclaration'
  | 'Parameter'
  | 'BlockStatement'
  | 'ReturnStatement'
  | 'IfStatement'
  | 'ForStatement'
  | 'WhileStatement'
  | 'ExpressionStatement'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'MemberExpression'
  | 'Identifier'
  | 'Literal'
  | 'ArrayExpression'
  | 'AssignmentExpression';

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface BaseNode {
  type: NodeType;
  loc?: SourceLocation;
}

// Type System
export type WGSLType =
  | PrimitiveType
  | VectorType
  | MatrixType
  | ArrayType
  | StructType
  | SamplerType
  | TextureType;

export interface PrimitiveType {
  kind: 'primitive';
  name: 'f32' | 'f16' | 'i32' | 'u32' | 'bool';
}

export interface VectorType {
  kind: 'vector';
  size: 2 | 3 | 4;
  elementType: 'f32' | 'f16' | 'i32' | 'u32' | 'bool';
}

export interface MatrixType {
  kind: 'matrix';
  rows: 2 | 3 | 4;
  cols: 2 | 3 | 4;
  elementType: 'f32' | 'f16';
}

export interface ArrayType {
  kind: 'array';
  elementType: WGSLType;
  size?: number;
}

export interface StructType {
  kind: 'struct';
  name: string;
  fields: Array<{ name: string; type: WGSLType }>;
}

export interface SamplerType {
  kind: 'sampler';
  comparison: boolean;
}

export interface TextureType {
  kind: 'texture';
  dimension: '1d' | '2d' | '3d' | 'cube' | '2d_array';
  sampleType: 'float' | 'sint' | 'uint' | 'depth';
}

// AST Nodes
export interface Program extends BaseNode {
  type: 'Program';
  body: Statement[];
  structs: StructDeclaration[];
  uniforms: UniformBinding[];
}

export interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Parameter[];
  returnType: WGSLType | null;
  body: BlockStatement;
  decorators: Decorator[];
  exported: boolean;
}

export interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  name: string;
  varType: WGSLType | null;
  init: Expression | null;
  kind: 'let' | 'var' | 'const';
}

export interface StructDeclaration extends BaseNode {
  type: 'StructDeclaration';
  name: string;
  fields: StructField[];
}

export interface StructField {
  name: string;
  fieldType: WGSLType;
  decorators: Decorator[];
}

export interface Parameter extends BaseNode {
  type: 'Parameter';
  name: string;
  paramType: WGSLType;
  decorators: Decorator[];
}

export interface Decorator {
  name: string;
  args: Array<string | number>;
}

export interface UniformBinding {
  name: string;
  bindingType: WGSLType;
  group: number;
  binding: number;
  visibility: ('vertex' | 'fragment' | 'compute')[];
}

// Statements
export type Statement =
  | FunctionDeclaration
  | VariableDeclaration
  | StructDeclaration
  | BlockStatement
  | ReturnStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | ExpressionStatement;

export interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  body: Statement[];
}

export interface ReturnStatement extends BaseNode {
  type: 'ReturnStatement';
  argument: Expression | null;
}

export interface IfStatement extends BaseNode {
  type: 'IfStatement';
  test: Expression;
  consequent: BlockStatement;
  alternate: BlockStatement | IfStatement | null;
}

export interface ForStatement extends BaseNode {
  type: 'ForStatement';
  init: VariableDeclaration | null;
  test: Expression | null;
  update: Expression | null;
  body: BlockStatement;
}

export interface WhileStatement extends BaseNode {
  type: 'WhileStatement';
  test: Expression;
  body: BlockStatement;
}

export interface ExpressionStatement extends BaseNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

// Expressions
export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | Identifier
  | Literal
  | ArrayExpression
  | AssignmentExpression;

export interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: 'UnaryExpression';
  operator: string;
  argument: Expression;
  prefix: boolean;
}

export interface CallExpression extends BaseNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;
  property: Expression;
  computed: boolean;
}

export interface Identifier extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface Literal extends BaseNode {
  type: 'Literal';
  value: string | number | boolean;
  raw: string;
}

export interface ArrayExpression extends BaseNode {
  type: 'ArrayExpression';
  elements: Expression[];
}

export interface AssignmentExpression extends BaseNode {
  type: 'AssignmentExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

// Compiler Options
export interface CompilerOptions {
  target: 'webgpu' | 'wgsl' | 'glsl';
  mode: 'development' | 'production' | 'debug' | 'release';
  sourceMaps: boolean;
  strictMode: boolean;
  optimizations: {
    deadCodeElimination: boolean;
    constantFolding: boolean;
    inlining: boolean;
  };
}

// Compiler Result
export interface CompileResult {
  code: string;
  sourceMap?: SourceMap;
  metadata: ShaderMetadata;
  diagnostics: Diagnostic[];
}

export interface SourceMap {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  file?: string;
  sourceRoot?: string;
}

export interface ShaderMetadata {
  uniforms?: UniformInfo[];
  entryPoints: EntryPointInfo[];
  bindings?: Array<{ name: string; type: string; group: number; binding: number }>;
  structs: StructInfo[];
}

export interface UniformInfo {
  name: string;
  type: string;
  group: number;
  binding: number;
  size: number;
  offset: number;
}

export interface EntryPointInfo {
  name: string;
  stage: 'vertex' | 'fragment' | 'compute';
  inputs?: AttributeInfo[];
  outputs?: AttributeInfo[];
}

export interface AttributeInfo {
  name: string;
  type: string;
  location?: number;
  builtin?: string;
}

export interface StructInfo {
  name: string;
  size?: number;
  alignment?: number;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  offset?: number;
  size?: number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
  loc?: SourceLocation;
  suggestions?: string[];
}
