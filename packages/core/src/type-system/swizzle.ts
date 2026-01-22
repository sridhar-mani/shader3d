import type { VectorType, WGSLType } from '../types';

type SwizzleComponent = 'x' | 'y' | 'z' | 'w' | 'r' | 'g' | 'b' | 'a' | 's' | 't' | 'p' | 'q';

const XYZW_COMPONENTS = ['x', 'y', 'z', 'w'] as const;
const RGBA_COMPONENTS = ['r', 'g', 'b', 'a'] as const;
const STPQ_COMPONENTS = ['s', 't', 'p', 'q'] as const;

const COMPONENT_TO_INDEX: Record<SwizzleComponent, number> = {
  x: 0,
  y: 1,
  z: 2,
  w: 3,
  r: 0,
  g: 1,
  b: 2,
  a: 3,
  s: 0,
  t: 1,
  p: 2,
  q: 3,
};

const COMPONENT_SETS = [XYZW_COMPONENTS, RGBA_COMPONENTS, STPQ_COMPONENTS] as const;

export interface SwizzleResult {
  valid: boolean;
  resultType:
    | VectorType
    | { kind: 'primitive'; name: 'f32' | 'i32' | 'u32' | 'bool' | 'f16' }
    | null;
  indices: number[];
  error?: string;
}

function getComponentSet(char: string): readonly SwizzleComponent[] | null {
  for (const set of COMPONENT_SETS) {
    if ((set as readonly string[]).includes(char)) {
      return set;
    }
  }
  return null;
}

function isValidSwizzle(swizzle: string, vectorSize: 2 | 3 | 4): SwizzleResult {
  if (swizzle.length === 0 || swizzle.length > 4) {
    return {
      valid: false,
      resultType: null,
      indices: [],
      error: `Swizzle '${swizzle}' has invalid length (must be 1-4 components)`,
    };
  }

  const firstSet = getComponentSet(swizzle[0]);
  if (!firstSet) {
    return {
      valid: false,
      resultType: null,
      indices: [],
      error: `Invalid swizzle component '${swizzle[0]}'`,
    };
  }

  const indices: number[] = [];
  const maxIndex = vectorSize - 1;
  const validComponents = firstSet.slice(0, vectorSize);

  for (const char of swizzle) {
    const charSet = getComponentSet(char);
    if (!charSet) {
      return {
        valid: false,
        resultType: null,
        indices: [],
        error: `Invalid swizzle component '${char}'`,
      };
    }

    if (charSet !== firstSet) {
      return {
        valid: false,
        resultType: null,
        indices: [],
        error: `Cannot mix swizzle sets (e.g., 'x' with 'r'). Use only ${firstSet.slice(0, vectorSize).join(', ')} or only ${charSet.slice(0, vectorSize).join(', ')}`,
      };
    }

    const index = COMPONENT_TO_INDEX[char as SwizzleComponent];
    if (index > maxIndex) {
      const availableComponents = firstSet.slice(0, vectorSize).join(', ');
      return {
        valid: false,
        resultType: null,
        indices: [],
        error: `vec${vectorSize} has no component '${char}'. Available components: ${availableComponents}`,
      };
    }

    indices.push(index);
  }

  return { valid: true, resultType: null, indices };
}

export function validateSwizzle(sourceType: VectorType, swizzle: string): SwizzleResult {
  const validation = isValidSwizzle(swizzle, sourceType.size);

  if (!validation.valid) {
    return validation;
  }

  const resultSize = swizzle.length;

  if (resultSize === 1) {
    return {
      valid: true,
      resultType: { kind: 'primitive', name: sourceType.elementType },
      indices: validation.indices,
    };
  }

  return {
    valid: true,
    resultType: {
      kind: 'vector',
      size: resultSize as 2 | 3 | 4,
      elementType: sourceType.elementType,
    },
    indices: validation.indices,
  };
}

export function generateAllSwizzles(vectorSize: 2 | 3 | 4): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const components = XYZW_COMPONENTS.slice(0, vectorSize);

  for (let len = 1; len <= 4; len++) {
    generateCombinations(components as unknown as string[], len, (swizzle, indices) => {
      result.set(swizzle, indices);
    });
  }

  return result;
}

function generateCombinations(
  components: string[],
  length: number,
  callback: (swizzle: string, indices: number[]) => void
): void {
  const count = components.length;
  const indices = new Array<number>(length).fill(0);

  function generate(pos: number, current: string): void {
    if (pos === length) {
      callback(current, [...indices]);
      return;
    }

    for (let i = 0; i < count; i++) {
      indices[pos] = i;
      generate(pos + 1, current + components[i]);
    }
  }

  generate(0, '');
}

export function getSwizzleResultType(sourceType: WGSLType, swizzle: string): WGSLType | null {
  if (sourceType.kind !== 'vector') {
    return null;
  }

  const result = validateSwizzle(sourceType, swizzle);
  return result.valid ? result.resultType : null;
}

export function isWritableSwizzle(swizzle: string): boolean {
  const seen = new Set<string>();
  for (const char of swizzle) {
    if (seen.has(char)) {
      return false;
    }
    seen.add(char);
  }
  return true;
}

export const ALL_VEC2_SWIZZLES = generateAllSwizzles(2);
export const ALL_VEC3_SWIZZLES = generateAllSwizzles(3);
export const ALL_VEC4_SWIZZLES = generateAllSwizzles(4);
