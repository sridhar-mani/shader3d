// Standard Library - Noise, color, SDF, and filter functions

// Noise functions WGSL implementations
export const noiseLibrary = `
// Hash functions for noise
fn hash12(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
    p3 = p3 + dot(p3, vec3<f32>(p3.y + 33.33, p3.z + 33.33, p3.x + 33.33));
    return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
    var p3 = fract(vec3<f32>(p.x, p.y, p.x) * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 = p3 + dot(p3, vec3<f32>(p3.y + 33.33, p3.z + 33.33, p3.x + 33.33));
    return fract(vec2<f32>((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y));
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
    var q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
    q = q + dot(q, vec3<f32>(q.y + 33.33, q.z + 33.33, q.x + 33.33));
    return fract(vec3<f32>((q.x + q.y) * q.z, (q.x + q.z) * q.y, (q.y + q.z) * q.x));
}

// Value noise
fn valueNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(hash12(i + vec2<f32>(0.0, 0.0)), hash12(i + vec2<f32>(1.0, 0.0)), u.x),
        mix(hash12(i + vec2<f32>(0.0, 1.0)), hash12(i + vec2<f32>(1.0, 1.0)), u.x),
        u.y
    );
}

// Perlin-style gradient noise
fn gradientNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    
    let a = hash22(i + vec2<f32>(0.0, 0.0));
    let b = hash22(i + vec2<f32>(1.0, 0.0));
    let c = hash22(i + vec2<f32>(0.0, 1.0));
    let d = hash22(i + vec2<f32>(1.0, 1.0));
    
    let va = dot(a - 0.5, f - vec2<f32>(0.0, 0.0));
    let vb = dot(b - 0.5, f - vec2<f32>(1.0, 0.0));
    let vc = dot(c - 0.5, f - vec2<f32>(0.0, 1.0));
    let vd = dot(d - 0.5, f - vec2<f32>(1.0, 1.0));
    
    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y) * 2.0;
}

// Simplex noise 2D
fn simplexNoise(p: vec2<f32>) -> f32 {
    let K1 = 0.366025404; // (sqrt(3)-1)/2
    let K2 = 0.211324865; // (3-sqrt(3))/6
    
    let i = floor(p + (p.x + p.y) * K1);
    let a = p - i + (i.x + i.y) * K2;
    let m = step(vec2<f32>(a.y, a.x), a);
    let o = a - m + K2;
    let b = a - 1.0 + 2.0 * K2;
    
    let h = max(0.5 - vec3<f32>(dot(a, a), dot(o, o), dot(b, b)), vec3<f32>(0.0));
    let n = h * h * h * h * vec3<f32>(
        dot(a, hash22(i) - 0.5),
        dot(o, hash22(i + m) - 0.5),
        dot(b, hash22(i + 1.0) - 0.5)
    );
    
    return dot(n, vec3<f32>(70.0));
}

// Fractal Brownian Motion
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var q = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * valueNoise(q * frequency);
        amplitude = amplitude * 0.5;
        frequency = frequency * 2.0;
    }
    
    return value;
}

// Voronoi / Cellular noise
fn voronoi(p: vec2<f32>) -> vec2<f32> {
    let n = floor(p);
    let f = fract(p);
    
    var md = 8.0;
    var m = vec2<f32>(0.0);
    
    for (var j = -1; j <= 1; j = j + 1) {
        for (var i = -1; i <= 1; i = i + 1) {
            let g = vec2<f32>(f32(i), f32(j));
            let o = hash22(n + g);
            let r = g + o - f;
            let d = dot(r, r);
            
            if (d < md) {
                md = d;
                m = n + g + o;
            }
        }
    }
    
    return vec2<f32>(sqrt(md), hash12(m));
}
`;

