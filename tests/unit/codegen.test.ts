import { describe, it, expect } from 'vitest';
import { generate, Codegen } from '../../packages/core/src/codegen';
import { transform } from '../../packages/core/src/transformer';
import { parse } from '../../packages/core/src/parser';
import * as fixtures from '../fixtures/shaders';
import * as expected from '../fixtures/expected';

describe('Codegen', () => {
  describe('generate() function', () => {
    it('generates valid WGSL from basic fragment shader', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
    });

    it('generates @fragment decorator for fragment shaders', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@fragment');
    });

    it('generates @vertex decorator for vertex shaders', () => {
      const { ast } = parse(fixtures.basicVertex);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@vertex');
    });

    it('generates @compute decorator for compute shaders', () => {
      const { ast } = parse(fixtures.computeShader);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@compute');
    });

    it('returns diagnostics array', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const result = generate(ir);

      expect(result.diagnostics).toBeDefined();
      expect(Array.isArray(result.diagnostics)).toBe(true);
    });
  });

  describe('uniform generation', () => {
    it('generates uniform struct', () => {
      const { ast } = parse(fixtures.withUniforms);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('struct');
    });

    it('generates @group and @binding decorators', () => {
      const { ast } = parse(fixtures.withUniforms);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@group');
      expect(code).toContain('@binding');
    });

    it('generates var<uniform> declaration', () => {
      const { ast } = parse(fixtures.withUniforms);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('uniform');
    });
  });

  describe('struct generation', () => {
    it('generates struct keyword', () => {
      const { ast } = parse(fixtures.withStruct);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('struct');
    });

    it('generates struct fields', () => {
      const { ast } = parse(fixtures.withStruct);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('position');
    });
  });

  describe('function generation', () => {
    it('generates fn keyword', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('fn ');
    });

    it('generates function parameters', () => {
      const { ast } = parse(`
        function add(a: f32, b: f32): f32 {
          return a + b;
        }
      `);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('a');
      expect(code).toContain('b');
      expect(code).toContain('f32');
    });

    it('generates return type', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('vec4');
    });

    it('generates multiple functions', () => {
      const { ast } = parse(fixtures.helperFunction);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      const fnCount = (code.match(/fn /g) || []).length;
      expect(fnCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('variable generation', () => {
    it('generates var for mutable variables', () => {
      const { ast } = parse(`
        function main(): f32 {
          var x: f32 = 1.0;
          x = 2.0;
          return x;
        }
      `);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('var');
    });

    it('generates let for immutable variables', () => {
      const { ast } = parse(`
        function main(): f32 {
          const x: f32 = 1.0;
          return x;
        }
      `);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('let');
    });
  });

  describe('expression generation', () => {
    it('generates binary expressions', () => {
      const { ast } = parse(`
        function main(): f32 {
          return 1.0 + 2.0;
        }
      `);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toMatch(/\d.*\+.*\d/);
    });

    it('generates WGSL builtin functions', () => {
      const { ast } = parse(fixtures.complexMath);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toMatch(/sin|cos|abs|pow/);
    });

    it('generates vec constructor calls', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('vec4');
    });
  });

  describe('control flow generation', () => {
    it('generates if statements', () => {
      const { ast } = parse(fixtures.withConditional);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('if');
    });

    it('generates else clause', () => {
      const { ast } = parse(`
        function main(): f32 {
          if (true) {
            return 1.0;
          } else {
            return 0.0;
          }
        }
      `);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('else');
    });

    it('generates for loops', () => {
      const { ast } = parse(fixtures.withLoop);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('for');
    });
  });

  describe('compute shader specifics', () => {
    it('generates @workgroup_size', () => {
      const { ast } = parse(fixtures.computeShader);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@workgroup_size');
    });
  });

  describe('entry point attributes', () => {
    it('generates @location for fragment outputs', () => {
      const { ast } = parse(fixtures.basicFragment);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@location');
    });

    it('generates @builtin for position', () => {
      const { ast } = parse(fixtures.basicVertex);
      const { ir } = transform(ast);
      const { code } = generate(ir);

      expect(code).toContain('@builtin');
    });
  });
});

describe('Golden tests', () => {
  it('matches expected output for basic fragment shader', () => {
    const { ast } = parse(fixtures.basicFragment);
    const { ir } = transform(ast);
    const { code } = generate(ir);

    const normalized = normalizeWGSL(code);
    const expectedNormalized = normalizeWGSL(expected.expectedBasicFragment);

    expect(normalized).toBe(expectedNormalized);
  });

  it('matches expected output for basic vertex shader', () => {
    const { ast } = parse(fixtures.basicVertex);
    const { ir } = transform(ast);
    const { code } = generate(ir);

    const normalized = normalizeWGSL(code);
    const expectedNormalized = normalizeWGSL(expected.expectedBasicVertex);

    expect(normalized).toBe(expectedNormalized);
  });

  it('matches expected output for shader with uniforms', () => {
    const { ast } = parse(fixtures.withUniforms);
    const { ir } = transform(ast);
    const { code } = generate(ir);

    const normalized = normalizeWGSL(code);
    const expectedNormalized = normalizeWGSL(expected.expectedWithUniforms);

    expect(normalized).toBe(expectedNormalized);
  });
});

describe('Codegen class', () => {
  it('can be instantiated', () => {
    const codegen = new Codegen();
    expect(codegen).toBeDefined();
  });
});

function normalizeWGSL(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}();,:])\s*/g, '$1')
    .trim();
}
