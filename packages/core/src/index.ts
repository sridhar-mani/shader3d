// AST Types
export * from './ast'

// Parser
export { parse, createParser, Shader3DParser } from './parser'
export type { ParseOptions } from './parser'

// Code Generators
export { generateWGSL, WGSLCodeGenerator, compileToWGSL } from './codegen-wgsl'
export type { WGSLCodeGenOptions } from './codegen-wgsl'

export { generateJS, JSCodeGenerator } from './codegen-js'
export type { JSCodeGenOptions } from './codegen-js'

export { generateGLSLVertex, generateGLSLFragment, generateThreeJSShader, GLSLCodeGenerator } from './codegen-glsl'
export type { GLSLCodeGenOptions } from './codegen-glsl'

// Validator
export { validate, hasErrors, formatValidationErrors, Shader3DValidator } from './validator'
export type { ValidationError, ValidationSeverity, ValidationOptions } from './validator'

// Strict Mode
export { checkStrictMode, getStrictModeDefaults, parseStrictModeComment, StrictModeChecker } from './strict-mode'
export type { StrictLevel, StrictModeOptions } from './strict-mode'

// Source Maps
export { 
  SourceMapGenerator, 
  createSourceMapGenerator, 
  mergeSourceMaps, 
  appendSourceMap 
} from './source-maps'
export type { SourcePosition, SourceMapping, SourceMapV3 } from './source-maps'

// Main Transpiler API
export { 
  transpile, 
  transpileToJS, 
  transpileToWGSL, 
  createTranspiler,
  Shader3DTranspiler 
} from './transpiler'
export type { TranspileOptions, TranspileResult } from './transpiler'

// Version
export const VERSION = '0.1.0'

// Default export for convenience
import { transpile, transpileToJS, transpileToWGSL } from './transpiler'
export default {
  transpile,
  transpileToJS,
  transpileToWGSL,
  VERSION: '0.1.0'
}
