import { useEffect, useRef, useState, useCallback } from 'react'

// WebGPU type definitions are loaded globally via tsconfig.json types array

export interface WebGPUState {
  supported: boolean
  device: GPUDevice | null
  context: GPUCanvasContext | null
  format: GPUTextureFormat
  error: string | null
}

export interface UseWebGPUOptions {
  powerPreference?: 'high-performance' | 'low-power'
}

/**
 * Hook to initialize WebGPU with a canvas
 */
export function useWebGPU(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseWebGPUOptions = {}
): WebGPUState {
  const [state, setState] = useState<WebGPUState>({
    supported: false,
    device: null,
    context: null,
    format: 'bgra8unorm',
    error: null
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Check WebGPU support
      if (!navigator.gpu) {
        setState(s => ({ ...s, error: 'WebGPU is not supported in this browser' }))
        return
      }

      try {
        // Request adapter
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: options.powerPreference || 'high-performance'
        })

        if (!adapter) {
          setState(s => ({ ...s, error: 'No WebGPU adapter found' }))
          return
        }

        // Request device
        const device = await adapter.requestDevice()
        
        if (cancelled) return

        // Get canvas context
        const canvas = canvasRef.current
        if (!canvas) {
          setState(s => ({ ...s, error: 'Canvas not found' }))
          return
        }

        const context = canvas.getContext('webgpu')
        if (!context) {
          setState(s => ({ ...s, error: 'Failed to get WebGPU context' }))
          return
        }

        const format = navigator.gpu.getPreferredCanvasFormat()

        // Configure context
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied'
        })

        setState({
          supported: true,
          device,
          context,
          format,
          error: null
        })
      } catch (err) {
        setState(s => ({ 
          ...s, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        }))
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [canvasRef, options.powerPreference])

  return state
}

/**
 * Hook for running shader animation loop
 */
export function useShaderAnimation(
  device: GPUDevice | null,
  context: GPUCanvasContext | null,
  format: GPUTextureFormat,
  shaderCode: string,
  options: {
    width: number
    height: number
  }
) {
  const pipelineRef = useRef<GPURenderPipeline | null>(null)
  const uniformBufferRef = useRef<GPUBuffer | null>(null)
  const bindGroupRef = useRef<GPUBindGroup | null>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Setup pipeline
  useEffect(() => {
    if (!device || !context) return

    const shaderModule = device.createShaderModule({
      label: 'Shader3D Shader',
      code: shaderCode
    })

    const pipeline = device.createRenderPipeline({
      label: 'Shader3D Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    })

    // Create uniform buffer (32 bytes: time + resolution + mouse)
    const uniformBuffer = device.createBuffer({
      label: 'Uniforms',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    const bindGroup = device.createBindGroup({
      label: 'Main Bind Group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } }
      ]
    })

    pipelineRef.current = pipeline
    uniformBufferRef.current = uniformBuffer
    bindGroupRef.current = bindGroup
    startTimeRef.current = performance.now()

    return () => {
      uniformBuffer.destroy()
    }
  }, [device, context, format, shaderCode])

  // Animation loop
  useEffect(() => {
    if (!device || !context || !pipelineRef.current) return

    const render = () => {
      const pipeline = pipelineRef.current
      const uniformBuffer = uniformBufferRef.current
      const bindGroup = bindGroupRef.current

      if (!pipeline || !uniformBuffer || !bindGroup) return

      // Update uniforms
      const time = (performance.now() - startTimeRef.current) / 1000
      const uniformData = new Float32Array([
        time,
        options.width,
        options.height,
        0, // padding
        mouseRef.current.x,
        mouseRef.current.y,
        0, 0 // padding
      ])
      device.queue.writeBuffer(uniformBuffer, 0, uniformData)

      // Render
      const commandEncoder = device.createCommandEncoder()
      const textureView = context.getCurrentTexture().createView()

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      })

      renderPass.setPipeline(pipeline)
      renderPass.setBindGroup(0, bindGroup)
      renderPass.draw(3, 1, 0, 0) // Fullscreen triangle
      renderPass.end()

      device.queue.submit([commandEncoder.finish()])

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [device, context, options.width, options.height])

  // Mouse handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: rect.height - (e.clientY - rect.top) // Flip Y
    }
  }, [])

  return { handleMouseMove }
}
