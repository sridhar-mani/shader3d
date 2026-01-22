// Expected WGSL outputs for golden tests

export const expectedBasicFragment = `@fragment
fn main() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.0, 0.5, 1.0);
}
`;

export const expectedBasicVertex = `@vertex
fn main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    return vec4<f32>(positions[index], 0.0, 1.0);
}
`;

export const expectedWithUniforms = `struct Uniforms {
    time: f32,
    resolution: vec2<f32>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = pos.xy / u.resolution;
    let col = vec3<f32>(uv.x, uv.y, sin(u.time) * 0.5 + 0.5);
    return vec4<f32>(col, 1.0);
}
`;

export const expectedWithStruct = `struct Vertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    uv: vec2<f32>,
}

@vertex
fn main(@location(0) vertex: Vertex) -> @builtin(position) vec4<f32> {
    return vec4<f32>(vertex.position, 1.0);
}
`;

export const expectedComputeShader = `@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    data[i] = data[i] * 2.0;
}
`;

export const expectedMultipleEntryPoints = `@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-0.5, -0.5),
        vec2<f32>(0.5, -0.5),
        vec2<f32>(0.0, 0.5)
    );
    return vec4<f32>(positions[index], 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 0.4, 0.6, 1.0);
}
`;