// Color manipulation functions
export const colorLibrary = `
// Color space conversions
fn rgb2hsv(c: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p = mix(vec4<f32>(c.b, c.g, K.w, K.z), vec4<f32>(c.g, c.b, K.x, K.y), step(c.b, c.g));
    let q = mix(vec4<f32>(p.x, p.y, p.w, c.r), vec4<f32>(c.r, p.y, p.z, p.x), step(p.x, c.r));
    
    let d = q.x - min(q.w, q.y);
    let e = 1.0e-10;
    return vec3<f32>(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

fn hsv2rgb(c: vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(vec3<f32>(c.x) + K.xyz) * 6.0 - vec3<f32>(K.w));
    return c.z * mix(vec3<f32>(K.x), clamp(p - vec3<f32>(K.x), vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

fn rgb2hsl(c: vec3<f32>) -> vec3<f32> {
    let cMax = max(max(c.r, c.g), c.b);
    let cMin = min(min(c.r, c.g), c.b);
    let delta = cMax - cMin;
    let l = (cMax + cMin) * 0.5;
    
    var h = 0.0;
    var s = 0.0;
    
    if (delta > 0.0) {
        s = delta / (1.0 - abs(2.0 * l - 1.0));
        
        if (cMax == c.r) {
            h = (c.g - c.b) / delta;
            if (c.g < c.b) { h = h + 6.0; }
        } else if (cMax == c.g) {
            h = (c.b - c.r) / delta + 2.0;
        } else {
            h = (c.r - c.g) / delta + 4.0;
        }
        h = h / 6.0;
    }
    
    return vec3<f32>(h, s, l);
}

fn hueShift(color: vec3<f32>, shift: f32) -> vec3<f32> {
    let hsv = rgb2hsv(color);
    return hsv2rgb(vec3<f32>(fract(hsv.x + shift), hsv.y, hsv.z));
}

fn saturate3(color: vec3<f32>, amount: f32) -> vec3<f32> {
    let gray = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    return mix(vec3<f32>(gray), color, amount);
}

fn brightness(color: vec3<f32>, amount: f32) -> vec3<f32> {
    return color * amount;
}

fn contrast(color: vec3<f32>, amount: f32) -> vec3<f32> {
    return (color - 0.5) * amount + 0.5;
}

fn gamma(color: vec3<f32>, g: f32) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / g));
}

// Blend modes
fn blendMultiply(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return base * blend;
}

fn blendScreen(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return 1.0 - (1.0 - base) * (1.0 - blend);
}

fn blendOverlay(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return mix(
        2.0 * base * blend,
        1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
        step(vec3<f32>(0.5), base)
    );
}

fn blendSoftLight(base: vec3<f32>, blend: vec3<f32>) -> vec3<f32> {
    return mix(
        2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
        sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
        step(vec3<f32>(0.5), blend)
    );
}
`;

// Signed Distance Field functions
export const sdfLibrary = `
// 2D SDF primitives
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdRoundedBox(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, vec2<f32>(0.0))) - r;
}

fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

fn sdTriangle(p: vec2<f32>, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>) -> f32 {
    let e0 = p1 - p0;
    let e1 = p2 - p1;
    let e2 = p0 - p2;
    let v0 = p - p0;
    let v1 = p - p1;
    let v2 = p - p2;
    
    let pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    let pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    let pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    
    let s = sign(e0.x * e2.y - e0.y * e2.x);
    let d = min(min(
        vec2<f32>(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
        vec2<f32>(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
        vec2<f32>(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x))
    );
    
    return -sqrt(d.x) * sign(d.y);
}

fn sdStar(p: vec2<f32>, r: f32, n: i32, m: f32) -> f32 {
    let an = 3.141593 / f32(n);
    let en = 3.141593 / m;
    let acs = vec2<f32>(cos(an), sin(an));
    let ecs = vec2<f32>(cos(en), sin(en));
    
    let bn = (atan2(p.x, p.y) % (2.0 * an)) - an;
    var q = length(p) * vec2<f32>(cos(bn), abs(sin(bn)));
    
    q = q - r * acs;
    q = q + ecs * clamp(-dot(q, ecs), 0.0, r * acs.y / ecs.y);
    
    return length(q) * sign(q.x);
}

// 3D SDF primitives
fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox3D(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdTorus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

fn sdCylinder(p: vec3<f32>, r: f32, h: f32) -> f32 {
    let d = abs(vec2<f32>(length(p.xz), p.y)) - vec2<f32>(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0)));
}

fn sdCone(p: vec3<f32>, c: vec2<f32>, h: f32) -> f32 {
    let q = h * vec2<f32>(c.x / c.y, -1.0);
    let w = vec2<f32>(length(p.xz), p.y);
    let a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
    let b = w - q * vec2<f32>(clamp(w.x / q.x, 0.0, 1.0), 1.0);
    let k = sign(q.y);
    let d = min(dot(a, a), dot(b, b));
    let s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
    return sqrt(d) * sign(s);
}

// SDF operations
fn opUnion(d1: f32, d2: f32) -> f32 {
    return min(d1, d2);
}

fn opSubtraction(d1: f32, d2: f32) -> f32 {
    return max(-d1, d2);
}

fn opIntersection(d1: f32, d2: f32) -> f32 {
    return max(d1, d2);
}

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

fn opSmoothSubtraction(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

fn opSmoothIntersection(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

// Transform operations
fn opRepeat(p: vec2<f32>, c: vec2<f32>) -> vec2<f32> {
    return (p % c) - c * 0.5;
}

fn opRotate(p: vec2<f32>, a: f32) -> vec2<f32> {
    let c = cos(a);
    let s = sin(a);
    return vec2<f32>(c * p.x - s * p.y, s * p.x + c * p.y);
}
`;

