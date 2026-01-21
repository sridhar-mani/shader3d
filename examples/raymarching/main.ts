// @ts-expect-error - Resolved at runtime after packages are built
import { initWebGPU } from '@shader3d/runtime'

// Full raymarching shader with SDF primitives and operations
const RAYMARCHING_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Uniforms {
  time: f32,
  deltaTime: f32,
  frame: f32,
  _pad1: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

// Vertex shader - fullscreen triangle
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

// ============================================
// SDF PRIMITIVES (ShaderPark-inspired)
// ============================================

fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdRoundBox(p: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

fn sdTorus(p: vec3<f32>, t: vec2<f32>) -> f32 {
  let q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

fn sdCapsule(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

fn sdCylinder(p: vec3<f32>, h: f32, r: f32) -> f32 {
  let d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0)));
}

fn sdOctahedron(p: vec3<f32>, s: f32) -> f32 {
  let ap = abs(p);
  return (ap.x + ap.y + ap.z - s) * 0.57735027;
}

// ============================================
// SDF OPERATIONS
// ============================================

fn opUnion(d1: f32, d2: f32) -> f32 {
  return min(d1, d2);
}

fn opSubtract(d1: f32, d2: f32) -> f32 {
  return max(-d1, d2);
}

fn opIntersect(d1: f32, d2: f32) -> f32 {
  return max(d1, d2);
}

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

fn opSmoothSubtract(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

fn opSmoothIntersect(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) + k * h * (1.0 - h);
}

// Domain operations
fn opRepeat(p: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
  return ((p % c) + c) % c - c * 0.5;
}

fn opTwist(p: vec3<f32>, k: f32) -> vec3<f32> {
  let c = cos(k * p.y);
  let s = sin(k * p.y);
  let m = mat2x2(c, -s, s, c);
  return vec3(m * p.xz, p.y);
}

fn opBend(p: vec3<f32>, k: f32) -> vec3<f32> {
  let c = cos(k * p.x);
  let s = sin(k * p.x);
  let m = mat2x2(c, -s, s, c);
  return vec3(m * p.xy, p.z);
}

// ============================================
// ROTATION MATRICES
// ============================================

fn rotateX(a: f32) -> mat3x3<f32> {
  let c = cos(a); let s = sin(a);
  return mat3x3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

fn rotateY(a: f32) -> mat3x3<f32> {
  let c = cos(a); let s = sin(a);
  return mat3x3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

fn rotateZ(a: f32) -> mat3x3<f32> {
  let c = cos(a); let s = sin(a);
  return mat3x3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

// ============================================
// SCENE DEFINITION
// ============================================

fn scene(p: vec3<f32>) -> f32 {
  let t = u.time;
  
  // Animated sphere
  let spherePos = vec3(sin(t) * 1.5, 0.5 + sin(t * 2.0) * 0.3, cos(t) * 1.5);
  let sphere = sdSphere(p - spherePos, 0.5);
  
  // Twisted torus
  var torusP = p - vec3(0.0, 0.5, 0.0);
  torusP = rotateX(t * 0.5) * rotateZ(t * 0.3) * torusP;
  let torus = sdTorus(torusP, vec2(0.8, 0.25));
  
  // Octahedron
  var octP = p - vec3(-2.0, 0.8, 0.0);
  octP = rotateY(t) * octP;
  let octahedron = sdOctahedron(octP, 0.6);
  
  // Rounded box
  var boxP = p - vec3(2.0, 0.5, 0.0);
  boxP = rotateY(t * 0.7) * rotateX(t * 0.5) * boxP;
  let box = sdRoundBox(boxP, vec3(0.4), 0.1);
  
  // Ground plane with waves
  let ground = p.y + 0.5 + sin(p.x * 2.0 + t) * 0.05 * cos(p.z * 2.0 + t * 0.7);
  
  // Combine with smooth unions
  var d = opSmoothUnion(sphere, torus, 0.3);
  d = opSmoothUnion(d, octahedron, 0.2);
  d = opSmoothUnion(d, box, 0.2);
  d = opSmoothUnion(d, ground, 0.1);
  
  return d;
}

// Scene with material ID
fn sceneWithMaterial(p: vec3<f32>) -> vec2<f32> {
  let t = u.time;
  
  let spherePos = vec3(sin(t) * 1.5, 0.5 + sin(t * 2.0) * 0.3, cos(t) * 1.5);
  let sphere = sdSphere(p - spherePos, 0.5);
  
  var torusP = p - vec3(0.0, 0.5, 0.0);
  torusP = rotateX(t * 0.5) * rotateZ(t * 0.3) * torusP;
  let torus = sdTorus(torusP, vec2(0.8, 0.25));
  
  var octP = p - vec3(-2.0, 0.8, 0.0);
  octP = rotateY(t) * octP;
  let octahedron = sdOctahedron(octP, 0.6);
  
  var boxP = p - vec3(2.0, 0.5, 0.0);
  boxP = rotateY(t * 0.7) * rotateX(t * 0.5) * boxP;
  let box = sdRoundBox(boxP, vec3(0.4), 0.1);
  
  let ground = p.y + 0.5;
  
  // Track material
  var d = sphere;
  var mat = 1.0;
  
  if (torus < d) { d = torus; mat = 2.0; }
  if (octahedron < d) { d = octahedron; mat = 3.0; }
  if (box < d) { d = box; mat = 4.0; }
  if (ground < d) { d = ground; mat = 0.0; }
  
  return vec2(d, mat);
}

// ============================================
// RAYMARCHING & SHADING
// ============================================

fn calcNormal(p: vec3<f32>) -> vec3<f32> {
  let e = vec2(0.0001, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

fn calcAO(p: vec3<f32>, n: vec3<f32>) -> f32 {
  var occ = 0.0;
  var sca = 1.0;
  for (var i = 0; i < 5; i++) {
    let h = 0.01 + 0.12 * f32(i) / 4.0;
    let d = scene(p + h * n);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

fn softShadow(ro: vec3<f32>, rd: vec3<f32>, mint: f32, maxt: f32, k: f32) -> f32 {
  var res = 1.0;
  var t = mint;
  for (var i = 0; i < 32; i++) {
    let h = scene(ro + rd * t);
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.1);
    if (res < 0.001 || t > maxt) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

fn getMaterial(matId: f32) -> vec3<f32> {
  if (matId == 0.0) { return vec3(0.4, 0.35, 0.3); }  // Ground
  if (matId == 1.0) { return vec3(1.0, 0.3, 0.2); }   // Sphere (red)
  if (matId == 2.0) { return vec3(0.2, 0.8, 0.4); }   // Torus (green)
  if (matId == 3.0) { return vec3(0.3, 0.4, 1.0); }   // Octahedron (blue)
  if (matId == 4.0) { return vec3(1.0, 0.8, 0.2); }   // Box (gold)
  return vec3(0.5);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Normalized device coordinates
  let aspect = u.resolution.x / u.resolution.y;
  var uv = (in.uv * 2.0 - 1.0) * vec2(aspect, 1.0);
  
  // Camera setup with mouse control
  let mouseX = u.mouse.x / u.resolution.x * 2.0 - 1.0;
  let mouseY = u.mouse.y / u.resolution.y * 2.0 - 1.0;
  
  let camDist = 5.0;
  let camAngle = vec2(mouseX * 3.14159, mouseY * 1.0 + 0.5);
  
  let ro = vec3(
    sin(camAngle.x) * cos(camAngle.y) * camDist,
    sin(camAngle.y) * camDist + 1.0,
    cos(camAngle.x) * cos(camAngle.y) * camDist
  );
  
  let target = vec3(0.0, 0.3, 0.0);
  let forward = normalize(target - ro);
  let right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);
  
  let rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);
  
  // Raymarching
  var t = 0.0;
  var matId = 0.0;
  var hit = false;
  
  for (var i = 0; i < 128; i++) {
    let p = ro + rd * t;
    let result = sceneWithMaterial(p);
    let d = result.x;
    
    if (d < 0.001) {
      matId = result.y;
      hit = true;
      break;
    }
    
    t += d;
    
    if (t > 50.0) { break; }
  }
  
  // Background gradient
  var col = mix(
    vec3(0.1, 0.1, 0.15),
    vec3(0.3, 0.2, 0.4),
    uv.y * 0.5 + 0.5
  );
  
  if (hit) {
    let p = ro + rd * t;
    let n = calcNormal(p);
    
    // Material color
    let matCol = getMaterial(matId);
    
    // Lighting
    let lightDir = normalize(vec3(1.0, 1.0, 0.5));
    let lightCol = vec3(1.0, 0.95, 0.9);
    
    // Diffuse
    let diff = max(dot(n, lightDir), 0.0);
    
    // Specular
    let halfVec = normalize(lightDir - rd);
    let spec = pow(max(dot(n, halfVec), 0.0), 32.0);
    
    // Ambient occlusion
    let ao = calcAO(p, n);
    
    // Soft shadows
    let shadow = softShadow(p + n * 0.01, lightDir, 0.02, 10.0, 16.0);
    
    // Fresnel
    let fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    
    // Combine
    col = matCol * (0.15 + diff * shadow * 0.7) * lightCol;
    col += spec * shadow * 0.5;
    col *= ao;
    col += fresnel * vec3(0.2, 0.3, 0.5) * 0.3;
    
    // Fog
    let fog = 1.0 - exp(-t * 0.05);
    col = mix(col, vec3(0.2, 0.2, 0.25), fog);
  }
  
  // Vignette
  let vignette = 1.0 - length(in.uv - 0.5) * 0.5;
  col *= vignette;
  
  // Gamma correction
  col = pow(col, vec3(0.4545));
  
  return vec4(col, 1.0);
}
`

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const stats = document.getElementById('stats') as HTMLDivElement
  
  // Set canvas size
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  
  // Initialize WebGPU
  const runtime = await initWebGPU(canvas)
  
  // Create uniform buffer
  const uniformBuffer = runtime.createUniformBuffer('uniforms', 32)
  
  // Create pipeline
  await runtime.createRenderPipeline('raymarch', RAYMARCHING_SHADER, {
    vertexEntry: 'vs_main',
    fragmentEntry: 'fs_main'
  })
  
  // Create bind group
  const bindGroup = runtime.createBindGroup('main', 'raymarch', [
    { binding: 0, buffer: uniformBuffer }
  ])
  
  // Mouse tracking
  let mouseX = window.innerWidth / 2
  let mouseY = window.innerHeight / 2
  
  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = window.innerHeight - e.clientY // Flip Y
  })
  
  // FPS counter
  let frameCount = 0
  let lastTime = performance.now()
  
  // Animation loop
  runtime.startAnimationLoop((time: number, deltaTime: number) => {
    // Update FPS
    frameCount++
    const now = performance.now()
    if (now - lastTime > 500) {
      const fps = Math.round(frameCount * 1000 / (now - lastTime))
      stats.textContent = `FPS: ${fps}`
      frameCount = 0
      lastTime = now
    }
    
    // Update uniforms
    const uniformData = new Float32Array([
      time,                    // time
      deltaTime,               // deltaTime
      frameCount,              // frame
      0,                       // padding
      canvas.width,            // resolution.x
      canvas.height,           // resolution.y
      mouseX * dpr,            // mouse.x
      mouseY * dpr             // mouse.y
    ])
    runtime.updateBuffer(uniformBuffer, uniformData)
    
    // Render
    runtime.renderFullscreenQuad('raymarch', bindGroup)
  })
  
  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    runtime.resize(canvas.width, canvas.height)
  })
}

main().catch(err => {
  console.error('Raymarching demo failed:', err)
  document.body.innerHTML = `
    <div style="color: #ff6b6b; padding: 2rem; text-align: center;">
      <h1>WebGPU Not Supported</h1>
      <p>${err.message}</p>
    </div>
  `
})
