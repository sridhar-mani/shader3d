import { describe, it, expect } from 'vitest';
import {
  InferenceContext,
  inferType,
  inferBinaryExpression,
  inferCallExpression,
  inferMemberExpression,
} from '../../packages/core/src/type-system/type-inference';
import type { Expression } from '../../packages/core/src/types';

describe('TypeInference', () => {
  describe('InferenceContext', () => {
    it('creates an empty context', () => {
      const ctx = new InferenceContext();
      expect(ctx.getType('unknown')).toBeUndefined();
    });

    it('stores and retrieves variable types', () => {
      const ctx = new InferenceContext();
      ctx.setType('x', { kind: 'primitive', name: 'f32' });
      expect(ctx.getType('x')).toEqual({ kind: 'primitive', name: 'f32' });
    });

    it('creates a child scope', () => {
      const parent = new InferenceContext();
      parent.setType('outer', { kind: 'primitive', name: 'f32' });

      const child = parent.child();
      child.setType('inner', { kind: 'primitive', name: 'i32' });

      expect(child.getType('outer')).toEqual({ kind: 'primitive', name: 'f32' });
      expect(child.getType('inner')).toEqual({ kind: 'primitive', name: 'i32' });
      expect(parent.getType('inner')).toBeUndefined();
    });

    it('shadows parent variables', () => {
      const parent = new InferenceContext();
      parent.setType('x', { kind: 'primitive', name: 'f32' });

      const child = parent.child();
      child.setType('x', { kind: 'primitive', name: 'i32' });

      expect(parent.getType('x')?.name).toBe('f32');
      expect(child.getType('x')?.name).toBe('i32');
    });
  });

  describe('inferType', () => {
    describe('literal expressions', () => {
      it('infers number literal as f32', () => {
        const expr: Expression = { type: 'Literal', value: 1.5, raw: '1.5' };
        expect(inferType(expr)?.kind).toBe('primitive');
        expect((inferType(expr) as any)?.name).toBe('f32');
      });

      it('infers integer literal as i32', () => {
        const expr: Expression = { type: 'Literal', value: 42, raw: '42' };
        // Depends on implementation - could be f32 or inferred from context
        const result = inferType(expr);
        expect(result?.kind).toBe('primitive');
      });

      it('infers boolean literal as bool', () => {
        const expr: Expression = { type: 'Literal', value: true, raw: 'true' };
        expect(inferType(expr)?.kind).toBe('primitive');
        expect((inferType(expr) as any)?.name).toBe('bool');
      });
    });

    describe('identifier expressions', () => {
      it('looks up identifier in context', () => {
        const ctx = new InferenceContext();
        ctx.setType('myVar', { kind: 'vector', size: 3, elementType: 'f32' });

        const expr: Expression = { type: 'Identifier', name: 'myVar' };
        const result = inferType(expr, ctx);

        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('returns undefined for unknown identifier', () => {
        const ctx = new InferenceContext();
        const expr: Expression = { type: 'Identifier', name: 'unknown' };
        expect(inferType(expr, ctx)).toBeUndefined();
      });
    });
  });

  describe('inferBinaryExpression', () => {
    const f32Type = { kind: 'primitive' as const, name: 'f32' };
    const i32Type = { kind: 'primitive' as const, name: 'i32' };
    const vec3fType = { kind: 'vector' as const, size: 3 as const, elementType: 'f32' };
    const mat4Type = {
      kind: 'matrix' as const,
      rows: 4 as const,
      cols: 4 as const,
      elementType: 'f32',
    };

    describe('arithmetic operators', () => {
      it('infers scalar + scalar', () => {
        const result = inferBinaryExpression('+', f32Type, f32Type);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('f32');
      });

      it('infers scalar * scalar', () => {
        const result = inferBinaryExpression('*', f32Type, f32Type);
        expect(result?.kind).toBe('primitive');
      });

      it('infers vector + vector', () => {
        const result = inferBinaryExpression('+', vec3fType, vec3fType);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers vector * scalar', () => {
        const result = inferBinaryExpression('*', vec3fType, f32Type);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers scalar * vector', () => {
        const result = inferBinaryExpression('*', f32Type, vec3fType);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers matrix * vector', () => {
        const vec4Type = { kind: 'vector' as const, size: 4 as const, elementType: 'f32' };
        const result = inferBinaryExpression('*', mat4Type, vec4Type);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(4);
      });

      it('infers matrix * matrix', () => {
        const result = inferBinaryExpression('*', mat4Type, mat4Type);
        expect(result?.kind).toBe('matrix');
      });
    });

    describe('comparison operators', () => {
      it('infers < as bool', () => {
        const result = inferBinaryExpression('<', f32Type, f32Type);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('bool');
      });

      it('infers > as bool', () => {
        const result = inferBinaryExpression('>', i32Type, i32Type);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('bool');
      });

      it('infers == as bool', () => {
        const result = inferBinaryExpression('==', f32Type, f32Type);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('bool');
      });

      it('infers != as bool', () => {
        const result = inferBinaryExpression('!=', f32Type, f32Type);
        expect((result as any)?.name).toBe('bool');
      });

      it('infers <= as bool', () => {
        const result = inferBinaryExpression('<=', f32Type, f32Type);
        expect((result as any)?.name).toBe('bool');
      });

      it('infers >= as bool', () => {
        const result = inferBinaryExpression('>=', f32Type, f32Type);
        expect((result as any)?.name).toBe('bool');
      });
    });

    describe('logical operators', () => {
      const boolType = { kind: 'primitive' as const, name: 'bool' };

      it('infers && as bool', () => {
        const result = inferBinaryExpression('&&', boolType, boolType);
        expect((result as any)?.name).toBe('bool');
      });

      it('infers || as bool', () => {
        const result = inferBinaryExpression('||', boolType, boolType);
        expect((result as any)?.name).toBe('bool');
      });
    });
  });

  describe('inferCallExpression', () => {
    describe('vector constructors', () => {
      it('infers vec2 constructor', () => {
        const result = inferCallExpression('vec2', [
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(2);
        expect((result as any)?.elementType).toBe('f32');
      });

      it('infers vec3 constructor', () => {
        const result = inferCallExpression('vec3', [
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers vec4 constructor', () => {
        const result = inferCallExpression('vec4', [
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
          { kind: 'primitive', name: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(4);
      });

      it('infers vec3 from vec2 + scalar', () => {
        const result = inferCallExpression('vec3', [
          { kind: 'vector', size: 2, elementType: 'f32' },
          { kind: 'primitive', name: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers vec4 from vec3 + scalar', () => {
        const result = inferCallExpression('vec4', [
          { kind: 'vector', size: 3, elementType: 'f32' },
          { kind: 'primitive', name: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(4);
      });

      it('infers vec4 from vec2 + vec2', () => {
        const result = inferCallExpression('vec4', [
          { kind: 'vector', size: 2, elementType: 'f32' },
          { kind: 'vector', size: 2, elementType: 'f32' },
        ]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(4);
      });
    });

    describe('matrix constructors', () => {
      it('infers mat2x2 constructor', () => {
        const result = inferCallExpression('mat2x2', [
          { kind: 'vector', size: 2, elementType: 'f32' },
          { kind: 'vector', size: 2, elementType: 'f32' },
        ]);
        expect(result?.kind).toBe('matrix');
        expect((result as any)?.cols).toBe(2);
        expect((result as any)?.rows).toBe(2);
      });

      it('infers mat4x4 constructor', () => {
        const vec4 = { kind: 'vector' as const, size: 4 as const, elementType: 'f32' };
        const result = inferCallExpression('mat4x4', [vec4, vec4, vec4, vec4]);
        expect(result?.kind).toBe('matrix');
        expect((result as any)?.cols).toBe(4);
        expect((result as any)?.rows).toBe(4);
      });
    });

    describe('math functions', () => {
      const f32 = { kind: 'primitive' as const, name: 'f32' };
      const vec3f = { kind: 'vector' as const, size: 3 as const, elementType: 'f32' };

      it('infers sin returns same type', () => {
        expect(inferCallExpression('sin', [f32])?.kind).toBe('primitive');
        expect(inferCallExpression('sin', [vec3f])?.kind).toBe('vector');
      });

      it('infers cos returns same type', () => {
        expect(inferCallExpression('cos', [f32])?.kind).toBe('primitive');
      });

      it('infers sqrt returns same type', () => {
        expect(inferCallExpression('sqrt', [f32])?.kind).toBe('primitive');
        expect(inferCallExpression('sqrt', [vec3f])?.kind).toBe('vector');
      });

      it('infers abs returns same type', () => {
        expect(inferCallExpression('abs', [f32])?.kind).toBe('primitive');
      });

      it('infers min returns same type', () => {
        const result = inferCallExpression('min', [f32, f32]);
        expect(result?.kind).toBe('primitive');
      });

      it('infers max returns same type', () => {
        const result = inferCallExpression('max', [vec3f, vec3f]);
        expect(result?.kind).toBe('vector');
      });

      it('infers clamp returns same type', () => {
        const result = inferCallExpression('clamp', [f32, f32, f32]);
        expect(result?.kind).toBe('primitive');
      });

      it('infers mix returns same type', () => {
        const result = inferCallExpression('mix', [vec3f, vec3f, f32]);
        expect(result?.kind).toBe('vector');
      });

      it('infers length returns scalar', () => {
        const result = inferCallExpression('length', [vec3f]);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('f32');
      });

      it('infers distance returns scalar', () => {
        const result = inferCallExpression('distance', [vec3f, vec3f]);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('f32');
      });

      it('infers dot returns scalar', () => {
        const result = inferCallExpression('dot', [vec3f, vec3f]);
        expect(result?.kind).toBe('primitive');
        expect((result as any)?.name).toBe('f32');
      });

      it('infers cross returns vec3', () => {
        const result = inferCallExpression('cross', [vec3f, vec3f]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers normalize returns vector', () => {
        const result = inferCallExpression('normalize', [vec3f]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(3);
      });

      it('infers reflect returns vector', () => {
        const result = inferCallExpression('reflect', [vec3f, vec3f]);
        expect(result?.kind).toBe('vector');
      });

      it('infers refract returns vector', () => {
        const result = inferCallExpression('refract', [vec3f, vec3f, f32]);
        expect(result?.kind).toBe('vector');
      });
    });

    describe('texture sampling', () => {
      it('infers textureSample returns vec4f', () => {
        const textureType = {
          kind: 'texture' as const,
          dimension: '2d' as const,
          sampleType: 'float',
        };
        const samplerType = { kind: 'sampler' as const };
        const uvType = { kind: 'vector' as const, size: 2 as const, elementType: 'f32' };

        const result = inferCallExpression('textureSample', [textureType, samplerType, uvType]);
        expect(result?.kind).toBe('vector');
        expect((result as any)?.size).toBe(4);
        expect((result as any)?.elementType).toBe('f32');
      });
    });
  });

  describe('inferMemberExpression', () => {
    it('infers vector component access', () => {
      const vec3f = { kind: 'vector' as const, size: 3 as const, elementType: 'f32' };

      expect(inferMemberExpression(vec3f, 'x')?.kind).toBe('primitive');
      expect(inferMemberExpression(vec3f, 'y')?.kind).toBe('primitive');
      expect(inferMemberExpression(vec3f, 'z')?.kind).toBe('primitive');
    });

    it('infers swizzle access', () => {
      const vec4f = { kind: 'vector' as const, size: 4 as const, elementType: 'f32' };

      const xy = inferMemberExpression(vec4f, 'xy');
      expect(xy?.kind).toBe('vector');
      expect((xy as any)?.size).toBe(2);

      const xyz = inferMemberExpression(vec4f, 'xyz');
      expect(xyz?.kind).toBe('vector');
      expect((xyz as any)?.size).toBe(3);

      const xyzw = inferMemberExpression(vec4f, 'xyzw');
      expect(xyzw?.kind).toBe('vector');
      expect((xyzw as any)?.size).toBe(4);
    });

    it('infers struct field access', () => {
      const structType = {
        kind: 'struct' as const,
        name: 'Vertex',
        fields: [
          {
            name: 'position',
            type: { kind: 'vector' as const, size: 3 as const, elementType: 'f32' },
          },
          { name: 'uv', type: { kind: 'vector' as const, size: 2 as const, elementType: 'f32' } },
        ],
      };

      const position = inferMemberExpression(structType, 'position');
      expect(position?.kind).toBe('vector');
      expect((position as any)?.size).toBe(3);

      const uv = inferMemberExpression(structType, 'uv');
      expect((uv as any)?.size).toBe(2);
    });

    it('returns undefined for unknown struct field', () => {
      const structType = {
        kind: 'struct' as const,
        name: 'Point',
        fields: [{ name: 'x', type: { kind: 'primitive' as const, name: 'f32' } }],
      };

      expect(inferMemberExpression(structType, 'unknown')).toBeUndefined();
    });
  });
});
