import { describe, it, expect } from 'vitest';
import {
  validateSwizzle,
  generateAllSwizzles,
  isWritableSwizzle,
  getSwizzleResultType,
  ALL_VEC2_SWIZZLES,
  ALL_VEC3_SWIZZLES,
  ALL_VEC4_SWIZZLES,
} from '../../packages/core/src/type-system/swizzle';
import type { VectorType } from '../../packages/core/src/types';

describe('Swizzle operations', () => {
  const vec2f: VectorType = { kind: 'vector', size: 2, elementType: 'f32' };
  const vec3f: VectorType = { kind: 'vector', size: 3, elementType: 'f32' };
  const vec4f: VectorType = { kind: 'vector', size: 4, elementType: 'f32' };

  describe('validateSwizzle', () => {
    describe('valid vec2 swizzles', () => {
      it('allows single component access', () => {
        expect(validateSwizzle(vec2f, 'x').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'y').valid).toBe(true);
      });

      it('allows two-component swizzles', () => {
        expect(validateSwizzle(vec2f, 'xy').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'yx').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'xx').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'yy').valid).toBe(true);
      });

      it('allows three-component swizzles', () => {
        expect(validateSwizzle(vec2f, 'xxy').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'yyx').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'xxx').valid).toBe(true);
      });

      it('allows four-component swizzles', () => {
        expect(validateSwizzle(vec2f, 'xxxx').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'xxyy').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'xyxy').valid).toBe(true);
      });

      it('allows rgba notation', () => {
        expect(validateSwizzle(vec2f, 'r').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'rg').valid).toBe(true);
        expect(validateSwizzle(vec2f, 'rr').valid).toBe(true);
      });
    });

    describe('invalid vec2 swizzles', () => {
      it('rejects z component', () => {
        const result = validateSwizzle(vec2f, 'xyz');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('vec2');
        expect(result.error).toContain('z');
      });

      it('rejects w component', () => {
        const result = validateSwizzle(vec2f, 'w');
        expect(result.valid).toBe(false);
      });

      it('rejects b component in rgba', () => {
        const result = validateSwizzle(vec2f, 'rgb');
        expect(result.valid).toBe(false);
      });

      it('rejects a component in rgba', () => {
        const result = validateSwizzle(vec2f, 'a');
        expect(result.valid).toBe(false);
      });
    });

    describe('valid vec3 swizzles', () => {
      it('allows z component', () => {
        expect(validateSwizzle(vec3f, 'z').valid).toBe(true);
        expect(validateSwizzle(vec3f, 'xyz').valid).toBe(true);
        expect(validateSwizzle(vec3f, 'zyx').valid).toBe(true);
      });

      it('allows b component in rgba', () => {
        expect(validateSwizzle(vec3f, 'rgb').valid).toBe(true);
        expect(validateSwizzle(vec3f, 'bgr').valid).toBe(true);
      });
    });

    describe('invalid vec3 swizzles', () => {
      it('rejects w component', () => {
        const result = validateSwizzle(vec3f, 'xyzw');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('vec3');
        expect(result.error).toContain('w');
      });

      it('rejects a component in rgba', () => {
        const result = validateSwizzle(vec3f, 'rgba');
        expect(result.valid).toBe(false);
      });
    });

    describe('valid vec4 swizzles', () => {
      it('allows all xyzw components', () => {
        expect(validateSwizzle(vec4f, 'x').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'y').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'z').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'w').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'xyzw').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'wzyx').valid).toBe(true);
      });

      it('allows all rgba components', () => {
        expect(validateSwizzle(vec4f, 'rgba').valid).toBe(true);
        expect(validateSwizzle(vec4f, 'abgr').valid).toBe(true);
      });

      it('allows all stpq components', () => {
        expect(validateSwizzle(vec4f, 'stpq').valid).toBe(true);
      });
    });

    describe('mixed component sets', () => {
      it('rejects mixing xyzw with rgba', () => {
        const result = validateSwizzle(vec4f, 'xr');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('mix');
      });

      it('rejects mixing xyzw with stpq', () => {
        const result = validateSwizzle(vec4f, 'xs');
        expect(result.valid).toBe(false);
      });

      it('rejects mixing rgba with stpq', () => {
        const result = validateSwizzle(vec4f, 'rs');
        expect(result.valid).toBe(false);
      });
    });

    describe('result types', () => {
      it('returns scalar for single component', () => {
        const result = validateSwizzle(vec3f, 'x');
        expect(result.resultType?.kind).toBe('primitive');
        expect((result.resultType as any).name).toBe('f32');
      });

      it('returns vec2 for two components', () => {
        const result = validateSwizzle(vec3f, 'xy');
        expect(result.resultType?.kind).toBe('vector');
        expect((result.resultType as any).size).toBe(2);
      });

      it('returns vec3 for three components', () => {
        const result = validateSwizzle(vec4f, 'xyz');
        expect(result.resultType?.kind).toBe('vector');
        expect((result.resultType as any).size).toBe(3);
      });

      it('returns vec4 for four components', () => {
        const result = validateSwizzle(vec4f, 'xyzw');
        expect(result.resultType?.kind).toBe('vector');
        expect((result.resultType as any).size).toBe(4);
      });

      it('preserves element type', () => {
        const vec3i: VectorType = { kind: 'vector', size: 3, elementType: 'i32' };
        const result = validateSwizzle(vec3i, 'xy');
        expect((result.resultType as any).elementType).toBe('i32');
      });
    });

    describe('swizzle indices', () => {
      it('returns correct indices for xy', () => {
        const result = validateSwizzle(vec2f, 'xy');
        expect(result.indices).toEqual([0, 1]);
      });

      it('returns correct indices for yx', () => {
        const result = validateSwizzle(vec2f, 'yx');
        expect(result.indices).toEqual([1, 0]);
      });

      it('returns correct indices for xzyw', () => {
        const result = validateSwizzle(vec4f, 'xzyw');
        expect(result.indices).toEqual([0, 2, 1, 3]);
      });

      it('returns correct indices for rgba', () => {
        const result = validateSwizzle(vec4f, 'bgra');
        expect(result.indices).toEqual([2, 1, 0, 3]);
      });
    });
  });

  describe('generateAllSwizzles', () => {
    it('generates correct count for vec2', () => {
      const swizzles = generateAllSwizzles(2);
      const count = 2 + 4 + 8 + 16;
      expect(swizzles.size).toBe(count);
    });

    it('generates correct count for vec3', () => {
      const swizzles = generateAllSwizzles(3);
      const count = 3 + 9 + 27 + 81;
      expect(swizzles.size).toBe(count);
    });

    it('generates correct count for vec4', () => {
      const swizzles = generateAllSwizzles(4);
      const count = 4 + 16 + 64 + 256;
      expect(swizzles.size).toBe(count);
    });

    it('includes common swizzles', () => {
      const swizzles = generateAllSwizzles(4);
      expect(swizzles.has('x')).toBe(true);
      expect(swizzles.has('xy')).toBe(true);
      expect(swizzles.has('xyz')).toBe(true);
      expect(swizzles.has('xyzw')).toBe(true);
      expect(swizzles.has('wzyx')).toBe(true);
    });
  });

  describe('isWritableSwizzle', () => {
    it('allows unique components', () => {
      expect(isWritableSwizzle('x')).toBe(true);
      expect(isWritableSwizzle('xy')).toBe(true);
      expect(isWritableSwizzle('xyz')).toBe(true);
      expect(isWritableSwizzle('xyzw')).toBe(true);
      expect(isWritableSwizzle('wzyx')).toBe(true);
    });

    it('rejects duplicate components', () => {
      expect(isWritableSwizzle('xx')).toBe(false);
      expect(isWritableSwizzle('xxy')).toBe(false);
      expect(isWritableSwizzle('xyxy')).toBe(false);
      expect(isWritableSwizzle('xxxx')).toBe(false);
    });
  });

  describe('pre-generated swizzle sets', () => {
    it('has vec2 swizzles', () => {
      expect(ALL_VEC2_SWIZZLES.size).toBeGreaterThan(0);
      expect(ALL_VEC2_SWIZZLES.has('xy')).toBe(true);
    });

    it('has vec3 swizzles', () => {
      expect(ALL_VEC3_SWIZZLES.size).toBeGreaterThan(0);
      expect(ALL_VEC3_SWIZZLES.has('xyz')).toBe(true);
    });

    it('has vec4 swizzles', () => {
      expect(ALL_VEC4_SWIZZLES.size).toBeGreaterThan(0);
      expect(ALL_VEC4_SWIZZLES.has('xyzw')).toBe(true);
    });
  });

  describe('all possible vec4 swizzle validation', () => {
    it('validates all single-component swizzles', () => {
      const components = ['x', 'y', 'z', 'w'];
      for (const c of components) {
        const result = validateSwizzle(vec4f, c);
        expect(result.valid).toBe(true);
      }
    });

    it('validates all two-component swizzles', () => {
      const components = ['x', 'y', 'z', 'w'];
      for (const a of components) {
        for (const b of components) {
          const result = validateSwizzle(vec4f, a + b);
          expect(result.valid).toBe(true);
        }
      }
    });

    it('validates all three-component swizzles', () => {
      const components = ['x', 'y', 'z', 'w'];
      let count = 0;
      for (const a of components) {
        for (const b of components) {
          for (const c of components) {
            const result = validateSwizzle(vec4f, a + b + c);
            expect(result.valid).toBe(true);
            count++;
          }
        }
      }
      expect(count).toBe(64);
    });

    it('validates all four-component swizzles', () => {
      const components = ['x', 'y', 'z', 'w'];
      let count = 0;
      for (const a of components) {
        for (const b of components) {
          for (const c of components) {
            for (const d of components) {
              const result = validateSwizzle(vec4f, a + b + c + d);
              expect(result.valid).toBe(true);
              count++;
            }
          }
        }
      }
      expect(count).toBe(256);
    });
  });
});
