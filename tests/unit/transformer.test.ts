import { describe, it, expect } from 'vitest';
import { parse } from '../../packages/core/src/parser';
import { transform, Transformer } from '../../packages/core/src/transformer';
import type { WGSLIR } from '../../packages/core/src/transformer';
import * as fixtures from '../fixtures/shaders';

describe('Transformer', () => {
  describe('transform() function', () => {
    it('transforms basic fragment shader', () => {
      const { ast } = parse(fixtures.basicFragment);
      const result = transform(ast);

      expect(result.ir).toBeDefined();
      expect(result.ir.functions).toHaveLength(1);
      expect(result.ir.entryPoints).toHaveLength(1);
      expect(result.ir.entryPoints[0].stage).toBe('fragment');
    });

    it('transforms basic vertex shader', () => {
      const { ast } = parse(fixtures.basicVertex);
      const result = transform(ast);

      expect(result.ir.functions).toHaveLength(1);
      expect(result.ir.entryPoints).toHaveLength(1);
      expect(result.ir.entryPoints[0].stage).toBe('vertex');
    });

    it('transforms compute shader', () => {
      const { ast } = parse(fixtures.computeShader);
      const result = transform(ast);

      expect(result.ir.entryPoints).toHaveLength(1);
      expect(result.ir.entryPoints[0].stage).toBe('compute');
    });

    it('returns diagnostics array', () => {
      const { ast } = parse(fixtures.basicFragment);
      const result = transform(ast);

      expect(result.diagnostics).toBeDefined();
      expect(Array.isArray(result.diagnostics)).toBe(true);
    });
  });

  describe('uniform detection', () => {
    it('detects time uniform', () => {
      const { ast } = parse(fixtures.withUniforms);
      const result = transform(ast);

      const hasTimeUniform = result.ir.uniforms.some((u) => u.name === 'time');
      expect(hasTimeUniform).toBe(true);
    });

    it('detects resolution uniform', () => {
      const { ast } = parse(fixtures.withUniforms);
      const result = transform(ast);

      const hasResolutionUniform = result.ir.uniforms.some((u) => u.name === 'resolution');
      expect(hasResolutionUniform).toBe(true);
    });

    it('assigns binding indices', () => {
      const { ast } = parse(fixtures.withUniforms);
      const result = transform(ast);

      for (const uniform of result.ir.uniforms) {
        expect(uniform.binding).toBeDefined();
        expect(uniform.group).toBeDefined();
      }
    });
  });

  describe('struct transformation', () => {
    it('transforms struct declarations', () => {
      const { ast } = parse(fixtures.withStruct);
      const result = transform(ast);

      expect(result.ir.structs).toHaveLength(1);
      expect(result.ir.structs[0].name).toBe('Vertex');
    });

    it('transforms struct fields', () => {
      const { ast } = parse(fixtures.withStruct);
      const result = transform(ast);

      const struct = result.ir.structs[0];
      expect(struct.fields).toHaveLength(3);
      expect(struct.fields[0].name).toBe('position');
      expect(struct.fields[0].type).toContain('vec3');
    });
  });

  describe('function transformation', () => {
    it('transforms function parameters', () => {
      const { ast } = parse(`
        function add(a: f32, b: f32): f32 {
          return a + b;
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.params).toHaveLength(2);
    });

    it('transforms return types', () => {
      const { ast } = parse(fixtures.basicFragment);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toContain('vec4');
    });

    it('transforms function body', () => {
      const { ast } = parse(fixtures.basicFragment);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.length).toBeGreaterThan(0);
    });

    it('marks entry points correctly', () => {
      const { ast } = parse(fixtures.multipleEntryPoints);
      const result = transform(ast);

      const entryPointFunctions = result.ir.functions.filter((f) => f.isEntryPoint);
      expect(entryPointFunctions.length).toBeGreaterThanOrEqual(2);
    });

    it('identifies helper functions', () => {
      const { ast } = parse(fixtures.helperFunction);
      const result = transform(ast);

      const helpers = result.ir.functions.filter((f) => !f.isEntryPoint);
      expect(helpers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('type mapping', () => {
    it('maps f32 correctly', () => {
      const { ast } = parse(`
        function main(): f32 {
          const x: f32 = 1.0;
          return x;
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toBe('f32');
    });

    it('maps vec2f correctly', () => {
      const { ast } = parse(`
        function main(): vec2f {
          return vec2f(1.0, 2.0);
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toContain('vec2');
    });

    it('maps vec3f correctly', () => {
      const { ast } = parse(`
        function main(): vec3f {
          return vec3f(1.0, 2.0, 3.0);
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toContain('vec3');
    });

    it('maps vec4f correctly', () => {
      const { ast } = parse(fixtures.basicFragment);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toContain('vec4');
    });

    it('maps mat4x4f correctly', () => {
      const { ast } = parse(`
        function identity(): mat4x4f {
          return mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
          );
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.returnType).toContain('mat4x4');
    });
  });

  describe('expression transformation', () => {
    it('transforms binary expressions', () => {
      const { ast } = parse(`
        function main(): f32 {
          return 1.0 + 2.0;
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.join('')).toContain('+');
    });

    it('transforms Math.* calls to WGSL builtins', () => {
      const { ast } = parse(`
        function main(): f32 {
          return Math.sin(1.0);
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.join('')).toContain('sin');
    });

    it('transforms member expressions', () => {
      const { ast } = parse(`
        function main(): f32 {
          const v = vec3f(1.0, 2.0, 3.0);
          return v.x;
        }
      `);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.join('')).toContain('.x');
    });
  });

  describe('control flow transformation', () => {
    it('transforms if statements', () => {
      const { ast } = parse(fixtures.withConditional);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.join('')).toContain('if');
    });

    it('transforms for loops', () => {
      const { ast } = parse(fixtures.withLoop);
      const result = transform(ast);

      const fn = result.ir.functions[0];
      expect(fn.body.join('')).toContain('for');
    });
  });
});

describe('Transformer class', () => {
  it('can be instantiated', () => {
    const transformer = new Transformer();
    expect(transformer).toBeDefined();
  });
});