// Image processing / filter functions
export const filterLibrary = `
// Convolution helpers
fn sampleOffset(uv: vec2<f32>, offset: vec2<f32>, texelSize: vec2<f32>) -> vec2<f32> {
    return uv + offset * texelSize;
}

// Blur kernels
fn gaussianWeight(x: f32, sigma: f32) -> f32 {
    return exp(-(x * x) / (2.0 * sigma * sigma)) / (sqrt(2.0 * 3.141592653) * sigma);
}

// Edge detection
fn sobelX(samples: array<f32, 9>) -> f32 {
    return samples[0] * -1.0 + samples[2] * 1.0 +
           samples[3] * -2.0 + samples[5] * 2.0 +
           samples[6] * -1.0 + samples[8] * 1.0;
}

fn sobelY(samples: array<f32, 9>) -> f32 {
    return samples[0] * -1.0 + samples[1] * -2.0 + samples[2] * -1.0 +
           samples[6] * 1.0 + samples[7] * 2.0 + samples[8] * 1.0;
}

// Dithering
fn ditherBayer4x4(p: vec2<f32>) -> f32 {
    let pattern = array<f32, 16>(
        0.0,  8.0,  2.0,  10.0,
        12.0, 4.0,  14.0, 6.0,
        3.0,  11.0, 1.0,  9.0,
        15.0, 7.0,  13.0, 5.0
    );
    let idx = u32(p.x) % 4u + (u32(p.y) % 4u) * 4u;
    return pattern[idx] / 16.0;
}

// Quantization
fn quantize(color: vec3<f32>, levels: f32) -> vec3<f32> {
    return floor(color * levels + 0.5) / levels;
}

// Vignette
fn vignette(uv: vec2<f32>, intensity: f32, smoothness: f32) -> f32 {
    let center = uv * 2.0 - 1.0;
    let dist = length(center);
    return smoothstep(intensity, intensity - smoothness, dist);
}

// Film grain
fn filmGrain(uv: vec2<f32>, time: f32, intensity: f32) -> f32 {
    let x = (uv.x + 4.0) * (uv.y + 4.0) * (time + 10.0) * 10.0;
    return (fract(sin(x) * 43758.5453) - 0.5) * intensity;
}

// Chromatic aberration helper
fn chromaticOffset(uv: vec2<f32>, center: vec2<f32>, strength: f32) -> vec3<vec2<f32>> {
    let dir = uv - center;
    let dist = length(dir);
    let offset = normalize(dir) * dist * strength;
    return array<vec2<f32>, 3>(
        uv - offset,      // Red
        uv,               // Green
        uv + offset       // Blue
    );
}

// Barrel distortion
fn barrelDistortion(uv: vec2<f32>, strength: f32) -> vec2<f32> {
    let center = uv * 2.0 - 1.0;
    let dist = length(center);
    let distorted = center * (1.0 + strength * dist * dist);
    return distorted * 0.5 + 0.5;
}
`;

