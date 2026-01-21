export const GRADIENT_SHADER = `
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
  // Fullscreen triangle (more efficient than quad)
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

// Color palette function (from Inigo Quilez)
fn palette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
  return a + b * cos(6.28318 * (c * t + d));
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let t = u.time;
  
  // Create animated color palette
  let color = palette(
    uv.x + t * 0.1,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0, 0.33, 0.67)
  );
  
  // Add some radial waves
  let center = vec2(0.5, 0.5);
  let dist = length(uv - center);
  let wave = sin(dist * 20.0 - t * 2.0) * 0.5 + 0.5;
  
  // Mix gradient with wave
  let finalColor = mix(color, color * wave, 0.3);
  
  // Gamma correction
  return vec4(pow(finalColor, vec3(0.4545)), 1.0);
}
`
