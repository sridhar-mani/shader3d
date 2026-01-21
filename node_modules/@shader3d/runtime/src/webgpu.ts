import { Shader3DRuntime } from './base'
import type { BufferDescriptor } from './base'

/**
 * Render pass configuration
 */
export interface RenderPassConfig {
  clearColor?: { r: number; g: number; b: number; a: number }
  loadOp?: 'clear' | 'load'
  storeOp?: 'store' | 'discard'
  depthTexture?: GPUTexture
}

/**
 * Builtin uniforms (Shadertoy-compatible)
 */
export interface BuiltinUniforms {
  time: number
  deltaTime: number
  frame: number
  resolution: [number, number]
  mouse: [number, number, number, number]
}

/**
 * WebGPU Runtime for Shader3D
 * Provides canvas rendering, compute dispatch, and builtin uniforms
 */
export class WebGPURuntime extends Shader3DRuntime {
  private canvas?: HTMLCanvasElement
  private context?: GPUCanvasContext
  private format: GPUTextureFormat
  private builtinUniformBuffer?: GPUBuffer
  private depthTexture?: GPUTexture
  
  // Animation state
  private animationId?: number
  private startTime: number = 0
  private lastFrameTime: number = 0
  private frameCount: number = 0
  private mouseState: [number, number, number, number] = [0, 0, 0, 0]

  constructor(device: GPUDevice, canvas?: HTMLCanvasElement) {
    super(device)
    
    this.format = navigator.gpu.getPreferredCanvasFormat()
    
    if (canvas) {
      this.canvas = canvas
      this.setupCanvas(canvas)
    }

    this.createBuiltinUniformBuffer()
  }

