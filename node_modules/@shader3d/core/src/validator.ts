import type {
  Shader3DAST,
  TypeDefinition,
  ShaderDefinition,
  TypeReference,
  SourceLocation,
  Field,
  Parameter
} from './ast'

/**
 * Validation error severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/**
 * Validation error/warning
 */
export interface ValidationError {
  severity: ValidationSeverity
  message: string
  location?: SourceLocation
  code: string
  suggestion?: string
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Enable strict mode (more checks) */
  strict?: boolean
  /** Check for performance issues */
  performance?: boolean
  /** Check for WebGPU compatibility */
  webgpuCompat?: boolean
}

/**
 * Known WGSL built-in types
 */
const WGSL_PRIMITIVES = new Set(['f32', 'i32', 'u32', 'bool', 'f16'])
const WGSL_BUILTINS = new Set([
  'vertex_index', 'instance_index', 'position', 'front_facing', 'frag_depth',
  'local_invocation_id', 'local_invocation_index', 'global_invocation_id',
  'workgroup_id', 'num_workgroups', 'sample_index', 'sample_mask'
])

/**
 * Shader3D AST Validator
 */
export class Shader3DValidator {
  private errors: ValidationError[] = []
  private options: ValidationOptions
  private typeMap: Map<string, TypeDefinition> = new Map()

  constructor(options: ValidationOptions = {}) {
    this.options = {
      strict: false,
      performance: true,
      webgpuCompat: true,
      ...options
    }
  }

  validate(ast: Shader3DAST): ValidationError[] {
    this.errors = []
    this.typeMap.clear()

    // Build type map
    ast.sharedTypes.forEach(type => {
      this.typeMap.set(type.name, type)
    })

    // Validate types
    ast.sharedTypes.forEach(type => this.validateType(type))

    // Validate shaders
    ast.gpuShaders.forEach(shader => this.validateShader(shader))

    // Validate globals
    if (ast.globals) {
      this.validateGlobals(ast.globals, ast.gpuShaders)
    }

    // Cross-validation
    this.validateCrossReferences(ast)

    return this.errors
  }

  private validateType(type: TypeDefinition): void {
    // Check for empty structs
    if (type.fields.length === 0) {
      this.addError('warning', `Struct '${type.name}' has no fields`, type.location, 'W001')
    }

    // Validate each field
    type.fields.forEach((field, index) => {
      this.validateField(field, type.name)

      // Check alignment for WebGPU
      if (this.options.webgpuCompat) {
        this.checkFieldAlignment(field, index, type)
      }
    })

    // Check for naming conventions
    if (this.options.strict && !/^[A-Z]/.test(type.name)) {
      this.addError('warning', `Type name '${type.name}' should start with uppercase`, type.location, 'W002',
        `Consider renaming to '${type.name.charAt(0).toUpperCase() + type.name.slice(1)}'`)
    }
  }

  private validateField(field: Field, structName: string): void {
    // Validate type reference
    if (!this.isValidType(field.type)) {
      this.addError('error', `Unknown type '${this.typeToString(field.type)}' in field '${field.name}' of struct '${structName}'`,
        field.location, 'E001')
    }

    // Check for reserved names
    if (WGSL_BUILTINS.has(field.name)) {
      this.addError('warning', `Field name '${field.name}' is a WGSL builtin name`, field.location, 'W003')
    }
  }

  private checkFieldAlignment(field: Field, _index: number, type: TypeDefinition): void {
    // Get alignment for potential future use
    this.getTypeAlignment(field.type)
    
    // vec3 alignment warning
    if (field.type.kind === 'vector' && field.type.size === 3) {
      this.addError('info', `vec3 in struct '${type.name}' has 16-byte alignment. Consider using vec4 or add padding.`,
        field.location, 'I001',
        'WGSL aligns vec3 to 16 bytes, which may cause unexpected padding')
    }
  }

  private validateShader(shader: ShaderDefinition): void {
    // Validate stage-specific requirements
    switch (shader.stage) {
      case 'vertex':
        this.validateVertexShader(shader)
        break
      case 'fragment':
        this.validateFragmentShader(shader)
        break
      case 'compute':
        this.validateComputeShader(shader)
        break
    }

    // Validate parameters
    shader.parameters.forEach(param => this.validateParameter(param, shader))

    // Check for undefined types in return
    if (shader.returnType && !this.isValidType(shader.returnType.type)) {
      this.addError('error', `Unknown return type '${this.typeToString(shader.returnType.type)}' in shader '${shader.name}'`,
        shader.location, 'E002')
    }
  }

  private validateVertexShader(shader: ShaderDefinition): void {
    // Must have @builtin(position) return or output
    const hasPositionOutput = shader.returnType?.attributes.some(
      a => a.name === 'builtin' && a.value === 'position'
    ) || shader.parameters.some(
      p => p.attributes.some(a => a.name === 'builtin' && a.value === 'position')
    )

    if (!hasPositionOutput && this.options.strict) {
      this.addError('warning', `Vertex shader '${shader.name}' should output @builtin(position)`,
        shader.location, 'W004')
    }
  }

  private validateFragmentShader(shader: ShaderDefinition): void {
    // Should have @location(0) output
    const hasOutput = shader.returnType?.attributes.some(
      a => a.name === 'location'
    )

    if (!hasOutput && this.options.strict) {
      this.addError('warning', `Fragment shader '${shader.name}' should have @location output`,
        shader.location, 'W005')
    }
  }

