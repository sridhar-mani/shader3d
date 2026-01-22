// @shader3d/runtime - WebGPU runtime helpers

export interface WebGPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  adapter: GPUAdapter;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
}

export interface ShaderModule {
  module: GPUShaderModule;
  pipeline: GPURenderPipeline | GPUComputePipeline;
  bindGroup?: GPUBindGroup;
  bindGroupLayout?: GPUBindGroupLayout;
  uniformBuffer?: GPUBuffer;
}

export interface UniformDescriptor {
  name: string;
  type: 'f32' | 'i32' | 'u32' | 'vec2f' | 'vec3f' | 'vec4f' | 'mat4x4f';
  value: number | number[] | Float32Array;
}

export interface RenderOptions {
  clearColor?: GPUColor;
  depthTest?: boolean;
  blending?: boolean;
  cullMode?: GPUCullMode;
  topology?: GPUPrimitiveTopology;
}

export interface FrameData {
  time: number;
  deltaTime: number;
  frame: number;
  resolution: [number, number];
  mouse: [number, number];
}

/**
 * Check if WebGPU is available in the current environment
 */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Initialize WebGPU with a canvas element
 *
 * @example
 * ```typescript
 * const ctx = await initWebGPU(canvas)
 * // ctx.device, ctx.context, ctx.adapter available
 * ```
 */
export async function initWebGPU(canvas: HTMLCanvasElement): Promise<WebGPUContext> {
  if (!isWebGPUSupported()) {
    throw new Error('WebGPU is not supported in this browser');
  }

  const adapter = await navigator.gpu!.requestAdapter({
    powerPreference: 'high-performance',
  });

  if (!adapter) {
    throw new Error('Failed to get WebGPU adapter');
  }

  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {},
  });

  // Handle device lost
  device.lost.then((info) => {
    console.error('WebGPU device was lost:', info.message);
    if (info.reason !== 'destroyed') {
      // Attempt to reinitialize
      console.log('Attempting to reinitialize WebGPU...');
    }
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU context');
  }

  const format = navigator.gpu!.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, context, adapter, format, canvas };
}

/**
 * Create a shader module from WGSL code
 */
export function createShaderModule(
  device: GPUDevice,
  code: string,
  label?: string
): GPUShaderModule {
  return device.createShaderModule({
    label: label || 'Shader Module',
    code,
  });
}

/**
 * Create a fullscreen render pipeline (for fragment-only shaders)
 */
export function createFullscreenPipeline(
  ctx: WebGPUContext,
  fragmentCode: string,
  options: RenderOptions = {}
): ShaderModule {
  // Fullscreen triangle vertex shader
  const vertexCode = `
    @vertex
    fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
      var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
      );
      return vec4<f32>(positions[vertex_index], 0.0, 1.0);
    }
  `;

  const vertexModule = createShaderModule(ctx.device, vertexCode, 'Fullscreen Vertex');
  const fragmentModule = createShaderModule(ctx.device, fragmentCode, 'Fragment Shader');

  const pipeline = ctx.device.createRenderPipeline({
    label: 'Fullscreen Pipeline',
    layout: 'auto',
    vertex: {
      module: vertexModule,
      entryPoint: 'vertex_main',
    },
    fragment: {
      module: fragmentModule,
      entryPoint: 'main',
      targets: [
        {
          format: ctx.format,
          blend: options.blending
            ? {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
              }
            : undefined,
        },
      ],
    },
    primitive: {
      topology: options.topology || 'triangle-list',
      cullMode: options.cullMode || 'none',
    },
  });

  return {
    module: fragmentModule,
    pipeline,
  };
}

/**
 * Create a compute pipeline
 */
export function createComputePipeline(
  device: GPUDevice,
  code: string,
  entryPoint: string = 'main'
): ShaderModule {
  const module = createShaderModule(device, code, 'Compute Shader');

  const pipeline = device.createComputePipeline({
    label: 'Compute Pipeline',
    layout: 'auto',
    compute: {
      module,
      entryPoint,
    },
  });

  return {
    module,
    pipeline,
  };
}

