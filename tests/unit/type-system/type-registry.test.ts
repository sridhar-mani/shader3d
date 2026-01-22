import { describe, it, expect } from 'vitest';
import { TypeRegistry, globalRegistry } from '../../packages/core/src/type-system/type-registry';
import type { VectorType, MatrixType, PrimitiveType } from '../../packages/core/src/types';

describe('TypeRegistry', () => {
  describe('constructor', () => {
    it('creates a new registry with builtin types', () => {
      const registry = new TypeRegistry();
      expect(registry.isType('f32')).toBe(true);
      expect(registry.isType('vec3f')).toBe(true);
      expect(registry.isType('mat4x4f')).toBe(true);
    });
  });

  describe('primitive types', () => {
    const registry = new TypeRegistry();

    it('registers f32', () => {
      const info = registry.getTypeInfo('f32');
      expect(info).toBeDefined();
      expect(info?.type.kind).toBe('primitive');
      expect((info?.type as PrimitiveType).name).toBe('f32');
      expect(info?.size).toBe(4);
    });

    it('registers f16', () => {
      const info = registry.getTypeInfo('f16');
      expect(info).toBeDefined();
      expect(info?.size).toBe(2);
    });

    it('registers i32', () => {
      const info = registry.getTypeInfo('i32');
      expect(info).toBeDefined();
      expect(info?.size).toBe(4);
    });

    it('registers u32', () => {
      const info = registry.getTypeInfo('u32');
      expect(info).toBeDefined();
      expect(info?.size).toBe(4);
    });

    it('registers bool', () => {
      const info = registry.getTypeInfo('bool');
      expect(info).toBeDefined();
      expect(info?.size).toBe(4);
    });
  });

  describe('vector types', () => {
    const registry = new TypeRegistry();

    it('registers vec2f', () => {
      const info = registry.getTypeInfo('vec2f');
      expect(info).toBeDefined();
      expect(info?.type.kind).toBe('vector');
      expect((info?.type as VectorType).size).toBe(2);
      expect((info?.type as VectorType).elementType).toBe('f32');
      expect(info?.size).toBe(8);
    });

    it('registers vec3f', () => {
      const info = registry.getTypeInfo('vec3f');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).size).toBe(3);
      expect(info?.size).toBe(12);
      expect(info?.alignment).toBe(16);
    });

    it('registers vec4f', () => {
      const info = registry.getTypeInfo('vec4f');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).size).toBe(4);
      expect(info?.size).toBe(16);
    });

    it('registers vec2i', () => {
      const info = registry.getTypeInfo('vec2i');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).elementType).toBe('i32');
    });

    it('registers vec3u', () => {
      const info = registry.getTypeInfo('vec3u');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).elementType).toBe('u32');
    });

    it('registers vec4h', () => {
      const info = registry.getTypeInfo('vec4h');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).elementType).toBe('f16');
    });

    it('recognizes long form vec2<f32>', () => {
      const info = registry.getTypeInfo('vec2<f32>');
      expect(info).toBeDefined();
      expect(info?.type.kind).toBe('vector');
    });

    it('recognizes long form vec3<i32>', () => {
      const info = registry.getTypeInfo('vec3<i32>');
      expect(info).toBeDefined();
      expect((info?.type as VectorType).elementType).toBe('i32');
    });
  });

  describe('matrix types', () => {
    const registry = new TypeRegistry();

    it('registers mat2x2f', () => {
      const info = registry.getTypeInfo('mat2x2f');
      expect(info).toBeDefined();
      expect(info?.type.kind).toBe('matrix');
      expect((info?.type as MatrixType).rows).toBe(2);
      expect((info?.type as MatrixType).cols).toBe(2);
    });

    it('registers mat3x3f', () => {
      const info = registry.getTypeInfo('mat3x3f');
      expect(info).toBeDefined();
      expect((info?.type as MatrixType).rows).toBe(3);
      expect((info?.type as MatrixType).cols).toBe(3);
    });

    it('registers mat4x4f', () => {
      const info = registry.getTypeInfo('mat4x4f');
      expect(info).toBeDefined();
      expect((info?.type as MatrixType).rows).toBe(4);
      expect((info?.type as MatrixType).cols).toBe(4);
    });

    it('registers mat2x3f', () => {
      const info = registry.getTypeInfo('mat2x3f');
      expect(info).toBeDefined();
      expect((info?.type as MatrixType).cols).toBe(2);
      expect((info?.type as MatrixType).rows).toBe(3);
    });

    it('registers mat4x4h', () => {
      const info = registry.getTypeInfo('mat4x4h');
      expect(info).toBeDefined();
      expect((info?.type as MatrixType).elementType).toBe('f16');
    });

    it('recognizes long form mat4x4<f32>', () => {
      const info = registry.getTypeInfo('mat4x4<f32>');
      expect(info).toBeDefined();
      expect(info?.type.kind).toBe('matrix');
    });
  });

  describe('texture types', () => {
    const registry = new TypeRegistry();

    it('registers texture_2d<float>', () => {
      const info = registry.getTypeInfo('texture_2d<float>');
      expect(info).toBeDefined();
      expect(info?.isTexture).toBe(true);
    });

    it('registers texture_depth_2d', () => {
      const info = registry.getTypeInfo('texture_depth_2d');
      expect(info).toBeDefined();
      expect(info?.isTexture).toBe(true);
    });

    it('registers texture_3d<float>', () => {
      const info = registry.getTypeInfo('texture_3d<float>');
      expect(info).toBeDefined();
    });

    it('registers texture_cube<float>', () => {
      const info = registry.getTypeInfo('texture_cube<float>');
      expect(info).toBeDefined();
    });
  });

  describe('sampler types', () => {
    const registry = new TypeRegistry();

    it('registers sampler', () => {
      const info = registry.getTypeInfo('sampler');
      expect(info).toBeDefined();
      expect(info?.isSampler).toBe(true);
    });

    it('registers sampler_comparison', () => {
      const info = registry.getTypeInfo('sampler_comparison');
      expect(info).toBeDefined();
      expect(info?.isSampler).toBe(true);
    });
  });

  describe('struct registration', () => {
    it('registers a custom struct', () => {
      const registry = new TypeRegistry();
      registry.registerStruct('Vertex', [
        { name: 'position', type: { kind: 'vector', size: 3, elementType: 'f32' } },
        { name: 'normal', type: { kind: 'vector', size: 3, elementType: 'f32' } },
        { name: 'uv', type: { kind: 'vector', size: 2, elementType: 'f32' } },
      ]);

      const info = registry.getTypeInfo('Vertex');
      expect(info).toBeDefined();
      expect(info?.isStruct).toBe(true);
    });

    it('retrieves struct fields', () => {
      const registry = new TypeRegistry();
      registry.registerStruct('Point', [
        { name: 'x', type: { kind: 'primitive', name: 'f32' } },
        { name: 'y', type: { kind: 'primitive', name: 'f32' } },
      ]);

      const fields = registry.getStructFields('Point');
      expect(fields).toHaveLength(2);
      expect(fields?.[0].name).toBe('x');
      expect(fields?.[1].name).toBe('y');
    });
  });

  describe('typeToString', () => {
    const registry = new TypeRegistry();

    it('converts primitive types', () => {
      expect(registry.typeToString({ kind: 'primitive', name: 'f32' })).toBe('f32');
      expect(registry.typeToString({ kind: 'primitive', name: 'i32' })).toBe('i32');
    });

    it('converts vector types', () => {
      expect(registry.typeToString({ kind: 'vector', size: 2, elementType: 'f32' })).toBe(
        'vec2<f32>'
      );
      expect(registry.typeToString({ kind: 'vector', size: 3, elementType: 'i32' })).toBe(
        'vec3<i32>'
      );
      expect(registry.typeToString({ kind: 'vector', size: 4, elementType: 'f32' })).toBe(
        'vec4<f32>'
      );
    });

    it('converts matrix types', () => {
      expect(registry.typeToString({ kind: 'matrix', cols: 4, rows: 4, elementType: 'f32' })).toBe(
        'mat4x4<f32>'
      );
      expect(registry.typeToString({ kind: 'matrix', cols: 2, rows: 3, elementType: 'f16' })).toBe(
        'mat2x3<f16>'
      );
    });

    it('converts struct types', () => {
      expect(registry.typeToString({ kind: 'struct', name: 'Vertex', fields: [] })).toBe('Vertex');
    });
  });

  describe('parseType', () => {
    const registry = new TypeRegistry();

    it('parses primitive types', () => {
      expect(registry.parseType('f32')?.kind).toBe('primitive');
      expect(registry.parseType('i32')?.kind).toBe('primitive');
    });

    it('parses short form vector types', () => {
      const vec3f = registry.parseType('vec3f');
      expect(vec3f?.kind).toBe('vector');
      expect((vec3f as VectorType).size).toBe(3);
      expect((vec3f as VectorType).elementType).toBe('f32');
    });

    it('parses long form vector types', () => {
      const vec4i = registry.parseType('vec4<i32>');
      expect(vec4i?.kind).toBe('vector');
      expect((vec4i as VectorType).elementType).toBe('i32');
    });

    it('parses short form matrix types', () => {
      const mat4 = registry.parseType('mat4x4f');
      expect(mat4?.kind).toBe('matrix');
      expect((mat4 as MatrixType).rows).toBe(4);
      expect((mat4 as MatrixType).cols).toBe(4);
    });

    it('parses long form matrix types', () => {
      const mat3 = registry.parseType('mat3x3<f32>');
      expect(mat3?.kind).toBe('matrix');
    });

    it('returns null for unknown types', () => {
      expect(registry.parseType('unknown')).toBeNull();
      expect(registry.parseType('vec5f')).toBeNull();
      expect(registry.parseType('mat5x5f')).toBeNull();
    });
  });

  describe('globalRegistry', () => {
    it('is a shared instance', () => {
      expect(globalRegistry).toBeDefined();
      expect(globalRegistry.isType('f32')).toBe(true);
    });
  });
});
