import type {
  Shader3DAST,
  TypeDefinition,
  ShaderDefinition,
  TypeReference,
  SourceLocation,
  Parameter
} from './ast'
import type { ValidationError, ValidationSeverity } from './validator'

/**
 * Strict mode levels (like TypeScript's strictness ladder)
 */
export type StrictLevel = 
  | 'off'           // No type checking
  | 'basic'         // Basic type inference
  | 'standard'      // Standard checks (default)
  | 'strict'        // All strict checks
  | 'pedantic'      // Maximum strictness

/**
 * Strict mode options (like tsconfig.json)
 */
export interface StrictModeOptions {
  /** Overall strict level */
  level?: StrictLevel
  
  /** Individual flags (like TypeScript) */
  noImplicitAny?: boolean
  strictNullChecks?: boolean
  strictPropertyInitialization?: boolean
  noUnusedLocals?: boolean
  noUnusedParameters?: boolean
  noImplicitReturns?: boolean
  noFallthroughCasesInSwitch?: boolean
  
  /** Shader3D-specific */
  strictAlignment?: boolean      // Enforce proper byte alignment
  strictBindings?: boolean       // Enforce explicit @group/@binding
  strictWorkgroupSize?: boolean  // Validate workgroup size limits
  noImplicitFloat?: boolean      // Require f32 suffix on literals
}

/**
 * Type inference result
 */
export interface InferredType {
  type: TypeReference
  confidence: 'certain' | 'inferred' | 'unknown'
  source?: string
}

/**
 * Strict mode type checker
 */
export class StrictModeChecker {
  private options: StrictModeOptions
  private errors: ValidationError[] = []
  private typeMap: Map<string, TypeDefinition> = new Map()
  private inferredTypes: Map<string, InferredType> = new Map()

  constructor(options: StrictModeOptions = {}) {
    this.options = this.expandLevel(options)
  }

  /**
   * Expand strict level to individual flags
   */
  private expandLevel(options: StrictModeOptions): StrictModeOptions {
    const level = options.level || 'standard'
    
    const levelDefaults: Record<StrictLevel, Partial<StrictModeOptions>> = {
      'off': {},
      'basic': {
        noImplicitAny: false,
        strictNullChecks: false,
      },
      'standard': {
        noImplicitAny: true,
        strictNullChecks: false,
        noUnusedLocals: true,
      },
      'strict': {
        noImplicitAny: true,
        strictNullChecks: true,
        strictPropertyInitialization: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        strictAlignment: true,
        strictBindings: true,
      },
      'pedantic': {
        noImplicitAny: true,
        strictNullChecks: true,
        strictPropertyInitialization: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        strictAlignment: true,
        strictBindings: true,
        strictWorkgroupSize: true,
        noImplicitFloat: true,
      }
    }

    return { ...levelDefaults[level], ...options }
  }

  /**
   * Check AST with strict mode rules
   */
  check(ast: Shader3DAST): ValidationError[] {
    this.errors = []
    this.typeMap.clear()
    this.inferredTypes.clear()

    // Build type map
    ast.sharedTypes.forEach(type => {
      this.typeMap.set(type.name, type)
    })

    // Check each shader
    ast.gpuShaders.forEach(shader => {
      this.checkShader(shader)
    })

    return this.errors
  }

  private checkShader(shader: ShaderDefinition): void {
    // Check parameters
    shader.parameters.forEach(param => {
      this.checkParameter(param, shader)
    })

    // Check for implicit returns
    if (this.options.noImplicitReturns && shader.returnType) {
      this.checkReturns(shader)
    }

    // Check workgroup size
    if (this.options.strictWorkgroupSize && shader.stage === 'compute') {
      this.checkWorkgroupSize(shader)
    }

    // Check bindings
    if (this.options.strictBindings) {
      this.checkBindings(shader)
    }

    // Parse and check body
    this.checkBody(shader)
  }

  private checkParameter(param: Parameter, shader: ShaderDefinition): void {
    // Check for implicit any
    if (this.options.noImplicitAny) {
      if (param.type.kind === 'primitive' && param.type.name === 'number') {
        this.addError('error', 
          `Parameter '${param.name}' has implicit 'number' type. Use explicit 'f32', 'i32', or 'u32'.`,
          param.location, 'S001')
      }
    }

    // Check for unused parameters
    if (this.options.noUnusedParameters) {
      const bodyStr = shader.body.toLowerCase()
      const paramName = param.name.toLowerCase()
      
      // Simple check - could be improved with proper AST analysis
      if (!bodyStr.includes(paramName)) {
        this.addError('warning',
          `Parameter '${param.name}' is declared but never used`,
          param.location, 'S002')
      }
    }
  }

  private checkReturns(shader: ShaderDefinition): void {
    const body = shader.body
    
    // Simple return path analysis
    const hasReturn = /\breturn\b/.test(body)
    
    if (!hasReturn && shader.returnType) {
      this.addError('error',
        `Shader '${shader.name}' has return type but no return statement`,
        shader.location, 'S003')
    }

    // Check for early returns without value
    const emptyReturns = body.match(/\breturn\s*;/g)
    if (emptyReturns && shader.returnType) {
      this.addError('error',
        `Shader '${shader.name}' has empty return statement but expects ${this.typeToString(shader.returnType.type)}`,
        shader.location, 'S004')
    }
  }

