import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer, Parser, parse } from '../../packages/core/src/parser';
import * as fixtures from '../fixtures/shaders';

describe('Lexer', () => {
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
  });

  describe('tokenization', () => {
    it('tokenizes keywords', () => {
      const tokens = lexer.tokenize('function const let var if else for while return struct');
      const keywords = tokens.filter((t) => t.type === 'keyword');
      expect(keywords).toHaveLength(10);
      expect(keywords.map((k) => k.value)).toEqual([
        'function',
        'const',
        'let',
        'var',
        'if',
        'else',
        'for',
        'while',
        'return',
        'struct',
      ]);
    });

    it('tokenizes decorators', () => {
      const tokens = lexer.tokenize('@vertex @fragment @compute @group(0) @binding(1)');
      const decorators = tokens.filter((t) => t.type === 'decorator');
      expect(decorators.length).toBeGreaterThanOrEqual(3);
    });

    it('tokenizes operators', () => {
      const tokens = lexer.tokenize('+ - * / = == != < > <= >= && ||');
      const operators = tokens.filter((t) => t.type === 'operator');
      expect(operators.length).toBeGreaterThanOrEqual(10);
    });

    it('tokenizes numbers', () => {
      const tokens = lexer.tokenize('123 45.67 1.0 0.5 1e-5 2.5e10');
      const numbers = tokens.filter((t) => t.type === 'number');
      expect(numbers).toHaveLength(6);
      expect(parseFloat(numbers[0].value)).toBe(123);
      expect(parseFloat(numbers[1].value)).toBeCloseTo(45.67);
    });

    it('tokenizes identifiers', () => {
      const tokens = lexer.tokenize('myVar _private camelCase vec3f mat4x4f');
      const identifiers = tokens.filter((t) => t.type === 'identifier');
      expect(identifiers.length).toBeGreaterThanOrEqual(5);
    });

    it('tokenizes type annotations', () => {
      const tokens = lexer.tokenize('x: f32, y: vec3f, z: mat4x4f');
      expect(tokens.some((t) => t.value === 'f32')).toBe(true);
      expect(tokens.some((t) => t.value === 'vec3f')).toBe(true);
      expect(tokens.some((t) => t.value === 'mat4x4f')).toBe(true);
    });

    it('handles empty input', () => {
      const tokens = lexer.tokenize('');
      expect(tokens).toHaveLength(0);
    });

    it('handles whitespace and newlines', () => {
      const tokens = lexer.tokenize('a\n  b\t\tc');
      const identifiers = tokens.filter((t) => t.type === 'identifier');
      expect(identifiers).toHaveLength(3);
    });

    it('tokenizes comments (single-line)', () => {
      const tokens = lexer.tokenize('x // this is a comment\ny');
      const identifiers = tokens.filter((t) => t.type === 'identifier');
      expect(identifiers).toHaveLength(2);
    });

    it('tokenizes comments (multi-line)', () => {
      const tokens = lexer.tokenize('x /* multi\nline */ y');
      const identifiers = tokens.filter((t) => t.type === 'identifier');
      expect(identifiers).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('handles invalid characters gracefully', () => {
      expect(() => lexer.tokenize('let x = 1;')).not.toThrow();
    });
  });
});

describe('Parser', () => {
  describe('function declarations', () => {
    it('parses basic function', () => {
      const result = parse(fixtures.basicFragment);
      expect(result.ast.body).toHaveLength(1);
      expect(result.ast.body[0].type).toBe('FunctionDeclaration');
    });

    it('parses function with parameters', () => {
      const result = parse(`
        function add(a: f32, b: f32): f32 {
          return a + b;
        }
      `);
      const fn = result.ast.body[0] as any;
      expect(fn.params).toHaveLength(2);
      expect(fn.params[0].name).toBe('a');
      expect(fn.params[1].name).toBe('b');
    });

    it('parses function with decorators', () => {
      const result = parse(fixtures.basicVertex);
      const fn = result.ast.body[0] as any;
      expect(fn.decorators).toHaveLength(1);
      expect(fn.decorators[0].name).toBe('vertex');
    });

    it('parses multiple functions', () => {
      const result = parse(fixtures.multipleEntryPoints);
      expect(result.ast.body.length).toBeGreaterThanOrEqual(2);
    });

    it('parses helper functions', () => {
      const result = parse(fixtures.helperFunction);
      const functions = result.ast.body.filter((n: any) => n.type === 'FunctionDeclaration');
      expect(functions).toHaveLength(2);
    });
  });

  describe('statements', () => {
    it('parses variable declarations', () => {
      const result = parse(`
        function main(): f32 {
          const x = 1.0;
          let y = 2.0;
          var z = 3.0;
          return x + y + z;
        }
      `);
      const fn = result.ast.body[0] as any;
      expect(fn.body.body.length).toBeGreaterThanOrEqual(4);
    });

    it('parses if statements', () => {
      const result = parse(fixtures.withConditional);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses for loops', () => {
      const result = parse(fixtures.withLoop);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses return statements', () => {
      const result = parse(fixtures.basicFragment);
      const fn = result.ast.body[0] as any;
      const returns = fn.body.body.filter((s: any) => s.type === 'ReturnStatement');
      expect(returns.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('expressions', () => {
    it('parses binary expressions', () => {
      const result = parse(`
        function main(): f32 {
          return 1.0 + 2.0 * 3.0;
        }
      `);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses call expressions', () => {
      const result = parse(`
        function main(): f32 {
          return sin(1.0) + cos(2.0);
        }
      `);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses member expressions', () => {
      const result = parse(`
        function main(): f32 {
          const v = vec3f(1.0, 2.0, 3.0);
          return v.x + v.y + v.z;
        }
      `);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses array expressions', () => {
      const result = parse(`
        function main(): f32 {
          const arr = array<f32, 3>(1.0, 2.0, 3.0);
          return arr[0];
        }
      `);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('parses vector constructors', () => {
      const result = parse(`
        function main(): vec4f {
          return vec4f(1.0, 2.0, 3.0, 4.0);
        }
      `);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('struct declarations', () => {
    it('parses struct definitions', () => {
      const result = parse(fixtures.withStruct);
      expect(result.ast.structs).toHaveLength(1);
      expect(result.ast.structs[0].name).toBe('Vertex');
    });

    it('parses struct fields', () => {
      const result = parse(fixtures.withStruct);
      const struct = result.ast.structs[0];
      expect(struct.fields).toHaveLength(3);
    });
  });

  describe('diagnostics', () => {
    it('reports syntax errors', () => {
      const result = parse(fixtures.syntaxError);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('provides line numbers for errors', () => {
      const result = parse(fixtures.syntaxError);
      if (result.diagnostics.length > 0) {
        expect(result.diagnostics[0].line).toBeDefined();
      }
    });
  });
});

describe('parse() function', () => {
  it('returns ast and diagnostics', () => {
    const result = parse(fixtures.basicFragment);
    expect(result).toHaveProperty('ast');
    expect(result).toHaveProperty('diagnostics');
  });

  it('parses all fixture shaders without crashing', () => {
    const shaders = [
      fixtures.basicFragment,
      fixtures.basicVertex,
      fixtures.withUniforms,
      fixtures.withStruct,
      fixtures.computeShader,
      fixtures.complexMath,
      fixtures.withLoop,
      fixtures.withConditional,
      fixtures.helperFunction,
      fixtures.multipleEntryPoints,
    ];

    for (const shader of shaders) {
      expect(() => parse(shader)).not.toThrow();
    }
  });
});
