export interface BufferDescriptor {
  binding: number
  buffer: GPUBuffer
  offset?: number
  size?: number
}

/**
 * Texture descriptor for bind groups
 */
export interface TextureDescriptor {
  binding: number
  texture: GPUTexture | GPUTextureView
  sampler?: GPUSampler
}

/**
 * Pipeline cache entry
 */
interface PipelineCacheEntry {
  pipeline: GPUComputePipeline | GPURenderPipeline
  bindGroupLayout: GPUBindGroupLayout
  timestamp: number
  source?: string
}

/**
 * Abstract base class for Shader3D runtimes
 * Handles GPU resource management, pipeline caching, and HMR
 */
export abstract class Shader3DRuntime {
  protected device: GPUDevice
  protected pipelines: Map<string, PipelineCacheEntry> = new Map()
  protected bindGroups: Map<string, GPUBindGroup> = new Map()
  protected buffers: Map<string, GPUBuffer> = new Map()
  protected _disposed = false

  constructor(device: GPUDevice) {
    this.device = device
    this.setupHMR()
    this.setupErrorHandling()
  }

  /**
   * Get the GPU device
   */
  getDevice(): GPUDevice {
    return this.device
  }

  /**
   * Check if runtime has been disposed
   */
  isDisposed(): boolean {
    return this._disposed
  }

  // =====================
  // Pipeline Management
  // =====================

  /**
   * Create a compute pipeline
   */
  async createComputePipeline(
    name: string,
    shaderCode: string,
    entryPoint: string = 'main',
    layout?: GPUPipelineLayout | 'auto'
  ): Promise<GPUComputePipeline> {
    const module = this.device.createShaderModule({ 
      label: `${name}_module`,
      code: shaderCode 
    })
    
    const pipeline = await this.device.createComputePipelineAsync({
      label: name,
      layout: layout || 'auto',
      compute: {
        module,
        entryPoint
      }
    })

    this.pipelines.set(name, {
      pipeline,
      bindGroupLayout: pipeline.getBindGroupLayout(0),
      timestamp: Date.now(),
      source: shaderCode
    })

    return pipeline
  }

  /**
   * Create a render pipeline
   */
  async createRenderPipeline(
    name: string,
    shaderCode: string,
    options: {
      vertexEntry?: string
      fragmentEntry?: string
      format?: GPUTextureFormat
      topology?: GPUPrimitiveTopology
      vertexBuffers?: GPUVertexBufferLayout[]
      depthStencil?: GPUDepthStencilState
      multisample?: GPUMultisampleState
      layout?: GPUPipelineLayout | 'auto'
    } = {}
  ): Promise<GPURenderPipeline> {
    const {
      vertexEntry = 'vs_main',
      fragmentEntry = 'fs_main',
      format = navigator.gpu.getPreferredCanvasFormat(),
      topology = 'triangle-list',
      vertexBuffers = [],
      depthStencil,
      multisample,
      layout = 'auto'
    } = options

    const module = this.device.createShaderModule({ 
      label: `${name}_module`,
      code: shaderCode 
    })

    const pipelineDescriptor: GPURenderPipelineDescriptor = {
      label: name,
      layout,
      vertex: {
        module,
        entryPoint: vertexEntry,
        buffers: vertexBuffers
      },
      fragment: {
        module,
        entryPoint: fragmentEntry,
        targets: [{ format }]
      },
      primitive: {
        topology,
        cullMode: 'none'
      }
    }

    if (depthStencil) {
      pipelineDescriptor.depthStencil = depthStencil
    }

    if (multisample) {
      pipelineDescriptor.multisample = multisample
    }

    const pipeline = await this.device.createRenderPipelineAsync(pipelineDescriptor)

    this.pipelines.set(name, {
      pipeline,
      bindGroupLayout: pipeline.getBindGroupLayout(0),
      timestamp: Date.now(),
      source: shaderCode
    })

    return pipeline
  }

  /**
   * Get a cached pipeline
   */
  getPipeline(name: string): GPUComputePipeline | GPURenderPipeline | undefined {
    return this.pipelines.get(name)?.pipeline
  }

  /**
   * Check if pipeline exists
   */
  hasPipeline(name: string): boolean {
    return this.pipelines.has(name)
  }

  // =====================
  // Buffer Management
  // =====================