  private checkWorkgroupSize(shader: ShaderDefinition): void {
    const size = shader.workgroupSize || [64]
    const total: number = size.reduce((a: number, b) => a * (b || 1), 1 as number)

    // Common limits
    if (total > 1024) {
      this.addError('error',
        `Workgroup size ${total} exceeds maximum of 1024`,
        shader.location, 'S005')
    }

    // Per-dimension limits
    size.forEach((dim, i) => {
      if (dim && dim > 1024) {
        const dims = ['X', 'Y', 'Z']
        this.addError('error',
          `Workgroup dimension ${dims[i]} (${dim}) exceeds maximum of 1024`,
          shader.location, 'S006')
      }
    })

    // Recommend power of 2
    if (total > 0 && (total & (total - 1)) !== 0) {
      this.addError('info',
        `Workgroup size ${total} is not a power of 2. Consider using 64, 128, or 256 for better performance.`,
        shader.location, 'S007')
    }
  }

  private checkBindings(shader: ShaderDefinition): void {
    // Check that all storage/uniform parameters have explicit bindings
    shader.parameters.forEach(param => {
      const hasBinding = param.attributes.some(a => a.name === 'binding')
      const _hasGroup = param.attributes.some(a => a.name === 'group')
      const isBuiltin = param.attributes.some(a => a.name === 'builtin')
      const isLocation = param.attributes.some(a => a.name === 'location')

      if (!isBuiltin && !isLocation && !hasBinding) {
        // This might be a resource that needs binding
        if (param.type.kind === 'pointer' || 
            param.type.kind === 'texture' || 
            param.type.kind === 'sampler') {
          this.addError('error',
            `Resource parameter '${param.name}' requires @binding attribute`,
            param.location, 'S008')
        }
      }
    })
  }

  private checkBody(shader: ShaderDefinition): void {
    const body = shader.body

    // Check for implicit float literals
    if (this.options.noImplicitFloat) {
      // Match numbers without f suffix in non-integer contexts
      const floatLiterals = body.match(/(?<![a-zA-Z_])(\d+\.\d+)(?![fui])/g)
      if (floatLiterals && floatLiterals.length > 0) {
        this.addError('info',
          `${floatLiterals.length} float literal(s) without explicit 'f' suffix found`,
          shader.location, 'S009',
          'Consider using 1.0f instead of 1.0 for clarity')
      }
    }

    // Check for unused locals (simple pattern matching)
    if (this.options.noUnusedLocals) {
      // Match variable declarations
      const varDecls = body.matchAll(/\b(var|let)\s+(\w+)/g)
      for (const match of varDecls) {
        const varName = match[2]
        // Count occurrences (should be more than just the declaration)
        const regex = new RegExp(`\\b${varName}\\b`, 'g')
        const occurrences = (body.match(regex) || []).length
        
        if (occurrences === 1) {
          this.addError('warning',
            `Variable '${varName}' is declared but never used`,
            shader.location, 'S010')
        }
      }
    }

    // Check alignment issues
    if (this.options.strictAlignment) {
      this.checkAlignmentInBody(shader)
    }
  }

  private checkAlignmentInBody(shader: ShaderDefinition): void {
    // Check for potential alignment issues with vec3
    const body = shader.body
    
    // Look for array access patterns that might have alignment issues
    const vec3ArrayPattern = /array\s*<\s*vec3/g
    if (vec3ArrayPattern.test(body)) {
      this.addError('warning',
        `Array of vec3 detected. vec3 has 16-byte alignment which may cause padding issues.`,
        shader.location, 'S011',
        'Consider using array<vec4> and ignoring the w component')
    }
  }

  private typeToString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive': return type.name
      case 'vector': return `vec${type.size}<${type.elementType}>`
      case 'matrix': return `mat${type.rows}x${type.cols}`
      case 'array': return `array<${this.typeToString(type.elementType)}>`
      case 'custom': return type.name
      default: return 'unknown'
    }
  }

  private addError(
    severity: ValidationSeverity,
    message: string,
    location?: SourceLocation,
    code: string = 'S000',
    suggestion?: string
  ): void {
    this.errors.push({ severity, message, location, code, suggestion })
  }
}

/**
 * Run strict mode checks on AST
 */
export function checkStrictMode(ast: Shader3DAST, options?: StrictModeOptions): ValidationError[] {
  const checker = new StrictModeChecker(options)
  return checker.check(ast)
}

/**
 * Get default strict mode options for a level
 */
export function getStrictModeDefaults(level: StrictLevel): StrictModeOptions {
  return new StrictModeChecker({ level })['options']
}

/**
 * Parse strict mode from magic comment
 * e.g., // @shader3d-strict
 * e.g., // @shader3d-strict noImplicitAny
 */
export function parseStrictModeComment(comment: string): StrictModeOptions | null {
  const match = comment.match(/@shader3d-(strict|typed)(?:\s+(.+))?/)
  if (!match) return null

  const options: StrictModeOptions = { level: 'strict' }
  
  if (match[2]) {
    const flags = match[2].split(/\s+/)
    flags.forEach(flag => {
      if (flag in options) {
        (options as any)[flag] = true
      }
    })
  }

  return options
}
