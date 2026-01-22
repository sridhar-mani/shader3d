import type {
  WGSLType,
  VectorType,
  MatrixType,
  PrimitiveType,
  TextureType,
  SamplerType,
} from '../types';

export type ScalarType = 'f32' | 'f16' | 'i32' | 'u32' | 'bool';
export type VectorSize = 2 | 3 | 4;
export type MatrixDim = 2 | 3 | 4;

export interface TypeInfo {
  type: WGSLType;
  size: number;
  alignment: number;
  isScalar: boolean;
  isVector: boolean;
  isMatrix: boolean;
  isArray: boolean;
  isStruct: boolean;
  isTexture: boolean;
  isSampler: boolean;
}

const SCALAR_SIZES: Record<ScalarType, number> = {
  f32: 4,
  f16: 2,
  i32: 4,
  u32: 4,
  bool: 4,
};

export class TypeRegistry {
  private types = new Map<string, TypeInfo>();
  private structDefs = new Map<string, { name: string; type: WGSLType }[]>();

  constructor() {
    this.registerBuiltinTypes();
  }

  private registerBuiltinTypes(): void {
    const scalars: ScalarType[] = ['f32', 'f16', 'i32', 'u32', 'bool'];
    for (const s of scalars) {
      this.registerPrimitive(s);
    }

    const vecSizes: VectorSize[] = [2, 3, 4];
    for (const size of vecSizes) {
      for (const elem of scalars) {
        this.registerVector(size, elem);
      }
    }

    const matDims: MatrixDim[] = [2, 3, 4];
    for (const rows of matDims) {
      for (const cols of matDims) {
        this.registerMatrix(rows, cols, 'f32');
        this.registerMatrix(rows, cols, 'f16');
      }
    }

    this.registerTextureTypes();
    this.registerSamplerTypes();
  }

  private registerPrimitive(name: ScalarType): void {
    const type: PrimitiveType = { kind: 'primitive', name };
    this.types.set(name, {
      type,
      size: SCALAR_SIZES[name],
      alignment: SCALAR_SIZES[name],
      isScalar: true,
      isVector: false,
      isMatrix: false,
      isArray: false,
      isStruct: false,
      isTexture: false,
      isSampler: false,
    });
  }

  private registerVector(size: VectorSize, elemType: ScalarType): void {
    const name = `vec${size}<${elemType}>`;
    const shortName = `vec${size}${elemType === 'f32' ? 'f' : elemType === 'i32' ? 'i' : elemType === 'u32' ? 'u' : elemType === 'f16' ? 'h' : ''}`;
    const type: VectorType = { kind: 'vector', size, elementType: elemType };
    const elemSize = SCALAR_SIZES[elemType];
    const alignment = size === 3 ? 4 * elemSize : size * elemSize;

    const info: TypeInfo = {
      type,
      size: size * elemSize,
      alignment,
      isScalar: false,
      isVector: true,
      isMatrix: false,
      isArray: false,
      isStruct: false,
      isTexture: false,
      isSampler: false,
    };

    this.types.set(name, info);
    this.types.set(shortName, info);
  }

  private registerMatrix(rows: MatrixDim, cols: MatrixDim, elemType: 'f32' | 'f16'): void {
    const name = `mat${cols}x${rows}<${elemType}>`;
    const shortName = `mat${cols}x${rows}${elemType === 'f32' ? 'f' : 'h'}`;
    const type: MatrixType = { kind: 'matrix', rows, cols, elementType: elemType };
    const elemSize = SCALAR_SIZES[elemType];
    const colAlignment = rows === 3 ? 4 * elemSize : rows * elemSize;

    const info: TypeInfo = {
      type,
      size: cols * colAlignment,
      alignment: colAlignment,
      isScalar: false,
      isVector: false,
      isMatrix: true,
      isArray: false,
      isStruct: false,
      isTexture: false,
      isSampler: false,
    };

    this.types.set(name, info);
    this.types.set(shortName, info);
  }

  private registerTextureTypes(): void {
    const dimensions = ['1d', '2d', '3d', 'cube', '2d_array'] as const;
    const sampleTypes = ['float', 'sint', 'uint', 'depth'] as const;

    for (const dim of dimensions) {
      for (const sample of sampleTypes) {
        if (sample === 'depth' && dim !== '2d' && dim !== 'cube' && dim !== '2d_array') continue;

        const name = sample === 'depth' ? `texture_depth_${dim}` : `texture_${dim}<${sample}>`;
        const type: TextureType = { kind: 'texture', dimension: dim, sampleType: sample };

        this.types.set(name, {
          type,
          size: 0,
          alignment: 0,
          isScalar: false,
          isVector: false,
          isMatrix: false,
          isArray: false,
          isStruct: false,
          isTexture: true,
          isSampler: false,
        });
      }
    }
  }

