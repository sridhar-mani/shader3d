// Parser - TypeScript to Internal AST

import type {
  Program,
  FunctionDeclaration,
  VariableDeclaration,
  StructDeclaration,
  Parameter,
  BlockStatement,
  IfStatement,
  Statement,
  Expression,
  Decorator,
  WGSLType,
  SourceLocation,
  Diagnostic,
} from './types';

// Type mapping from TS/JS syntax to WGSL types
const TYPE_MAP: Record<string, WGSLType> = {
  number: { kind: 'primitive', name: 'f32' },
  f32: { kind: 'primitive', name: 'f32' },
  f16: { kind: 'primitive', name: 'f16' },
  i32: { kind: 'primitive', name: 'i32' },
  u32: { kind: 'primitive', name: 'u32' },
  bool: { kind: 'primitive', name: 'bool' },
  boolean: { kind: 'primitive', name: 'bool' },
  vec2f: { kind: 'vector', size: 2, elementType: 'f32' },
  vec3f: { kind: 'vector', size: 3, elementType: 'f32' },
  vec4f: { kind: 'vector', size: 4, elementType: 'f32' },
  vec2i: { kind: 'vector', size: 2, elementType: 'i32' },
  vec3i: { kind: 'vector', size: 3, elementType: 'i32' },
  vec4i: { kind: 'vector', size: 4, elementType: 'i32' },
  vec2u: { kind: 'vector', size: 2, elementType: 'u32' },
  vec3u: { kind: 'vector', size: 3, elementType: 'u32' },
  vec4u: { kind: 'vector', size: 4, elementType: 'u32' },
  mat2x2f: { kind: 'matrix', rows: 2, cols: 2, elementType: 'f32' },
  mat3x3f: { kind: 'matrix', rows: 3, cols: 3, elementType: 'f32' },
  mat4x4f: { kind: 'matrix', rows: 4, cols: 4, elementType: 'f32' },
  mat2x2: { kind: 'matrix', rows: 2, cols: 2, elementType: 'f32' },
  mat3x3: { kind: 'matrix', rows: 3, cols: 3, elementType: 'f32' },
  mat4x4: { kind: 'matrix', rows: 4, cols: 4, elementType: 'f32' },
};

// Built-in WGSL functions
const BUILTIN_FUNCTIONS = new Set([
  'abs',
  'acos',
  'acosh',
  'asin',
  'asinh',
  'atan',
  'atanh',
  'atan2',
  'ceil',
  'clamp',
  'cos',
  'cosh',
  'cross',
  'degrees',
  'distance',
  'dot',
  'exp',
  'exp2',
  'faceForward',
  'floor',
  'fma',
  'fract',
  'frexp',
  'inverseSqrt',
  'ldexp',
  'length',
  'log',
  'log2',
  'max',
  'min',
  'mix',
  'modf',
  'normalize',
  'pow',
  'radians',
  'reflect',
  'refract',
  'round',
  'saturate',
  'sign',
  'sin',
  'sinh',
  'smoothstep',
  'sqrt',
  'step',
  'tan',
  'tanh',
  'trunc',
  'dpdx',
  'dpdy',
  'fwidth',
  'textureSample',
  'textureLoad',
  'textureStore',
]);

// Math.* to WGSL mapping
const MATH_MAPPING: Record<string, string> = {
  'Math.sin': 'sin',
  'Math.cos': 'cos',
  'Math.tan': 'tan',
  'Math.abs': 'abs',
  'Math.floor': 'floor',
  'Math.ceil': 'ceil',
  'Math.round': 'round',
  'Math.sqrt': 'sqrt',
  'Math.pow': 'pow',
  'Math.min': 'min',
  'Math.max': 'max',
  'Math.exp': 'exp',
  'Math.log': 'log',
  'Math.atan2': 'atan2',
  'Math.PI': '3.14159265359',
  'Math.E': '2.71828182846',
};

