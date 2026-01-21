import { parse } from './parser'
import type { ParseOptions } from './parser'
import { generateWGSL } from './codegen-wgsl'
import type { WGSLCodeGenOptions } from './codegen-wgsl'
import { generateJS } from './codegen-js'
import type { JSCodeGenOptions } from './codegen-js'
import { generateGLSLVertex, generateGLSLFragment } from './codegen-glsl'
import type { GLSLCodeGenOptions } from './codegen-glsl'
import type { Shader3DAST } from './ast'
import { validate, hasErrors } from './validator'
import type { ValidationError, ValidationOptions } from './validator'
import { checkStrictMode, parseStrictModeComment } from './strict-mode'
import type { StrictModeOptions } from './strict-mode'
import { SourceMapGenerator, appendSourceMap } from './source-maps'
import type { SourceMapV3 } from './source-maps'

/**
 * Transpile options combining all sub-options
 */
export interface TranspileOptions {
  /** Validation options */
  validate?: boolean | ValidationOptions
  
  /** Generate source maps */
  sourceMap?: boolean
  
  /** WGSL code generation options */
  wgsl?: WGSLCodeGenOptions
  
  /** JavaScript code generation options */
  js?: JSCodeGenOptions
  
  /** GLSL code generation options (for WebGL fallback) */
  glsl?: GLSLCodeGenOptions
  
  /** Strict mode options */
  strict?: boolean | StrictModeOptions
  
  /** Target outputs */
  targets?: ('wgsl' | 'js' | 'glsl')[]
  
  /** Include debug comments in output */
  debug?: boolean
}

/**
 * Transpile result
 */
export interface TranspileResult {
  /** Generated JavaScript/TypeScript code */
  js: string
  
  /** Generated WGSL code */
  wgsl: string
  
  /** Generated GLSL vertex shader (if requested) */
  glslVertex?: string
  
  /** Generated GLSL fragment shader (if requested) */
  glslFragment?: string
  
  /** Parsed AST */
  ast: Shader3DAST
  
  /** Validation and strict mode errors */
  errors?: ValidationError[]
  
  /** Source map (if requested) */
  sourceMap?: SourceMapV3
  
  /** Compilation stats */
  stats?: {
    parseTime: number
    validateTime: number
    generateTime: number
    totalTime: number
  }
}

/**
 * Main Shader3D Transpiler class
 */
export class Shader3DTranspiler {
  private defaultOptions: TranspileOptions

  constructor(options: TranspileOptions = {}) {
    this.defaultOptions = options
  }

  /**
   * Transpile source code to all outputs
   */
  transpile(source: string, filename: string, options?: TranspileOptions): TranspileResult {
    const opts = { ...this.defaultOptions, ...options }
    const startTime = performance.now()
    const stats = { parseTime: 0, validateTime: 0, generateTime: 0, totalTime: 0 }

    // 1. Parse source to AST
    const parseStart = performance.now()
    const ast = parse(source, filename, {
      sourceLocations: opts.sourceMap
    })
    stats.parseTime = performance.now() - parseStart

    // 2. Check for strict mode comments in source
    const strictMatch = source.match(/\/\/\s*@shader3d-(strict|typed).*/)
    let strictOptions = opts.strict
    if (strictMatch) {
      const parsed = parseStrictModeComment(strictMatch[0])
      if (parsed) {
        strictOptions = typeof opts.strict === 'object' 
          ? { ...parsed, ...opts.strict }
          : parsed
      }
    }

    // 3. Validate AST
    const validateStart = performance.now()
    const errors: ValidationError[] = []
    
    if (opts.validate !== false) {
      const validationOptions = typeof opts.validate === 'object' ? opts.validate : {}
      errors.push(...validate(ast, validationOptions))
    }

    // 4. Run strict mode checks
    if (strictOptions) {
      const strictOpts = typeof strictOptions === 'object' ? strictOptions : { level: 'strict' as const }
      errors.push(...checkStrictMode(ast, strictOpts))
    }
    stats.validateTime = performance.now() - validateStart

    // Check for critical errors
    if (hasErrors(errors)) {
      return {
        js: '',
        wgsl: '',
        ast,
        errors,
        stats
      }
    }

    // 5. Generate output code
    const generateStart = performance.now()
    
    // Generate WGSL
    const wgslOptions: WGSLCodeGenOptions = {
      debug: opts.debug,
      ...opts.wgsl
    }
    const wgsl = generateWGSL(ast, wgslOptions)

    // Generate JavaScript
    const jsOptions: JSCodeGenOptions = {
      ...opts.js
    }
    let js = generateJS(ast, wgsl, jsOptions)

    // Generate GLSL (if requested)
    let glslVertex: string | undefined
    let glslFragment: string | undefined
    const targets = opts.targets || ['wgsl', 'js']
    
    if (targets.includes('glsl')) {
      const glslOptions = opts.glsl || {}
      glslVertex = generateGLSLVertex(ast, glslOptions)
      glslFragment = generateGLSLFragment(ast, glslOptions)
    }

    stats.generateTime = performance.now() - generateStart

    // 6. Generate source map
    let sourceMap: SourceMapV3 | undefined
    if (opts.sourceMap) {
      sourceMap = this.generateSourceMap(ast, filename, wgsl, js)
      js = appendSourceMap(js, sourceMap)
    }

    stats.totalTime = performance.now() - startTime

    return {
      js,
      wgsl,
      glslVertex,
      glslFragment,
      ast,
      errors: errors.length > 0 ? errors : undefined,
      sourceMap,
      stats
    }
  }

