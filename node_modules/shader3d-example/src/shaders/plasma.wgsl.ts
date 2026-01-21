export const PLASMA_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Uniforms {
  time: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  var out: VertexOutput;
  out.position = vec4(positions[i], 0.0, 1.0);
  out.uv = positions[i] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let t = u.time;
  
  // Classic plasma formula
  var value = 0.0;
  
  // Combine multiple sine waves
  value += sin(uv.x * 10.0 + t);
  value += sin((uv.y * 10.0 + t) * 0.5);
  value += sin((uv.x * 10.0 + uv.y * 10.0 + t) * 0.5);
  
  // Add circular patterns
  let cx = uv.x + 0.5 * sin(t * 0.5);
  let cy = uv.y + 0.5 * cos(t * 0.3);
  value += sin(sqrt(cx * cx + cy * cy + 1.0) * 10.0 + t);
  
  // Normalize to 0-1
  value = value * 0.25 + 0.5;
  
  // Create vibrant colors
  let r = sin(value * 6.28318) * 0.5 + 0.5;
  let g = sin(value * 6.28318 + 2.094) * 0.5 + 0.5;
  let b = sin(value * 6.28318 + 4.188) * 0.5 + 0.5;
  
  return vec4(r, g, b, 1.0);
}
`