function getUniformBufferSize(descriptors: UniformDescriptor[]): number {
  let size = 0;
  for (const desc of descriptors) {
    switch (desc.type) {
      case 'f32':
      case 'i32':
      case 'u32':
        size += 4;
        break;
      case 'vec2f':
        size = Math.ceil(size / 8) * 8; // 8-byte alignment
        size += 8;
        break;
      case 'vec3f':
        size = Math.ceil(size / 16) * 16; // 16-byte alignment
        size += 12;
        break;
      case 'vec4f':
        size = Math.ceil(size / 16) * 16;
        size += 16;
        break;
      case 'mat4x4f':
        size = Math.ceil(size / 16) * 16;
        size += 64;
        break;
    }
  }
  // Round up to 16-byte boundary
  return Math.ceil(size / 16) * 16;
}

/**
 * Create a uniform buffer with initial values
 */
export function createUniformBuffer(
  device: GPUDevice,
  descriptors: UniformDescriptor[]
): GPUBuffer {
  const size = getUniformBufferSize(descriptors);

  const buffer = device.createBuffer({
    label: 'Uniform Buffer',
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Write initial values
  updateUniformBuffer(device, buffer, descriptors);

  return buffer;
}

/**
 * Update uniform buffer with new values
 */
export function updateUniformBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  descriptors: UniformDescriptor[]
): void {
  const size = getUniformBufferSize(descriptors);
  const data = new ArrayBuffer(size);
  const view = new DataView(data);

  let offset = 0;
  for (const desc of descriptors) {
    const value = desc.value;

    switch (desc.type) {
      case 'f32':
        view.setFloat32(offset, value as number, true);
        offset += 4;
        break;
      case 'i32':
        view.setInt32(offset, value as number, true);
        offset += 4;
        break;
      case 'u32':
        view.setUint32(offset, value as number, true);
        offset += 4;
        break;
      case 'vec2f':
        offset = Math.ceil(offset / 8) * 8;
        const v2 = value as number[];
        view.setFloat32(offset, v2[0], true);
        view.setFloat32(offset + 4, v2[1], true);
        offset += 8;
        break;
      case 'vec3f':
        offset = Math.ceil(offset / 16) * 16;
        const v3 = value as number[];
        view.setFloat32(offset, v3[0], true);
        view.setFloat32(offset + 4, v3[1], true);
        view.setFloat32(offset + 8, v3[2], true);
        offset += 12;
        break;
      case 'vec4f':
        offset = Math.ceil(offset / 16) * 16;
        const v4 = value as number[];
        view.setFloat32(offset, v4[0], true);
        view.setFloat32(offset + 4, v4[1], true);
        view.setFloat32(offset + 8, v4[2], true);
        view.setFloat32(offset + 12, v4[3], true);
        offset += 16;
        break;
      case 'mat4x4f':
        offset = Math.ceil(offset / 16) * 16;
        const mat = value as number[] | Float32Array;
        for (let i = 0; i < 16; i++) {
          view.setFloat32(offset + i * 4, mat[i], true);
        }
        offset += 64;
        break;
    }
  }

  device.queue.writeBuffer(buffer, 0, data);
}

/**
 * Create a bind group for uniforms
 */
export function createUniformBindGroup(
  device: GPUDevice,
  pipeline: GPURenderPipeline | GPUComputePipeline,
  buffer: GPUBuffer,
  groupIndex: number = 0
): GPUBindGroup {
  return device.createBindGroup({
    label: 'Uniform Bind Group',
    layout: pipeline.getBindGroupLayout(groupIndex),
    entries: [
      {
        binding: 0,
        resource: { buffer },
      },
    ],
  });
}

/**
 * Create a bind group with multiple resources
 */
export function createBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  entries: Array<{ binding: number; resource: GPUBindingResource }>
): GPUBindGroup {
  return device.createBindGroup({
    label: 'Bind Group',
    layout,
    entries,
  });
}

export type RenderCallback = (frameData: FrameData) => void;

/**
 * Create an animation loop for rendering
 */