  /**
   * Transpile and return only JavaScript
   */
  transpileToJS(source: string, filename: string, options?: TranspileOptions): string {
    const result = this.transpile(source, filename, options)
    
    if (hasErrors(result.errors || [])) {
      throw new Error(`Compilation failed:\n${this.formatErrors(result.errors!)}`)
    }
    
    return result.js
  }

  /**
   * Transpile and return only WGSL
   */
  transpileToWGSL(source: string, filename: string, options?: TranspileOptions): string {
    const result = this.transpile(source, filename, options)
    
    if (hasErrors(result.errors || [])) {
      throw new Error(`Compilation failed:\n${this.formatErrors(result.errors!)}`)
    }
    
    return result.wgsl
  }

  /**
   * Generate source map for transpilation
   */
  private generateSourceMap(
    ast: Shader3DAST, 
    filename: string, 
    _wgsl: string, 
    _js: string
  ): SourceMapV3 {
    const generator = new SourceMapGenerator(filename.replace(/\.[^.]+$/, '.js'))
    
    // Add source content
    if (ast.source) {
      generator.addSource(ast.source.filename, ast.source.content)
    }

    // Map shader definitions to output
    let wgslLine = 1
    ast.gpuShaders.forEach(shader => {
      if (shader.location) {
        generator.addLocationMapping(wgslLine, 0, shader.location, shader.name)
      }
      // Estimate lines in output (rough approximation)
      const shaderLines = shader.body.split('\n').length + 5
      wgslLine += shaderLines
    })

    // Map type definitions
    ast.sharedTypes.forEach(type => {
      if (type.location) {
        generator.addLocationMapping(1, 0, type.location, type.name)
      }
    })

    return generator.generate()
  }

  /**
   * Format errors for display
   */
  private formatErrors(errors: ValidationError[]): string {
    return errors.map(err => {
      const loc = err.location 
        ? `${err.location.file}:${err.location.line}:${err.location.column}`
        : ''
      const prefix = `[${err.code}] ${err.severity.toUpperCase()}`
      return `${prefix} ${loc}\n  ${err.message}`
    }).join('\n\n')
  }
}

// Singleton instance
const defaultTranspiler = new Shader3DTranspiler()

/**
 * Transpile source code (convenience function)
 */
export function transpile(source: string, filename: string, options?: TranspileOptions): TranspileResult {
  return defaultTranspiler.transpile(source, filename, options)
}

/**
 * Transpile to JavaScript only
 */
export function transpileToJS(source: string, filename: string, options?: TranspileOptions): string {
  return defaultTranspiler.transpileToJS(source, filename, options)
}

/**
 * Transpile to WGSL only
 */
export function transpileToWGSL(source: string, filename: string, options?: TranspileOptions): string {
  return defaultTranspiler.transpileToWGSL(source, filename, options)
}

/**
 * Create a new transpiler instance with custom defaults
 */
export function createTranspiler(options?: TranspileOptions): Shader3DTranspiler {
  return new Shader3DTranspiler(options)
}
