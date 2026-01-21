export const METABALLS_SHADER = `
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

// Metaball influence function
fn metaball(p: vec2<f32>, center: vec2<f32>, radius: f32) -> f32 {
  let d = length(p - center);
  return radius * radius / (d * d + 0.001);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let t = u.time;
  let aspect = u.resolution.x / u.resolution.y;
  var uv = in.uv * 2.0 - 1.0;
  uv.x *= aspect;
  
  // Mouse position normalized
  let mouse = (u.mouse / u.resolution) * 2.0 - 1.0;
  
  // Define metaball centers (animated)
  let ball1 = vec2(sin(t * 0.7) * 0.6, cos(t * 0.8) * 0.4);
  let ball2 = vec2(sin(t * 1.1 + 2.0) * 0.5, cos(t * 0.6 + 1.0) * 0.5);
  let ball3 = vec2(sin(t * 0.9 + 4.0) * 0.4, cos(t * 1.2 + 3.0) * 0.6);
  let ball4 = vec2(cos(t * 0.5) * 0.7, sin(t * 0.4) * 0.3);
  let ball5 = mouse * vec2(aspect, 1.0);  // Mouse-controlled ball
  
  // Calculate total influence
  var influence = 0.0;
  influence += metaball(uv, ball1, 0.3);
  influence += metaball(uv, ball2, 0.25);
  influence += metaball(uv, ball3, 0.35);
  influence += metaball(uv, ball4, 0.2);
  influence += metaball(uv, ball5, 0.4);
  
  // Threshold for metaball surface
  let threshold = 1.0;
  
  // Color based on influence
  var color = vec3(0.05, 0.05, 0.1);
  
  if (influence > threshold) {
    // Inside metaball - create gradient based on influence
    let t = (influence - threshold) / (influence);
    
    // Vibrant gradient
    let innerColor = vec3(0.1, 0.8, 0.9);
    let outerColor = vec3(0.9, 0.2, 0.5);
    color = mix(outerColor, innerColor, t);
    
    // Add glow at edges
    let edge = smoothstep(threshold, threshold + 0.1, influence);
    color += vec3(0.5, 0.3, 0.7) * (1.0 - edge) * 0.5;
  } else {
    // Outside - subtle glow effect
    let glow = influence / threshold;
    color += vec3(0.3, 0.1, 0.4) * glow * glow;
  }
  
  // Add some noise/grain
  let grain = fract(sin(dot(uv, vec2(12.9898, 78.233)) + t) * 43758.5453);
  color += (grain - 0.5) * 0.02;
  
  return vec4(color, 1.0);
}
`