export function createRenderLoop(callback: RenderCallback): {
  start: () => void;
  stop: () => void;
} {
  let animationId: number | null = null;
  let startTime = 0;
  let lastTime = 0;
  let frame = 0;
  let mouseX = 0;
  let mouseY = 0;

  // Track mouse position
  const handleMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };

  const loop = (currentTime: number) => {
    if (startTime === 0) startTime = currentTime;
    const time = (currentTime - startTime) / 1000;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    callback({
      time,
      deltaTime,
      frame,
      resolution: [window.innerWidth, window.innerHeight],
      mouse: [mouseX, mouseY],
    });

    frame++;
    animationId = requestAnimationFrame(loop);
  };

  return {
    start: () => {
      window.addEventListener('mousemove', handleMouseMove);
      startTime = 0;
      lastTime = 0;
      frame = 0;
      animationId = requestAnimationFrame(loop);
    },
    stop: () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
  };
}

export interface ShaderRenderer {
  render: () => void;
  updateUniforms: (updates: Partial<Record<string, number | number[]>>) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/**
 * Create a simple fullscreen shader renderer
 *
 * @example
 * ```typescript
 * const renderer = await createShaderRenderer(canvas, shaderCode)
 *
 * const loop = createRenderLoop((frame) => {
 *   renderer.updateUniforms({ time: frame.time })
 *   renderer.render()
 * })
 *
 * loop.start()
 * ```
 */
export async function createShaderRenderer(
  canvas: HTMLCanvasElement,
  fragmentCode: string,
  uniforms?: UniformDescriptor[]
): Promise<ShaderRenderer> {
  const ctx = await initWebGPU(canvas);
  const shader = createFullscreenPipeline(ctx, fragmentCode);

  let uniformBuffer: GPUBuffer | undefined;
  let bindGroup: GPUBindGroup | undefined;
  let uniformDescriptors = uniforms || [];

  if (uniformDescriptors.length > 0) {
    uniformBuffer = createUniformBuffer(ctx.device, uniformDescriptors);
    bindGroup = createUniformBindGroup(
      ctx.device,
      shader.pipeline as GPURenderPipeline,
      uniformBuffer
    );
  }

  const render = () => {
    const commandEncoder = ctx.device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: ctx.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });

    renderPass.setPipeline(shader.pipeline as GPURenderPipeline);

    if (bindGroup) {
      renderPass.setBindGroup(0, bindGroup);
    }

    renderPass.draw(3); // Fullscreen triangle
    renderPass.end();

    ctx.device.queue.submit([commandEncoder.finish()]);
  };

  const updateUniforms = (updates: Partial<Record<string, number | number[]>>) => {
    if (!uniformBuffer) return;

    for (const desc of uniformDescriptors) {
      if (updates[desc.name] !== undefined) {
        desc.value = updates[desc.name] as number | number[];
      }
    }

    updateUniformBuffer(ctx.device, uniformBuffer, uniformDescriptors);
  };

  const resize = (width: number, height: number) => {
    canvas.width = width;
    canvas.height = height;
  };

  const destroy = () => {
    uniformBuffer?.destroy();
    ctx.device.destroy();
  };

  return { render, updateUniforms, resize, destroy };
}

/**
 * Load a shader from a URL
 */
export async function loadShader(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${url}`);
  }
  return response.text();
}

/**
 * Create a texture from an image
 */
export async function createTextureFromImage(
  device: GPUDevice,
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement
): Promise<GPUTexture> {
  let bitmap: ImageBitmap;

  if (source instanceof ImageBitmap) {
    bitmap = source;
  } else if (source instanceof HTMLImageElement) {
    bitmap = await createImageBitmap(source);
  } else {
    bitmap = await createImageBitmap(source);
  }

  const texture = device.createTexture({
    size: { width: bitmap.width, height: bitmap.height },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    { width: bitmap.width, height: bitmap.height }
  );

  return texture;
}

/**
 * Create a sampler with common settings
 */
export function createSampler(
  device: GPUDevice,
  options: Partial<GPUSamplerDescriptor> = {}
): GPUSampler {
  return device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    ...options,
  });
}

/**
 * Helper to create identity matrix
 */
export function mat4Identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

/**
 * Helper to create perspective projection matrix
 */
export function mat4Perspective(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ]);
}