  private registerSamplerTypes(): void {
    const samplerType: SamplerType = { kind: 'sampler', comparison: false };
    const comparisonType: SamplerType = { kind: 'sampler', comparison: true };

    this.types.set('sampler', {
      type: samplerType,
      size: 0,
      alignment: 0,
      isScalar: false,
      isVector: false,
      isMatrix: false,
      isArray: false,
      isStruct: false,
      isTexture: false,
      isSampler: true,
    });

    this.types.set('sampler_comparison', {
      type: comparisonType,
      size: 0,
      alignment: 0,
      isScalar: false,
      isVector: false,
      isMatrix: false,
      isArray: false,
      isStruct: false,
      isTexture: false,
      isSampler: true,
    });
  }

  registerStruct(name: string, fields: { name: string; type: WGSLType }[]): void {
    this.structDefs.set(name, fields);

    let offset = 0;
    let maxAlign = 0;

    for (const field of fields) {
      const fieldInfo = this.getTypeInfo(this.typeToString(field.type));
      if (fieldInfo) {
        offset = Math.ceil(offset / fieldInfo.alignment) * fieldInfo.alignment;
        offset += fieldInfo.size;
        maxAlign = Math.max(maxAlign, fieldInfo.alignment);
      }
    }

    const size = Math.ceil(offset / maxAlign) * maxAlign;

    this.types.set(name, {
      type: { kind: 'struct', name, fields },
      size,
      alignment: maxAlign,
      isScalar: false,
      isVector: false,
      isMatrix: false,
      isArray: false,
      isStruct: true,
      isTexture: false,
      isSampler: false,
    });
  }

  getTypeInfo(typeName: string): TypeInfo | undefined {
    return this.types.get(typeName);
  }

  getStructFields(name: string): { name: string; type: WGSLType }[] | undefined {
    return this.structDefs.get(name);
  }

  isType(name: string): boolean {
    return this.types.has(name);
  }

  typeToString(type: WGSLType): string {
    switch (type.kind) {
      case 'primitive':
        return type.name;
      case 'vector':
        return `vec${type.size}<${type.elementType}>`;
      case 'matrix':
        return `mat${type.cols}x${type.rows}<${type.elementType}>`;
      case 'array':
        return type.size
          ? `array<${this.typeToString(type.elementType)}, ${type.size}>`
          : `array<${this.typeToString(type.elementType)}>`;
      case 'struct':
        return type.name;
      case 'texture':
        return type.sampleType === 'depth'
          ? `texture_depth_${type.dimension}`
          : `texture_${type.dimension}<${type.sampleType}>`;
      case 'sampler':
        return type.comparison ? 'sampler_comparison' : 'sampler';
    }
  }

  parseType(name: string): WGSLType | null {
    const info = this.types.get(name);
    if (info) return info.type;

    const vecMatch = name.match(/^vec(\d)<(\w+)>$/);
    if (vecMatch) {
      const size = parseInt(vecMatch[1]) as VectorSize;
      const elem = vecMatch[2] as ScalarType;
      if ([2, 3, 4].includes(size) && ['f32', 'f16', 'i32', 'u32', 'bool'].includes(elem)) {
        return { kind: 'vector', size, elementType: elem };
      }
    }

    const shortVecMatch = name.match(/^vec(\d)([fiuh])?$/);
    if (shortVecMatch) {
      const size = parseInt(shortVecMatch[1]) as VectorSize;
      const suffix = shortVecMatch[2] || 'f';
      const elemMap: Record<string, ScalarType> = { f: 'f32', i: 'i32', u: 'u32', h: 'f16' };
      if ([2, 3, 4].includes(size) && elemMap[suffix]) {
        return { kind: 'vector', size, elementType: elemMap[suffix] };
      }
    }

    const matMatch = name.match(/^mat(\d)x(\d)<(\w+)>$/);
    if (matMatch) {
      const cols = parseInt(matMatch[1]) as MatrixDim;
      const rows = parseInt(matMatch[2]) as MatrixDim;
      const elem = matMatch[3] as 'f32' | 'f16';
      if ([2, 3, 4].includes(cols) && [2, 3, 4].includes(rows) && ['f32', 'f16'].includes(elem)) {
        return { kind: 'matrix', cols, rows, elementType: elem };
      }
    }

    const shortMatMatch = name.match(/^mat(\d)x(\d)([fh])?$/);
    if (shortMatMatch) {
      const cols = parseInt(shortMatMatch[1]) as MatrixDim;
      const rows = parseInt(shortMatMatch[2]) as MatrixDim;
      const elem = (shortMatMatch[3] === 'h' ? 'f16' : 'f32') as 'f32' | 'f16';
      if ([2, 3, 4].includes(cols) && [2, 3, 4].includes(rows)) {
        return { kind: 'matrix', cols, rows, elementType: elem };
      }
    }

    return null;
  }
}

export const globalRegistry = new TypeRegistry();
