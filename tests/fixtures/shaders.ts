// Test fixtures - Sample shaders for testing the compiler

export const basicFragment = `
@fragment
function main(): vec4f {
  return vec4f(1.0, 0.0, 0.5, 1.0);
}
`;

export const basicVertex = `
@vertex
function main(@builtin(vertex_index) index: u32): @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  return vec4f(positions[index], 0.0, 1.0);
}
`;

export const withUniforms = `
@fragment
function main(@builtin(position) pos: vec4f): vec4f {
  const uv = pos.xy / resolution;
  const col = vec3f(uv.x, uv.y, sin(time) * 0.5 + 0.5);
  return vec4f(col, 1.0);
}
`;

export const withStruct = `
struct Vertex {
  position: vec3f,
  normal: vec3f,
  uv: vec2f
}

@vertex
function main(@location(0) vertex: Vertex): @builtin(position) vec4f {
  return vec4f(vertex.position, 1.0);
}
`;

export const computeShader = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
function main(@builtin(global_invocation_id) id: vec3u) {
  const i = id.x;
  data[i] = data[i] * 2.0;
}
`;

export const complexMath = `
@fragment
function main(@builtin(position) pos: vec4f): vec4f {
  const uv = pos.xy / resolution;
  const d = length(uv - vec2f(0.5));
  const col = mix(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), d);
  return vec4f(col, 1.0);
}
`;

export const withLoop = `
@fragment
function main(@builtin(position) pos: vec4f): vec4f {
  var sum = 0.0;
  for (var i = 0; i < 10; i++) {
    sum = sum + f32(i) * 0.1;
  }
  return vec4f(sum, sum, sum, 1.0);
}
`;

export const withConditional = `
@fragment
function main(@builtin(position) pos: vec4f): vec4f {
  const uv = pos.xy / resolution;
  if (uv.x > 0.5) {
    return vec4f(1.0, 0.0, 0.0, 1.0);
  } else {
    return vec4f(0.0, 0.0, 1.0, 1.0);
  }
}
`;

export const helperFunction = `
function hash(p: vec2f): f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

@fragment
function main(@builtin(position) pos: vec4f): vec4f {
  const uv = pos.xy / resolution;
  const n = hash(uv * 100.0);
  return vec4f(n, n, n, 1.0);
}
`;

export const multipleEntryPoints = `
@vertex
function vertexMain(@builtin(vertex_index) index: u32): @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-0.5, -0.5),
    vec2f(0.5, -0.5),
    vec2f(0.0, 0.5)
  );
  return vec4f(positions[index], 0.0, 1.0);
}

@fragment
function fragmentMain(): vec4f {
  return vec4f(1.0, 0.4, 0.6, 1.0);
}
`;

// Error cases for testing diagnostics
export const typeError = `
@fragment
function main(): vec4f {
  const x: vec2f = vec3f(1.0, 2.0, 3.0);
  return vec4f(x, 0.0, 1.0);
}
`;

export const missingReturn = `
@fragment
function main(): vec4f {
  const x = 1.0;
}
`;

export const undefinedVariable = `
@fragment
function main(): vec4f {
  return vec4f(undefinedVar, 0.0, 0.0, 1.0);
}
`;

export const syntaxError = `
@fragment
function main( vec4f {
  return vec4f(1.0);
}
`;