interface Token {
  type:
    | 'keyword'
    | 'identifier'
    | 'number'
    | 'string'
    | 'operator'
    | 'punctuation'
    | 'decorator'
    | 'comment'
    | 'eof';
  value: string;
  loc: SourceLocation;
}

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const char = this.source[this.pos];

      if (char === '/' && this.source[this.pos + 1] === '/') {
        this.skipLineComment();
      } else if (char === '/' && this.source[this.pos + 1] === '*') {
        this.skipBlockComment();
      } else if (char === '@') {
        this.readDecorator();
      } else if (this.isAlpha(char)) {
        this.readIdentifier();
      } else if (this.isDigit(char)) {
        this.readNumber();
      } else if (char === '"' || char === "'") {
        this.readString(char);
      } else if (this.isOperator(char)) {
        this.readOperator();
      } else if (this.isPunctuation(char)) {
        this.readPunctuation();
      } else {
        this.pos++;
        this.column++;
      }
    }

    this.tokens.push({
      type: 'eof',
      value: '',
      loc: {
        start: { line: this.line, column: this.column },
        end: { line: this.line, column: this.column },
      },
    });

    return this.tokens;
  }

  private skipWhitespace() {
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];
      if (char === ' ' || char === '\t' || char === '\r') {
        this.pos++;
        this.column++;
      } else if (char === '\n') {
        this.pos++;
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private skipLineComment() {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.pos++;
    }
  }

  private skipBlockComment() {
    this.pos += 2;
    while (this.pos < this.source.length - 1) {
      if (this.source[this.pos] === '*' && this.source[this.pos + 1] === '/') {
        this.pos += 2;
        break;
      }
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private readDecorator() {
    const start = { line: this.line, column: this.column };
    this.pos++; // skip @
    this.column++;

    let value = '@';
    while (
      this.pos < this.source.length &&
      (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_')
    ) {
      value += this.source[this.pos];
      this.pos++;
      this.column++;
    }

    // Handle decorator arguments like @location(0)
    if (this.source[this.pos] === '(') {
      let depth = 1;
      value += this.source[this.pos];
      this.pos++;
      this.column++;
      while (this.pos < this.source.length && depth > 0) {
        if (this.source[this.pos] === '(') depth++;
        if (this.source[this.pos] === ')') depth--;
        value += this.source[this.pos];
        this.pos++;
        this.column++;
      }
    }

    this.tokens.push({
      type: 'decorator',
      value,
      loc: { start, end: { line: this.line, column: this.column } },
    });
  }

  private readIdentifier() {
    const start = { line: this.line, column: this.column };
    let value = '';

    while (
      this.pos < this.source.length &&
      (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_')
    ) {
      value += this.source[this.pos];
      this.pos++;
      this.column++;
    }

    const keywords = new Set([
      'function',
      'fn',
      'const',
      'let',
      'var',
      'if',
      'else',
      'for',
      'while',
      'return',
      'struct',
      'export',
      'import',
      'from',
      'true',
      'false',
    ]);

    this.tokens.push({
      type: keywords.has(value) ? 'keyword' : 'identifier',
      value,
      loc: { start, end: { line: this.line, column: this.column } },
    });
  }

  private readNumber() {
    const start = { line: this.line, column: this.column };
    let value = '';

    while (
      this.pos < this.source.length &&
      (this.isDigit(this.source[this.pos]) ||
        this.source[this.pos] === '.' ||
        this.source[this.pos] === 'e' ||
        this.source[this.pos] === 'E')
    ) {
      value += this.source[this.pos];
      this.pos++;
      this.column++;
    }

    // Handle type suffixes like 1.0f, 2u, 3i
    if (
      this.pos < this.source.length &&
      (this.source[this.pos] === 'f' ||
        this.source[this.pos] === 'u' ||
        this.source[this.pos] === 'i')
    ) {
      value += this.source[this.pos];
      this.pos++;
      this.column++;
    }

    this.tokens.push({
      type: 'number',
      value,
      loc: { start, end: { line: this.line, column: this.column } },
    });
  }

  private readString(quote: string) {
    const start = { line: this.line, column: this.column };
    this.pos++;
    this.column++;
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
        value += this.source[this.pos];
        this.pos++;
        this.column++;
      }
      value += this.source[this.pos];
      this.pos++;
      this.column++;
    }

    this.pos++; // skip closing quote
    this.column++;

    this.tokens.push({
      type: 'string',
      value,
      loc: { start, end: { line: this.line, column: this.column } },
    });
  }

  private readOperator() {
    const start = { line: this.line, column: this.column };
    const operators = [
      '===',
      '!==',
      '==',
      '!=',
      '<=',
      '>=',
      '&&',
      '||',
      '++',
      '--',
      '+=',
      '-=',
      '*=',
      '/=',
      '=>',
      '->',
      '<<',
      '>>',
      '&',
      '|',
      '^',
      '<',
      '>',
      '+',
      '-',
      '*',
      '/',
      '%',
      '=',
      '!',
      '~',
    ];

    for (const op of operators) {
      if (this.source.substring(this.pos, this.pos + op.length) === op) {
        this.pos += op.length;
        this.column += op.length;
        this.tokens.push({
          type: 'operator',
          value: op,
          loc: { start, end: { line: this.line, column: this.column } },
        });
        return;
      }
    }

    this.pos++;
    this.column++;
  }

  private readPunctuation() {
    const start = { line: this.line, column: this.column };
    const char = this.source[this.pos];
    this.pos++;
    this.column++;

    this.tokens.push({
      type: 'punctuation',
      value: char,
      loc: { start, end: { line: this.line, column: this.column } },
    });
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private isOperator(char: string): boolean {
    return '+-*/%=<>!&|^~'.includes(char);
  }

  private isPunctuation(char: string): boolean {
    return '(){}[];:,.?'.includes(char);
  }
}

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  private diagnostics: Diagnostic[] = [];

  parse(source: string): { ast: Program; diagnostics: Diagnostic[] } {
    const lexer = new Lexer(source);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    this.diagnostics = [];

    const body: Statement[] = [];
    const structs: StructDeclaration[] = [];

    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        if (stmt) {
          if (stmt.type === 'StructDeclaration') {
            structs.push(stmt);
          }
          body.push(stmt);
        }
      } catch (e) {
        this.diagnostics.push({
          severity: 'error',
          message: e instanceof Error ? e.message : 'Parse error',
          code: 'PARSE_ERROR',
          loc: this.current()?.loc,
        });
        this.advance();
      }
    }

    return {
      ast: {
        type: 'Program',
        body,
        structs,
        uniforms: [],
      },
      diagnostics: this.diagnostics,
    };
  }

  private parseStatement(): Statement | null {
    const decorators = this.parseDecorators();

    if (this.check('keyword', 'export')) {
      this.advance();
      return this.parseStatement();
    }

    if (this.check('keyword', 'function') || this.check('keyword', 'fn')) {
      return this.parseFunction(decorators);
    }

    if (
      this.check('keyword', 'const') ||
      this.check('keyword', 'let') ||
      this.check('keyword', 'var')
    ) {
      return this.parseVariableDeclaration();
    }

    if (this.check('keyword', 'struct')) {
      return this.parseStruct();
    }

    if (this.check('keyword', 'if')) {
      return this.parseIfStatement();
    }

    if (this.check('keyword', 'for')) {
      return this.parseForStatement();
    }

    if (this.check('keyword', 'while')) {
      return this.parseWhileStatement();
    }

    if (this.check('keyword', 'return')) {
      return this.parseReturnStatement();
    }

    // Expression statement
    const expr = this.parseExpression();
    if (expr) {
      this.consume('punctuation', ';');
      return {
        type: 'ExpressionStatement',
        expression: expr,
      };
    }

    return null;
  }

  private parseDecorators(): Decorator[] {
    const decorators: Decorator[] = [];

    while (this.check('decorator')) {
      const token = this.advance();
      const match = token.value.match(/@(\w+)(?:\(([^)]*)\))?/);
      if (match) {
        const args = match[2]
          ? match[2].split(',').map((a) => {
              const trimmed = a.trim();
              return isNaN(Number(trimmed)) ? trimmed : Number(trimmed);
            })
          : [];
        decorators.push({ name: match[1], args });
      }
    }

    return decorators;
  }

  private parseFunction(decorators: Decorator[]): FunctionDeclaration {
    const start = this.current()?.loc?.start || { line: 1, column: 1 };
    this.advance(); // consume 'function' or 'fn'

    const name = this.consume('identifier').value;

    this.consume('punctuation', '(');
    const params = this.parseParameters();
    this.consume('punctuation', ')');

    let returnType: WGSLType | null = null;
    if (this.check('punctuation', ':') || this.check('operator', '->')) {
      this.advance();
      returnType = this.parseType();
    }

    const body = this.parseBlock();

    return {
      type: 'FunctionDeclaration',
      name,
      params,
      returnType,
      body,
      decorators,
      exported: true,
      loc: { start, end: this.previous()?.loc?.end || start },
    };
  }

  private parseParameters(): Parameter[] {
    const params: Parameter[] = [];

    if (!this.check('punctuation', ')')) {
      do {
        const decorators = this.parseDecorators();
        const name = this.consume('identifier').value;
        this.consume('punctuation', ':');
        const paramType = this.parseType();

        params.push({
          type: 'Parameter',
          name,
          paramType: paramType || { kind: 'primitive', name: 'f32' },
          decorators,
        });
      } while (this.match('punctuation', ','));
    }

    return params;
  }

  private parseType(): WGSLType | null {
    const token = this.advance();
    if (token.type === 'identifier') {
      const mapped = TYPE_MAP[token.value];
      if (mapped) return mapped;

      // Check for generic types like vec2<f32>
      if (this.check('operator', '<')) {
        this.advance();
        const innerType = this.advance().value;
        this.consume('operator', '>');
        const size = parseInt(token.value.match(/\d/)?.[0] || '2');
        return {
          kind: 'vector',
          size: size as 2 | 3 | 4,
          elementType: innerType as 'f32' | 'i32' | 'u32',
        };
      }

      // Struct type
      return { kind: 'struct', name: token.value, fields: [] };
    }
    return null;
  }

  private parseBlock(): BlockStatement {
    this.consume('punctuation', '{');
    const body: Statement[] = [];

    while (!this.check('punctuation', '}') && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.consume('punctuation', '}');
    return { type: 'BlockStatement', body };
  }

  private parseVariableDeclaration(): VariableDeclaration {
    const kind = this.advance().value as 'let' | 'var' | 'const';
    const name = this.consume('identifier').value;

    let varType: WGSLType | null = null;
    if (this.check('punctuation', ':')) {
      this.advance();
      varType = this.parseType();
    }

    let init: Expression | null = null;
    if (this.match('operator', '=')) {
      init = this.parseExpression();
    }

    this.consume('punctuation', ';');

    return {
      type: 'VariableDeclaration',
      name,
      varType,
      init,
      kind,
    };
  }

  private parseStruct(): StructDeclaration {
    this.advance(); // consume 'struct'
    const name = this.consume('identifier').value;

    this.consume('punctuation', '{');
    const fields: { name: string; fieldType: WGSLType; decorators: Decorator[] }[] = [];

    while (!this.check('punctuation', '}') && !this.isAtEnd()) {
      const decorators = this.parseDecorators();
      const fieldName = this.consume('identifier').value;
      this.consume('punctuation', ':');
      const fieldType = this.parseType();
      this.match('punctuation', ',');
      this.match('punctuation', ';');

      fields.push({
        name: fieldName,
        fieldType: fieldType || { kind: 'primitive', name: 'f32' },
        decorators,
      });
    }

    this.consume('punctuation', '}');

    return {
      type: 'StructDeclaration',
      name,
      fields,
    };
  }

  private parseIfStatement(): IfStatement {
    this.advance(); // consume 'if'
    this.consume('punctuation', '(');
    const test = this.parseExpression()!;
    this.consume('punctuation', ')');
    const consequent = this.parseBlock();

    let alternate: BlockStatement | IfStatement | null = null;
    if (this.match('keyword', 'else')) {
      if (this.check('keyword', 'if')) {
        alternate = this.parseIfStatement();
      } else {
        alternate = this.parseBlock();
      }
    }

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate,
    };
  }

  private parseForStatement(): Statement {
    this.advance(); // consume 'for'
    this.consume('punctuation', '(');

    let init: VariableDeclaration | null = null;
    if (!this.check('punctuation', ';')) {
      init = this.parseVariableDeclaration() as VariableDeclaration;
    } else {
      this.advance();
    }

    let test: Expression | null = null;
    if (!this.check('punctuation', ';')) {
      test = this.parseExpression();
    }
    this.consume('punctuation', ';');

    let update: Expression | null = null;
    if (!this.check('punctuation', ')')) {
      update = this.parseExpression();
    }
    this.consume('punctuation', ')');

    const body = this.parseBlock();

    return {
      type: 'ForStatement',
      init,
      test,
      update,
      body,
    };
  }

  private parseWhileStatement(): Statement {
    this.advance(); // consume 'while'
    this.consume('punctuation', '(');
    const test = this.parseExpression()!;
    this.consume('punctuation', ')');
    const body = this.parseBlock();

    return {
      type: 'WhileStatement',
      test,
      body,
    };
  }

  private parseReturnStatement(): Statement {
    this.advance(); // consume 'return'
    let argument: Expression | null = null;

    if (!this.check('punctuation', ';')) {
      argument = this.parseExpression();
    }

    this.consume('punctuation', ';');

    return {
      type: 'ReturnStatement',
      argument,
    };
  }

  private parseExpression(): Expression | null {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression | null {
    let expr = this.parseLogicalOr();

    if (
      this.check('operator', '=') ||
      this.check('operator', '+=') ||
      this.check('operator', '-=') ||
      this.check('operator', '*=') ||
      this.check('operator', '/=')
    ) {
      const op = this.advance().value;
      const right = this.parseAssignment();
      expr = {
        type: 'AssignmentExpression',
        operator: op,
        left: expr!,
        right: right!,
      };
    }

    return expr;
  }

  private parseLogicalOr(): Expression | null {
    let left = this.parseLogicalAnd();

    while (this.match('operator', '||')) {
      const right = this.parseLogicalAnd();
      left = {
        type: 'BinaryExpression',
        operator: '||',
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseLogicalAnd(): Expression | null {
    let left = this.parseEquality();

    while (this.match('operator', '&&')) {
      const right = this.parseEquality();
      left = {
        type: 'BinaryExpression',
        operator: '&&',
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseEquality(): Expression | null {
    let left = this.parseComparison();

    while (
      this.check('operator', '==') ||
      this.check('operator', '!=') ||
      this.check('operator', '===') ||
      this.check('operator', '!==')
    ) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = {
        type: 'BinaryExpression',
        operator: op === '===' ? '==' : op === '!==' ? '!=' : op,
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseComparison(): Expression | null {
    let left = this.parseAdditive();

    while (
      this.check('operator', '<') ||
      this.check('operator', '>') ||
      this.check('operator', '<=') ||
      this.check('operator', '>=')
    ) {
      const op = this.advance().value;
      const right = this.parseAdditive();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseAdditive(): Expression | null {
    let left = this.parseMultiplicative();

    while (this.check('operator', '+') || this.check('operator', '-')) {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseMultiplicative(): Expression | null {
    let left = this.parseUnary();

    while (
      this.check('operator', '*') ||
      this.check('operator', '/') ||
      this.check('operator', '%')
    ) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left: left!,
        right: right!,
      };
    }

    return left;
  }

  private parseUnary(): Expression | null {
    if (this.check('operator', '!') || this.check('operator', '-') || this.check('operator', '~')) {
      const op = this.advance().value;
      const argument = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: op,
        argument: argument!,
        prefix: true,
      };
    }

    return this.parseCall();
  }

  private parseCall(): Expression | null {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match('punctuation', '(')) {
        const args: Expression[] = [];
        if (!this.check('punctuation', ')')) {
          do {
            const arg = this.parseExpression();
            if (arg) args.push(arg);
          } while (this.match('punctuation', ','));
        }
        this.consume('punctuation', ')');
        expr = {
          type: 'CallExpression',
          callee: expr!,
          arguments: args,
        };
      } else if (this.match('punctuation', '.')) {
        const property: Expression = {
          type: 'Identifier',
          name: this.consume('identifier').value,
        };
        expr = {
          type: 'MemberExpression',
          object: expr!,
          property,
          computed: false,
        };
      } else if (this.match('punctuation', '[')) {
        const property = this.parseExpression()!;
        this.consume('punctuation', ']');
        expr = {
          type: 'MemberExpression',
          object: expr!,
          property,
          computed: true,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expression | null {
    if (this.check('number')) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: parseFloat(token.value),
        raw: token.value,
      };
    }

    if (this.check('string')) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value,
        raw: `"${token.value}"`,
      };
    }

    if (this.check('keyword', 'true') || this.check('keyword', 'false')) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value === 'true',
        raw: token.value,
      };
    }

    if (this.check('identifier')) {
      const token = this.advance();
      return {
        type: 'Identifier',
        name: token.value,
      };
    }

    if (this.match('punctuation', '(')) {
      const expr = this.parseExpression();
      this.consume('punctuation', ')');
      return expr;
    }

    if (this.match('punctuation', '[')) {
      const elements: Expression[] = [];
      if (!this.check('punctuation', ']')) {
        do {
          const elem = this.parseExpression();
          if (elem) elements.push(elem);
        } while (this.match('punctuation', ','));
      }
      this.consume('punctuation', ']');
      return {
        type: 'ArrayExpression',
        elements,
      };
    }

    return null;
  }

  // Token helpers
  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private previous(): Token | undefined {
    return this.tokens[this.pos - 1];
  }

  private isAtEnd(): boolean {
    return this.current()?.type === 'eof';
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous()!;
  }

  private check(type: string, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.current();
    if (token?.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private match(type: string, value?: string): boolean {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: string, value?: string): Token {
    if (this.check(type, value)) return this.advance();
    throw new Error(
      `Expected ${type}${value ? ` '${value}'` : ''}, got ${this.current()?.type} '${this.current()?.value}'`
    );
  }
}

export function parse(source: string): { ast: Program; diagnostics: Diagnostic[] } {
  const parser = new Parser();
  return parser.parse(source);
}

export { BUILTIN_FUNCTIONS, MATH_MAPPING, TYPE_MAP };
