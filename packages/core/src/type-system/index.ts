export {
  TypeRegistry,
  globalRegistry,
  type TypeInfo,
  type ScalarType,
  type VectorSize,
  type MatrixDim,
} from './type-registry';
export {
  validateSwizzle,
  getSwizzleResultType,
  isWritableSwizzle,
  generateAllSwizzles,
  ALL_VEC2_SWIZZLES,
  ALL_VEC3_SWIZZLES,
  ALL_VEC4_SWIZZLES,
  type SwizzleResult,
} from './swizzle';
export {
  inferType,
  createContext,
  addVariable,
  addFunction,
  addStruct,
  type InferenceContext,
  type InferenceResult,
  type InferenceError,
  type TypeConstraint,
} from './type-inference';
export {
  TypeChecker,
  typeCheck,
  type TypeCheckResult,
  type TypeCheckOptions,
} from './type-checking';