// Easing functions
export const easingLibrary = `
// Easing functions
fn easeInQuad(t: f32) -> f32 {
    return t * t;
}

fn easeOutQuad(t: f32) -> f32 {
    return 1.0 - (1.0 - t) * (1.0 - t);
}

fn easeInOutQuad(t: f32) -> f32 {
    if (t < 0.5) {
        return 2.0 * t * t;
    }
    return 1.0 - pow(-2.0 * t + 2.0, 2.0) / 2.0;
}

fn easeInCubic(t: f32) -> f32 {
    return t * t * t;
}

fn easeOutCubic(t: f32) -> f32 {
    return 1.0 - pow(1.0 - t, 3.0);
}

fn easeInOutCubic(t: f32) -> f32 {
    if (t < 0.5) {
        return 4.0 * t * t * t;
    }
    return 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

fn easeInExpo(t: f32) -> f32 {
    if (t == 0.0) { return 0.0; }
    return pow(2.0, 10.0 * t - 10.0);
}

fn easeOutExpo(t: f32) -> f32 {
    if (t == 1.0) { return 1.0; }
    return 1.0 - pow(2.0, -10.0 * t);
}

fn easeInOutExpo(t: f32) -> f32 {
    if (t == 0.0) { return 0.0; }
    if (t == 1.0) { return 1.0; }
    if (t < 0.5) {
        return pow(2.0, 20.0 * t - 10.0) / 2.0;
    }
    return (2.0 - pow(2.0, -20.0 * t + 10.0)) / 2.0;
}

fn easeInElastic(t: f32) -> f32 {
    let c4 = (2.0 * 3.141592653) / 3.0;
    if (t == 0.0) { return 0.0; }
    if (t == 1.0) { return 1.0; }
    return -pow(2.0, 10.0 * t - 10.0) * sin((t * 10.0 - 10.75) * c4);
}

fn easeOutElastic(t: f32) -> f32 {
    let c4 = (2.0 * 3.141592653) / 3.0;
    if (t == 0.0) { return 0.0; }
    if (t == 1.0) { return 1.0; }
    return pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
}

fn easeInBounce(t: f32) -> f32 {
    return 1.0 - easeOutBounce(1.0 - t);
}

fn easeOutBounce(t: f32) -> f32 {
    let n1 = 7.5625;
    let d1 = 2.75;
    var x = t;
    
    if (x < 1.0 / d1) {
        return n1 * x * x;
    } else if (x < 2.0 / d1) {
        x = x - 1.5 / d1;
        return n1 * x * x + 0.75;
    } else if (x < 2.5 / d1) {
        x = x - 2.25 / d1;
        return n1 * x * x + 0.9375;
    } else {
        x = x - 2.625 / d1;
        return n1 * x * x + 0.984375;
    }
}
`;

// Export all libraries combined
export const stdlib = {
  noise: noiseLibrary,
  color: colorLibrary,
  sdf: sdfLibrary,
  filter: filterLibrary,
  easing: easingLibrary,
};

// Get all libraries as a single string
export function getAllStdlib(): string {
  return [noiseLibrary, colorLibrary, sdfLibrary, filterLibrary, easingLibrary].join('\n\n');
}

// Get specific library functions
export function getStdlibFunction(category: keyof typeof stdlib, name?: string): string {
  const lib = stdlib[category];
  if (!name) return lib;

  // Extract specific function from library
  const regex = new RegExp(`fn ${name}\\([^}]+}`, 'gs');
  const match = lib.match(regex);
  return match ? match[0] : '';
}

// Analyze code for stdlib usage and return only needed functions
export function extractRequiredStdlib(code: string): string {
  const required: string[] = [];

  // Check for noise functions
  if (code.includes('valueNoise') || code.includes('fbm') || code.includes('hash')) {
    required.push(noiseLibrary);
  }

  // Check for color functions
  if (code.includes('rgb2hsv') || code.includes('hsv2rgb') || code.includes('blend')) {
    required.push(colorLibrary);
  }

  // Check for SDF functions
  if (code.includes('sdCircle') || code.includes('sdBox') || code.includes('opUnion')) {
    required.push(sdfLibrary);
  }

  // Check for filter functions
  if (code.includes('vignette') || code.includes('filmGrain') || code.includes('dither')) {
    required.push(filterLibrary);
  }

  // Check for easing functions
  if (
    code.includes('easeIn') ||
    code.includes('easeOut') ||
    code.includes('Bounce') ||
    code.includes('Elastic')
  ) {
    required.push(easingLibrary);
  }

  return required.join('\n\n');
}
