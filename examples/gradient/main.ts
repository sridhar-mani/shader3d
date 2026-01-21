// @ts-expect-error - Resolved at runtime after packages are built
import { initWebGPU } from '@shader3d/runtime'

// Animated gradient shader using WGSL
const GRADIENT_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Uniforms {
  time: f32,
  resolution: vec2<f32>,
  _pad: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen triangle
  var positions = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  
  var out: VertexOutput;
  out.position = vec4(positions[vertexIndex], 0.0, 1.0);
  out.uv = (positions[vertexIndex] + 1.0) * 0.5;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let t = u.time;
  
  // Create animated color palette
  let color1 = vec3(0.5, 0.5, 0.5);
  let color2 = vec3(0.5, 0.5, 0.5);
  let color3 = vec3(1.0, 1.0, 1.0);
  let color4 = vec3(0.0, 0.33, 0.67);
  
  // Palette function: a + b * cos(2π(c*t + d))
  let palette = color1 + color2 * cos(6.28318 * (color3 * (uv.x + t * 0.2) + color4));
  
  // Add some waves
  let wave = sin(uv.x * 10.0 + t) * cos(uv.y * 10.0 + t * 0.5) * 0.1;
  
  // Final color with gamma correction
  let finalColor = palette + wave;
  
  return vec4(pow(finalColor, vec3(0.4545)), 1.0);
}
`

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  
  // Initialize WebGPU runtime
  const runtime = await initWebGPU(canvas)
  
  // Create uniform buffer for time and resolution
  const uniformBuffer = runtime.createUniformBuffer('uniforms', 16)
  
  // Create render pipeline
  await runtime.createRenderPipeline('gradient', GRADIENT_SHADER, {
    vertexEntry: 'vs_main',
    fragmentEntry: 'fs_main'
  })
  
  // Create bind group
  const bindGroup = runtime.createBindGroup('main', 'gradient', [
    { binding: 0, buffer: uniformBuffer }
  ])
  
  // Animation loop
  runtime.startAnimationLoop((time: number) => {
    // Update uniforms
    const uniformData = new Float32Array([
      time,           // time
      canvas.width,   // resolution.x
      canvas.height,  // resolution.y
      0               // padding
    ])
    runtime.updateBuffer(uniformBuffer, uniformData)
    
    // Render
    runtime.renderFullscreenQuad('gradient', bindGroup)
  })
  
  // Handle resize
  window.addEventListener('resize', () => {
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * 0.8 * dpr
    canvas.height = window.innerHeight * 0.6 * dpr
    canvas.style.width = `${window.innerWidth * 0.8}px`
    canvas.style.height = `${window.innerHeight * 0.6}px`
    runtime.resize(canvas.width, canvas.height)
  })
}

main().catch(err => {
  console.error('Failed to initialize:', err)
  document.body.innerHTML = `
    <div style="color: #ff6b6b; padding: 2rem; text-align: center;">
      <h1>WebGPU Not Supported</h1>
      <p>Please use a browser that supports WebGPU (Chrome 113+, Edge 113+, Firefox Nightly)</p>
    </div>
  `
})