  /**
   * Create a buffer
   */
  createBuffer(
    name: string,
    size: number,
    usage: GPUBufferUsageFlags,
    data?: ArrayBuffer | ArrayBufferView
  ): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: name,
      size,
      usage,
      mappedAtCreation: !!data
    })

    if (data) {
      const mapped = buffer.getMappedRange()
      if (data instanceof ArrayBuffer) {
        new Uint8Array(mapped).set(new Uint8Array(data))
      } else {
        new Uint8Array(mapped).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      }
      buffer.unmap()
    }

    this.buffers.set(name, buffer)
    return buffer
  }

  /**
   * Create a uniform buffer
   */
  createUniformBuffer(name: string, size: number): GPUBuffer {
    // Ensure 16-byte alignment for uniform buffers
    const alignedSize = Math.ceil(size / 16) * 16
    return this.createBuffer(
      name,
      alignedSize,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    )
  }

  /**
   * Create a storage buffer
   */
  createStorageBuffer(name: string, size: number, data?: ArrayBuffer | ArrayBufferView): GPUBuffer {
    return this.createBuffer(
      name,
      size,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      data
    )
  }

  /**
   * Create a vertex buffer
   */
  createVertexBuffer(name: string, data: Float32Array | Uint32Array): GPUBuffer {
    return this.createBuffer(
      name,
      data.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      data
    )
  }

  /**
   * Create an index buffer
   */
  createIndexBuffer(name: string, data: Uint16Array | Uint32Array): GPUBuffer {
    return this.createBuffer(
      name,
      data.byteLength,
      GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      data
    )
  }

  /**
   * Update buffer data
   */
  updateBuffer(buffer: GPUBuffer | string, data: ArrayBuffer | ArrayBufferView, offset: number = 0): void {
    const gpuBuffer = typeof buffer === 'string' ? this.buffers.get(buffer) : buffer
    if (!gpuBuffer) {
      throw new Error(`Buffer not found: ${buffer}`)
    }
    this.device.queue.writeBuffer(gpuBuffer, offset, data as ArrayBuffer)
  }

  /**
   * Get a named buffer
   */
  getBuffer(name: string): GPUBuffer | undefined {
    return this.buffers.get(name)
  }

  // =====================
  // Bind Group Management
  // =====================

  /**
   * Create a bind group from buffer descriptors
   */
  createBindGroup(
    name: string,
    pipelineName: string,
    entries: (BufferDescriptor | TextureDescriptor)[],
    groupIndex: number = 0
  ): GPUBindGroup {
    const cached = this.pipelines.get(pipelineName)
    if (!cached) {
      throw new Error(`Pipeline '${pipelineName}' not found`)
    }

    const layout = (cached.pipeline as any).getBindGroupLayout(groupIndex)

    const bindGroupEntries: GPUBindGroupEntry[] = entries.map(entry => {
      if ('buffer' in entry) {
        return {
          binding: entry.binding,
          resource: {
            buffer: entry.buffer,
            offset: entry.offset || 0,
            size: entry.size || entry.buffer.size
          }
        }
      } else {
        // Texture entry
        const resource = entry.texture instanceof GPUTexture 
          ? entry.texture.createView()
          : entry.texture
        return {
          binding: entry.binding,
          resource
        }
      }
    })

    const bindGroup = this.device.createBindGroup({
      label: name,
      layout,
      entries: bindGroupEntries
    })

    this.bindGroups.set(name, bindGroup)
    return bindGroup
  }

  // =====================
  // Dispatch & Render
  // =====================

  /**
   * Dispatch a compute shader
   */
  dispatchCompute(
    pipelineName: string,
    bindGroup: GPUBindGroup | string,
    workgroups: [number, number?, number?]
  ): GPUCommandBuffer {
    const pipeline = this.getPipeline(pipelineName) as GPUComputePipeline
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`)
    }

    const group = typeof bindGroup === 'string' 
      ? this.bindGroups.get(bindGroup)! 
      : bindGroup

    const encoder = this.device.createCommandEncoder({ label: `compute_${pipelineName}` })
    const pass = encoder.beginComputePass({ label: pipelineName })
    
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, group)
    pass.dispatchWorkgroups(workgroups[0], workgroups[1] || 1, workgroups[2] || 1)
    pass.end()

    const commands = encoder.finish()
    this.device.queue.submit([commands])
    
    return commands
  }

  // =====================
  // HMR Support
  // =====================

  /**
   * Hot reload a pipeline with new shader code
   */
  async hotReload(pipelineName: string, newShaderCode: string): Promise<void> {
    const cached = this.pipelines.get(pipelineName)
    if (!cached) {
      console.warn(`Pipeline '${pipelineName}' not found for hot reload`)
      return
    }

    console.log(`🔄 Hot reloading pipeline: ${pipelineName}`)

    try {
      const isCompute = 'dispatchWorkgroups' in (cached.pipeline as any).constructor.prototype ||
                        /@compute/.test(cached.source || '')

      if (isCompute) {
        await this.createComputePipeline(pipelineName, newShaderCode)
      } else {
        await this.createRenderPipeline(pipelineName, newShaderCode)
      }

      console.log(`✅ Pipeline ${pipelineName} reloaded`)
    } catch (error) {
      console.error(`❌ Failed to reload pipeline ${pipelineName}:`, error)
      throw error
    }
  }

  /**
   * Setup HMR event listeners
   */
  protected setupHMR(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('shader3d:hot-update', ((event: CustomEvent) => {
      const { file, wgsl } = event.detail
      this.onShaderUpdate(file, wgsl)
    }) as EventListener)
  }

  /**
   * Handle shader update - override in subclasses
   */
  protected onShaderUpdate(file: string, shaderCode: string): void {
    // Default: try to match file to pipeline name
    const pipelineName = file.split('/').pop()?.replace(/\.[^.]+$/, '')
    if (pipelineName && this.pipelines.has(pipelineName)) {
      this.hotReload(pipelineName, shaderCode)
    }
  }

  // =====================
  // Error Handling
  // =====================

  /**
   * Setup GPU error handling
   */
  protected setupErrorHandling(): void {
    this.device.addEventListener('uncapturederror', (event) => {
      console.error('WebGPU Error:', event)
    })
  }

  // =====================
  // Cleanup
  // =====================

  /**
   * Dispose all resources
   */
  dispose(): void {
    this._disposed = true

    // Destroy all buffers
    this.buffers.forEach(buffer => buffer.destroy())
    this.buffers.clear()

    // Clear pipeline cache
    this.pipelines.clear()

    // Clear bind groups
    this.bindGroups.clear()
  }
}
