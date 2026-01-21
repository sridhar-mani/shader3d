export { Shader3DRuntime } from './base'
export type { BufferDescriptor, TextureDescriptor } from './base'

// WebGPU runtime
export { 
  WebGPURuntime, 
  initWebGPU, 
  isWebGPUSupported, 
  getAdapterInfo 
} from './webgpu'
export type { RenderPassConfig, BuiltinUniforms } from './webgpu'

// Three.js adapter
export {
  ThreeJSAdapter,
  createThreeJSAdapter,
  createFullscreenQuadVertices,
  createFullscreenQuadUVs,
  convertShadertoyFragment,
  FULLSCREEN_VERTEX_SHADER,
  THREE_SHADER_CHUNKS
} from './threejs'
export type { ThreeJSAdapterOptions, UniformDescriptor } from './threejs'

// Version
export const VERSION = '0.1.0'