  /**
   * Setup canvas for WebGPU rendering
   */
  private setupCanvas(canvas: HTMLCanvasElement): void {
    const context = canvas.getContext('webgpu')
    if (!context) {
      throw new Error('Failed to get WebGPU context')
    }

    this.context = context
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    })

    // Setup mouse tracking
    this.setupMouseTracking(canvas)

    // Create depth texture
    this.createDepthTexture(canvas.width, canvas.height)
  }

  /**
   * Create builtin uniform buffer
   */
  private createBuiltinUniformBuffer(): void {
    // 48 bytes: time(4) + deltaTime(4) + frame(4) + pad(4) + resolution(8) + mouse(16) + pad(8)
    this.builtinUniformBuffer = this.createUniformBuffer('__shader3d_builtins__', 64)
  }

  /**
   * Setup mouse event tracking
   */
  private setupMouseTracking(canvas: HTMLCanvasElement): void {
    const updateMouse = (e: MouseEvent, isClick: boolean = false) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height * 2 - 1)
      
      this.mouseState[0] = x
      this.mouseState[1] = y
      
      if (isClick) {
        this.mouseState[2] = x
        this.mouseState[3] = y
      }
    }

    canvas.addEventListener('mousemove', e => updateMouse(e))
    canvas.addEventListener('mousedown', e => updateMouse(e, true))
    canvas.addEventListener('mouseup', e => {
      this.mouseState[2] = -1
      this.mouseState[3] = -1
    })
  }

  /**
   * Create depth texture for 3D rendering
   */
  private createDepthTexture(width: number, height: number): void {
    if (this.depthTexture) {
      this.depthTexture.destroy()
    }

    this.depthTexture = this.device.createTexture({
      label: 'depth_texture',
      size: { width, height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
  }

  /**
   * Get canvas texture format
   */
  getFormat(): GPUTextureFormat {
    return this.format
  }

  /**
   * Get builtin uniform buffer
   */
  getBuiltinUniformBuffer(): GPUBuffer {
    return this.builtinUniformBuffer!
  }

  /**
   * Update builtin uniforms
   */
  updateBuiltinUniforms(): void {
    if (!this.builtinUniformBuffer || !this.canvas) return

    const now = performance.now() / 1000
    if (this.startTime === 0) this.startTime = now

    const time = now - this.startTime
    const deltaTime = now - this.lastFrameTime
    this.lastFrameTime = now
    this.frameCount++

    const data = new Float32Array([
      time,
      deltaTime,
      this.frameCount,
      0, // padding
      this.canvas.width,
      this.canvas.height,
      this.mouseState[0],
      this.mouseState[1],
      this.mouseState[2],
      this.mouseState[3],
      0, 0, 0, 0, 0, 0 // padding to 64 bytes
    ])

    this.device.queue.writeBuffer(this.builtinUniformBuffer, 0, data)
  }

  /**
   * Begin a render pass
   */
  beginRenderPass(config: RenderPassConfig = {}): {
    encoder: GPUCommandEncoder
    pass: GPURenderPassEncoder
  } {
    if (!this.context) {
      throw new Error('Canvas not configured')
    }

    const {
      clearColor = { r: 0, g: 0, b: 0, a: 1 },
      loadOp = 'clear',
      storeOp = 'store'
    } = config

    const encoder = this.device.createCommandEncoder()

    const colorAttachment: GPURenderPassColorAttachment = {
      view: this.context.getCurrentTexture().createView(),
      clearValue: clearColor,
      loadOp,
      storeOp
    }

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment]
    }

    // Add depth attachment if available
    if (this.depthTexture) {
      descriptor.depthStencilAttachment = {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    }

    const pass = encoder.beginRenderPass(descriptor)

    return { encoder, pass }
  }

  /**
   * End render pass and submit
   */
  endRenderPass(encoder: GPUCommandEncoder, pass: GPURenderPassEncoder): void {
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  /**
   * Render fullscreen quad (for fragment shaders)
   */
  renderFullscreenQuad(
    pipelineName: string,
    bindGroup?: GPUBindGroup | string,
    config?: RenderPassConfig
  ): void {
    const pipeline = this.getPipeline(pipelineName) as GPURenderPipeline
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`)
    }

    this.updateBuiltinUniforms()

    const { encoder, pass } = this.beginRenderPass(config)
    
    pass.setPipeline(pipeline)
    
    if (bindGroup) {
      const group = typeof bindGroup === 'string' 
        ? this.bindGroups.get(bindGroup)!
        : bindGroup
      pass.setBindGroup(0, group)
    }
    
    // Draw fullscreen triangle (3 vertices, no buffer needed)
    pass.draw(3)
    
    this.endRenderPass(encoder, pass)
  }

  /**
   * Render with vertex buffer
   */
  render(
    pipelineName: string,
    options: {
      vertexBuffer?: GPUBuffer | string
      indexBuffer?: GPUBuffer | string
      bindGroup?: GPUBindGroup | string
      vertexCount?: number
      indexCount?: number
      instanceCount?: number
      clearColor?: { r: number; g: number; b: number; a: number }
    }
  ): void {
    const pipeline = this.getPipeline(pipelineName) as GPURenderPipeline
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`)
    }

    this.updateBuiltinUniforms()

    const { encoder, pass } = this.beginRenderPass({ clearColor: options.clearColor })

    pass.setPipeline(pipeline)

    // Set vertex buffer
    if (options.vertexBuffer) {
      const vb = typeof options.vertexBuffer === 'string'
        ? this.buffers.get(options.vertexBuffer)!
        : options.vertexBuffer
      pass.setVertexBuffer(0, vb)
    }

    // Set bind group
    if (options.bindGroup) {
      const bg = typeof options.bindGroup === 'string'
        ? this.bindGroups.get(options.bindGroup)!
        : options.bindGroup
      pass.setBindGroup(0, bg)
    }

    // Draw
    if (options.indexBuffer) {
      const ib = typeof options.indexBuffer === 'string'
        ? this.buffers.get(options.indexBuffer)!
        : options.indexBuffer
      pass.setIndexBuffer(ib, 'uint32')
      pass.drawIndexed(options.indexCount || 0, options.instanceCount || 1)
    } else {
      pass.draw(options.vertexCount || 3, options.instanceCount || 1)
    }

    this.endRenderPass(encoder, pass)
  }

  /**
   * Resize canvas and recreate depth texture
   */
  resize(width: number, height: number): void {
    if (!this.canvas) return

    this.canvas.width = width
    this.canvas.height = height

    if (this.context) {
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied'
      })
    }

    this.createDepthTexture(width, height)
  }

  /**
   * Start animation loop
   */
  startAnimationLoop(callback: (time: number, deltaTime: number) => void): void {
    this.startTime = performance.now() / 1000
    this.lastFrameTime = this.startTime

    const animate = () => {
      if (this._disposed) return

      const now = performance.now() / 1000
      const time = now - this.startTime
      const deltaTime = now - this.lastFrameTime
      this.lastFrameTime = now
      this.frameCount++

      callback(time, deltaTime)

      this.animationId = requestAnimationFrame(animate)
    }

    animate()
  }

  /**
   * Stop animation loop
   */
  stopAnimationLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = undefined
    }
  }

  /**
   * Read buffer data back to CPU
   */
  async readBuffer(buffer: GPUBuffer | string): Promise<ArrayBuffer> {
    const gpuBuffer = typeof buffer === 'string' ? this.buffers.get(buffer)! : buffer
    
    // Create staging buffer
    const stagingBuffer = this.device.createBuffer({
      size: gpuBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    // Copy data
    const encoder = this.device.createCommandEncoder()
    encoder.copyBufferToBuffer(gpuBuffer, 0, stagingBuffer, 0, gpuBuffer.size)
    this.device.queue.submit([encoder.finish()])

    // Map and read
    await stagingBuffer.mapAsync(GPUMapMode.READ)
    const data = stagingBuffer.getMappedRange().slice(0)
    stagingBuffer.unmap()
    stagingBuffer.destroy()

    return data
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopAnimationLoop()
    
    if (this.depthTexture) {
      this.depthTexture.destroy()
    }

    super.dispose()
  }
}

/**
 * Initialize WebGPU and create runtime
 */
export async function initWebGPU(canvas?: HTMLCanvasElement): Promise<WebGPURuntime> {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported. Use Chrome 113+, Firefox 141+, or Safari 26+')
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  })
  
  if (!adapter) {
    throw new Error('No WebGPU adapter available')
  }

  // Request device with useful features
  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {}
  })

  return new WebGPURuntime(device, canvas)
}

/**
 * Check WebGPU support
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * Get WebGPU adapter info
 */
export async function getAdapterInfo(): Promise<GPUAdapterInfo | null> {
  if (!isWebGPUSupported()) return null
  
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return null
  
  return adapter.info
}