  private validateComputeShader(shader: ShaderDefinition): void {
    // Must have workgroup_size
    const hasWorkgroupSize = shader.workgroupSize || 
      shader.attributes.some(a => a.name === 'workgroup_size')

    if (!hasWorkgroupSize) {
      this.addError('error', `Compute shader '${shader.name}' must have @workgroup_size attribute`,
        shader.location, 'E003',
        'Add @workgroup_size(64) or similar')
    }

    // Performance: check workgroup size
    if (this.options.performance && shader.workgroupSize) {
      const total = shader.workgroupSize.reduce((a: number, b) => a * (b || 1), 1 as number)
      if (total < 32) {
        this.addError('info', `Workgroup size ${total} is small. Consider using at least 64 for better GPU utilization.`,
          shader.location, 'P001')
      }
      if (total > 256) {
        this.addError('warning', `Workgroup size ${total} may exceed device limits on some GPUs`,
          shader.location, 'W006')
      }
    }
  }

  private validateParameter(param: Parameter, _shader: ShaderDefinition): void {
    // Check type validity
    if (!this.isValidType(param.type)) {
      this.addError('error', `Unknown type '${this.typeToString(param.type)}' for parameter '${param.name}'`,
        param.location, 'E004')
    }

    // Check for @builtin validity
    const builtinAttr = param.attributes.find(a => a.name === 'builtin')
    if (builtinAttr && builtinAttr.value && !WGSL_BUILTINS.has(builtinAttr.value)) {
      this.addError('error', `Unknown builtin '${builtinAttr.value}' for parameter '${param.name}'`,
        param.location, 'E005')
    }

    // Check location uniqueness (done in cross-validation)
  }

  private validateGlobals(globals: any[], _shaders: ShaderDefinition[]): void {
    const bindingMap = new Map<string, { group: number; binding: number; location?: SourceLocation }>()

    globals.forEach(global => {
      const key = `${global.group}-${global.binding}`
      
      if (bindingMap.has(key)) {
        const existing = bindingMap.get(key)!
        this.addError('error', `Duplicate binding @group(${global.group}) @binding(${global.binding})`,
          global.location, 'E006',
          `Previously defined at line ${existing.location?.line}`)
      }
      
      bindingMap.set(key, { group: global.group, binding: global.binding, location: global.location })
    })
  }

  private validateCrossReferences(ast: Shader3DAST): void {
    // Check for unused types
    if (this.options.strict) {
      const usedTypes = new Set<string>()
      
      ast.gpuShaders.forEach(shader => {
        shader.parameters.forEach(p => {
          if (p.type.kind === 'custom') usedTypes.add(p.type.name)
        })
        if (shader.returnType?.type.kind === 'custom') {
          usedTypes.add(shader.returnType.type.name)
        }
      })

      ast.sharedTypes.forEach(type => {
        if (!usedTypes.has(type.name)) {
          this.addError('info', `Type '${type.name}' is defined but never used`,
            type.location, 'I002')
        }
      })
    }
  }

  private isValidType(type: TypeReference): boolean {
    switch (type.kind) {
      case 'primitive':
        return WGSL_PRIMITIVES.has(type.name) || type.name === 'number' || type.name === 'boolean'
      case 'vector':
        return type.size >= 2 && type.size <= 4
      case 'matrix':
        return type.rows >= 2 && type.rows <= 4 && type.cols >= 2 && type.cols <= 4
      case 'array':
        return this.isValidType(type.elementType)
      case 'custom':
        return this.typeMap.has(type.name)
      case 'texture':
      case 'sampler':
      case 'pointer':
        return true
      default:
        return false
    }
  }

  private getTypeAlignment(type: TypeReference): number {
    switch (type.kind) {
      case 'primitive': return 4
      case 'vector': return type.size === 2 ? 8 : 16
      case 'matrix': return 16
      case 'array': return this.getTypeAlignment(type.elementType)
      default: return 4
    }
  }

  private typeToString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive': return type.name
      case 'vector': return `vec${type.size}<${type.elementType}>`
      case 'matrix': return `mat${type.rows}x${type.cols}<${type.elementType}>`
      case 'array': return `array<${this.typeToString(type.elementType)}>`
      case 'custom': return type.name
      default: return 'unknown'
    }
  }

  private addError(
    severity: ValidationSeverity,
    message: string,
    location?: SourceLocation,
    code: string = 'E000',
    suggestion?: string
  ): void {
    this.errors.push({ severity, message, location, code, suggestion })
  }
}

/**
 * Validate a Shader3D AST
 */
export function validate(ast: Shader3DAST, options?: ValidationOptions): ValidationError[] {
  const validator = new Shader3DValidator(options)
  return validator.validate(ast)
}

/**
 * Quick check if AST has critical errors
 */
export function hasErrors(errors: ValidationError[]): boolean {
  return errors.some(e => e.severity === 'error')
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(err => {
    const loc = err.location ? `${err.location.file}:${err.location.line}:${err.location.column}` : ''
    const prefix = `[${err.code}] ${err.severity.toUpperCase()}`
    const suggestion = err.suggestion ? `\n  💡 ${err.suggestion}` : ''
    return `${prefix} ${loc}\n  ${err.message}${suggestion}`
  }).join('\n\n')
}
