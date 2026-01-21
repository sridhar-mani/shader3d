// Source location for error reporting
export interface SourceLocation {
  file: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

/**
 * WGSL Attributes like @builtin(position), @location(0), @binding(1)
 */
export interface Attribute {
  name: string
  value?: string
}

/**
 * Type reference in the AST
 */
export type TypeReference =
  | { kind: 'primitive'; name: 'f32' | 'i32' | 'u32' | 'bool' | 'number' | 'boolean' }
  | { kind: 'vector'; size: 2 | 3 | 4; elementType: 'f32' | 'i32' | 'u32' | 'bool' }
  | { kind: 'matrix'; rows: number; cols: number; elementType: 'f32' }
  | { kind: 'array'; elementType: TypeReference; size?: number }
  | { kind: 'custom'; name: string }
  | { kind: 'texture'; textureType: 'texture_2d' | 'texture_3d' | 'texture_cube' | 'texture_storage_2d'; sampleType?: string }
  | { kind: 'sampler'; samplerType: 'sampler' | 'sampler_comparison' }
  | { kind: 'pointer'; addressSpace: 'function' | 'private' | 'workgroup' | 'uniform' | 'storage'; elementType: TypeReference; accessMode?: 'read' | 'write' | 'read_write' }

/**
 * Field in a struct
 */
export interface Field {
  name: string
  type: TypeReference
  attributes?: Attribute[]
  location?: SourceLocation
}

/**
 * Shader stage types
 */
export type ShaderStage = 'compute' | 'vertex' | 'fragment'

/**
 * Function/shader parameter
 */
export interface Parameter {
  name: string
  type: TypeReference
  attributes: Attribute[]
  location?: SourceLocation
}

/**
 * Type/struct definition
 */
export interface TypeDefinition {
  kind: 'struct' | 'alias'
  name: string
  fields: Field[]
  location?: SourceLocation
}

/**
 * Class property (CPU-side)
 */
export interface Property {
  name: string
  type: TypeReference
  initializer?: string
  location?: SourceLocation
}

/**
 * Class method (CPU-side)
 */
export interface Method {
  name: string
  parameters: Parameter[]
  returnType?: TypeReference
  body: string
  location?: SourceLocation
}

/**
 * Class definition (CPU-side)
 */
export interface ClassDefinition {
  name: string
  properties: Property[]
  methods: Method[]
  location?: SourceLocation
}

/**
 * Shader function definition (GPU-side)
 */
export interface ShaderDefinition {
  stage: ShaderStage
  name: string
  parameters: Parameter[]
  returnType?: {
    type: TypeReference
    attributes: Attribute[]
  }
  body: string
  attributes: Attribute[]
  location?: SourceLocation
  // Workgroup size for compute shaders
  workgroupSize?: [number, number?, number?]
}

/**
 * Import statement
 */
export interface ImportStatement {
  source: string
  specifiers: string[]
  isDefault?: boolean
  namespace?: string
}

/**
 * Global variable/uniform declaration
 */
export interface GlobalDeclaration {
  name: string
  type: TypeReference
  group?: number
  binding?: number
  addressSpace?: 'uniform' | 'storage' | 'private' | 'workgroup'
  accessMode?: 'read' | 'write' | 'read_write'
  initialValue?: string
  location?: SourceLocation
}

/**
 * Built-in uniform (auto-injected by Shader3D)
 */
export interface BuiltinUniform {
  name: string
  type: TypeReference
  description: string
}

/**
 * Complete Shader3D AST
 */
export interface Shader3DAST {
  // Imports from other modules
  imports: ImportStatement[]
  
  // Shared type definitions (structs used by both CPU and GPU)
  sharedTypes: TypeDefinition[]
  
  // CPU-side class definitions
  cpuClasses: ClassDefinition[]
  
  // GPU shader definitions
  gpuShaders: ShaderDefinition[]
  
  // Global declarations (uniforms, storage buffers)
  globals?: GlobalDeclaration[]
  
  // Source file info
  source?: {
    filename: string
    content: string
  }
}

/**
 * Built-in uniforms that Shader3D auto-injects (Shadertoy-compatible)
 */
export const BUILTIN_UNIFORMS: BuiltinUniform[] = [
  { name: 'time', type: { kind: 'primitive', name: 'f32' }, description: 'Elapsed time in seconds' },
  { name: 'deltaTime', type: { kind: 'primitive', name: 'f32' }, description: 'Time since last frame' },
  { name: 'frame', type: { kind: 'primitive', name: 'u32' }, description: 'Frame counter' },
  { name: 'resolution', type: { kind: 'vector', size: 2, elementType: 'f32' }, description: 'Canvas size in pixels' },
  { name: 'mouse', type: { kind: 'vector', size: 4, elementType: 'f32' }, description: 'Mouse position (xy: current, zw: click)' },
]

/**
 * ShaderPark-style SDF primitives
 */
export type SDFPrimitive = 
  | 'sphere' | 'box' | 'torus' | 'cylinder' | 'cone' | 'plane'
  | 'capsule' | 'ellipsoid' | 'octahedron' | 'pyramid'

/**
 * SDF operations
 */
export type SDFOperation = 
  | 'union' | 'subtract' | 'intersect' 
  | 'smoothUnion' | 'smoothSubtract' | 'smoothIntersect'
  | 'round' | 'onion'

/**
 * SDF transform functions
 */
export type SDFTransform = 
  | 'translate' | 'rotate' | 'rotateX' | 'rotateY' | 'rotateZ'
  | 'scale' | 'mirror' | 'twist' | 'bend'
