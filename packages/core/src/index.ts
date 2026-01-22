// @shader3d/core - Main entry point
// Write shaders like TypeScript, compile to WGSL, run at native GPU speed

// Re-export all types
export type {
  // AST Types
  Program,
  FunctionDeclaration,
  VariableDeclaration,
  StructDeclaration,
  Statement,
  Expression,
  Parameter,
  Decorator,

  // Type System
  WGSLType,
  PrimitiveType,
  VectorType,
  MatrixType,
  ArrayType,
  StructType,
  SamplerType,
  TextureType,

  // Compiler Types
  CompilerOptions,
  CompileResult,
  SourceMap,
  ShaderMetadata,
  Diagnostic,
  DiagnosticSeverity,
  UniformBinding,
} from './types';

// Re-export parser
export { parse, Lexer, Parser, BUILTIN_FUNCTIONS, MATH_MAPPING, TYPE_MAP } from './parser';

// Re-export transformer
export type { WGSLIR, WGSLFunction, WGSLStruct, WGSLUniform, WGSLEntryPoint } from './transformer';
export { transform, Transformer } from './transformer';

// Re-export analyzer
export type { AnalysisResult, PerformanceHint, AnalysisMetadata } from './analyzer';
export { analyze, Analyzer, constantFold, deadCodeElimination } from './analyzer';

// Re-export code generator
export type { CodeGenResult, CodeGenOptions } from './codegen';
export {
  generate,
  CodeGenerator,
  generateFullscreenVertexShader,
  generateUniformBuffer,
} from './codegen';

// Re-export standard library
export {
  stdlib,
  noiseLibrary,
  colorLibrary,
  sdfLibrary,
  filterLibrary,
  easingLibrary,
  getAllStdlib,
  getStdlibFunction,
  extractRequiredStdlib,
} from './stdlib';

import type { CompilerOptions, CompileResult, Diagnostic } from './types';
import { parse } from './parser';
import { transform } from './transformer';
import { analyze, constantFold, deadCodeElimination } from './analyzer';
import { generate } from './codegen';
import { extractRequiredStdlib } from './stdlib';

/**
 * Default compiler options
 */
export const DEFAULT_OPTIONS: CompilerOptions = {
  target: 'webgpu',
  mode: 'development',
  sourceMaps: true,
  strictMode: false,
  optimizations: {
    deadCodeElimination: true,
    constantFolding: true,
    inlining: false,
  },
};

/**
 * Compile TypeScript/JavaScript shader code to WGSL
 *
 * @param source - The source code to compile
 * @param options - Compiler options
 * @returns The compilation result including WGSL code and metadata
 *
 * @example
 * ```typescript
 * import { compile } from '@shader3d/core'
 *
 * const result = compile(`
 *   @fragment
 *   function main(@builtin(position) pos: vec4f): @location(0) vec4f {
 *     return vec4f(pos.xy / resolution, 0.5, 1.0);
 *   }
 * `)
 *
 * console.log(result.code) // WGSL output
 * ```
 */
export function compile(source: string, options: Partial<CompilerOptions> = {}): CompileResult {
  const opts: CompilerOptions = { ...DEFAULT_OPTIONS, ...options };
  const allDiagnostics: Diagnostic[] = [];

  // Phase 1: Parse
  const { ast, diagnostics: parseDiagnostics } = parse(source);
  allDiagnostics.push(...parseDiagnostics);

  // Check for parse errors
  const hasParseErrors = parseDiagnostics.some((d) => d.severity === 'error');
  if (hasParseErrors) {
    return {
      code: '',
      metadata: {
        entryPoints: [],
        bindings: [],
        structs: [],
      },
      diagnostics: allDiagnostics,
    };
  }

  // Phase 2: Transform to IR
  const { ir, diagnostics: transformDiagnostics } = transform(ast);
  allDiagnostics.push(...transformDiagnostics);

  // Phase 3: Analyze
  const analysisResult = analyze(ir);
  allDiagnostics.push(...analysisResult.diagnostics);

  // Phase 4: Optimize (if enabled)
  let optimizedIR = analysisResult.ir;
  if (opts.optimizations?.constantFolding) {
    optimizedIR = constantFold(optimizedIR);
  }
  if (opts.optimizations?.deadCodeElimination) {
    optimizedIR = deadCodeElimination(optimizedIR);
  }

  // Phase 5: Generate WGSL
  const { code, sourceMap, metadata } = generate(optimizedIR, {
    minify: opts.mode === 'production',
    comments: opts.mode === 'development',
    sourceMaps: opts.sourceMaps,
  });

  // Add stdlib if needed
  const stdlibCode = extractRequiredStdlib(code);
  const finalCode = stdlibCode ? `${stdlibCode}\n\n${code}` : code;

  return {
    code: finalCode,
    sourceMap: opts.sourceMaps ? sourceMap : undefined,
    metadata,
    diagnostics: allDiagnostics,
  };
}

/**
 * Transpile is an alias for compile
 * @deprecated Use compile() instead
 */
export const transpile = compile;

/**
 * Check if source code is valid shader syntax
 */
export function validate(source: string): { valid: boolean; diagnostics: Diagnostic[] } {
  const { diagnostics } = parse(source);
  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return { valid: !hasErrors, diagnostics };
}

/**
 * Format WGSL code for readability
 */
export function format(wgslCode: string): string {
  // Simple formatter: normalize whitespace and indentation
  let depth = 0;
  const lines = wgslCode.split('\n');
  const formatted: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Decrease depth for closing braces
    if (line.startsWith('}')) depth = Math.max(0, depth - 1);

    // Add indentation
    formatted.push('    '.repeat(depth) + line);

    // Increase depth for opening braces
    if (line.endsWith('{')) depth++;
  }

  return formatted.join('\n');
}

/**
 * Minify WGSL code
 */
export function minify(wgslCode: string): string {
  return wgslCode
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}\[\](),:;=+\-*/<>])\s*/g, '$1')
    .trim();
}

/**
 * Get version info
 */
export function version(): string {
  return '0.1.0'; // TODO: Read from package.json
}
