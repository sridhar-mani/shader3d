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

// PBR Lighting functions
export const lightingLibrary = `
// Constants
const PI: f32 = 3.14159265359;

// Fresnel-Schlick approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3<f32>, roughness: f32) -> vec3<f32> {
    return F0 + (max(vec3<f32>(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Normal Distribution Function (GGX/Trowbridge-Reitz)
fn distributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;
    
    let num = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return num / denom;
}

// Geometry function (Schlick-GGX)
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = (roughness + 1.0);
    let k = (r * r) / 8.0;
    
    let num = NdotV;
    let denom = NdotV * (1.0 - k) + k;
    
    return num / denom;
}

// Smith's method for geometry
fn geometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let ggx2 = geometrySchlickGGX(NdotV, roughness);
    let ggx1 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

// Cook-Torrance BRDF
fn cookTorranceBRDF(
    N: vec3<f32>,
    V: vec3<f32>,
    L: vec3<f32>,
    albedo: vec3<f32>,
    metallic: f32,
    roughness: f32
) -> vec3<f32> {
    let H = normalize(V + L);
    
    let F0 = mix(vec3<f32>(0.04), albedo, metallic);
    
    let NDF = distributionGGX(N, H, roughness);
    let G = geometrySmith(N, V, L, roughness);
    let F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    let numerator = NDF * G * F;
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    let specular = numerator / denominator;
    
    let kS = F;
    var kD = vec3<f32>(1.0) - kS;
    kD = kD * (1.0 - metallic);
    
    let NdotL = max(dot(N, L), 0.0);
    
    return (kD * albedo / PI + specular) * NdotL;
}

// Simple Phong lighting
fn phongLighting(
    N: vec3<f32>,
    L: vec3<f32>,
    V: vec3<f32>,
    diffuseColor: vec3<f32>,
    specularColor: vec3<f32>,
    shininess: f32
) -> vec3<f32> {
    let ambient = 0.1 * diffuseColor;
    
    let diff = max(dot(N, L), 0.0);
    let diffuse = diff * diffuseColor;
    
    let R = reflect(-L, N);
    let spec = pow(max(dot(V, R), 0.0), shininess);
    let specular = spec * specularColor;
    
    return ambient + diffuse + specular;
}

// Blinn-Phong lighting
fn blinnPhongLighting(
    N: vec3<f32>,
    L: vec3<f32>,
    V: vec3<f32>,
    diffuseColor: vec3<f32>,
    specularColor: vec3<f32>,
    shininess: f32
) -> vec3<f32> {
    let ambient = 0.1 * diffuseColor;
    
    let diff = max(dot(N, L), 0.0);
    let diffuse = diff * diffuseColor;
    
    let H = normalize(L + V);
    let spec = pow(max(dot(N, H), 0.0), shininess);
    let specular = spec * specularColor;
    
    return ambient + diffuse + specular;
}

// Lambert diffuse
fn lambertDiffuse(N: vec3<f32>, L: vec3<f32>) -> f32 {
    return max(dot(N, L), 0.0);
}

// Oren-Nayar diffuse (for rough surfaces)
fn orenNayarDiffuse(
    N: vec3<f32>,
    L: vec3<f32>,
    V: vec3<f32>,
    roughness: f32
) -> f32 {
    let NdotL = dot(N, L);
    let NdotV = dot(N, V);
    
    let s = dot(L, V) - NdotL * NdotV;
    var t = 1.0;
    if (s > 0.0) {
        t = max(NdotL, NdotV);
    }
    
    let sigma2 = roughness * roughness;
    let A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
    let B = 0.45 * sigma2 / (sigma2 + 0.09);
    
    return max(NdotL, 0.0) * (A + B * s / t);
}

// Attenuation
fn pointLightAttenuation(distance: f32, constant: f32, linear: f32, quadratic: f32) -> f32 {
    return 1.0 / (constant + linear * distance + quadratic * distance * distance);
}

fn spotLightAttenuation(
    lightDir: vec3<f32>,
    spotDir: vec3<f32>,
    innerCutoff: f32,
    outerCutoff: f32
) -> f32 {
    let theta = dot(lightDir, normalize(-spotDir));
    let epsilon = innerCutoff - outerCutoff;
    return clamp((theta - outerCutoff) / epsilon, 0.0, 1.0);
}

// Shadow helpers
fn shadowBias(N: vec3<f32>, L: vec3<f32>, baseBias: f32) -> f32 {
    return max(baseBias * (1.0 - dot(N, L)), baseBias * 0.1);
}

fn pcfShadow(shadowCoord: vec3<f32>, shadowMap: texture_depth_2d, shadowSampler: sampler_comparison, texelSize: f32) -> f32 {
    var shadow = 0.0;
    for (var x: i32 = -1; x <= 1; x = x + 1) {
        for (var y: i32 = -1; y <= 1; y = y + 1) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            shadow = shadow + textureSampleCompare(shadowMap, shadowSampler, shadowCoord.xy + offset, shadowCoord.z);
        }
    }
    return shadow / 9.0;
}

// Tone mapping
fn reinhardToneMapping(color: vec3<f32>) -> vec3<f32> {
    return color / (color + vec3<f32>(1.0));
}

fn exposureToneMapping(color: vec3<f32>, exposure: f32) -> vec3<f32> {
    return vec3<f32>(1.0) - exp(-color * exposure);
}

fn acesToneMapping(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Gamma correction
fn gammaCorrect(color: vec3<f32>, gamma: f32) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / gamma));
}

fn linearToSRGB(color: vec3<f32>) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / 2.2));
}

fn sRGBToLinear(color: vec3<f32>) -> vec3<f32> {
    return pow(color, vec3<f32>(2.2));
}
`;

// Ray marching utilities
export const raymarchingLibrary = `
// Ray marching constants
const MAX_STEPS: i32 = 256;
const MAX_DIST: f32 = 100.0;
const SURF_DIST: f32 = 0.001;

// Basic ray marcher
fn rayMarch(ro: vec3<f32>, rd: vec3<f32>, scene: fn(vec3<f32>) -> f32) -> f32 {
    var dO = 0.0;
    
    for (var i = 0; i < MAX_STEPS; i = i + 1) {
        let p = ro + rd * dO;
        let dS = scene(p);
        dO = dO + dS;
        if (dO > MAX_DIST || dS < SURF_DIST) {
            break;
        }
    }
    
    return dO;
}

// Calculate normal via gradient
fn calcNormal(p: vec3<f32>, scene: fn(vec3<f32>) -> f32) -> vec3<f32> {
    let e = vec2<f32>(SURF_DIST, 0.0);
    let n = scene(p) - vec3<f32>(
        scene(p - e.xyy),
        scene(p - e.yxy),
        scene(p - e.yyx)
    );
    return normalize(n);
}

// Soft shadows
fn softShadow(ro: vec3<f32>, rd: vec3<f32>, mint: f32, maxt: f32, k: f32, scene: fn(vec3<f32>) -> f32) -> f32 {
    var res = 1.0;
    var t = mint;
    
    for (var i = 0; i < 64; i = i + 1) {
        let h = scene(ro + rd * t);
        if (h < 0.001) {
            return 0.0;
        }
        res = min(res, k * h / t);
        t = t + h;
        if (t > maxt) {
            break;
        }
    }
    
    return res;
}

// Ambient occlusion
fn ambientOcclusion(p: vec3<f32>, n: vec3<f32>, scene: fn(vec3<f32>) -> f32) -> f32 {
    var occ = 0.0;
    var sca = 1.0;
    
    for (var i = 0; i < 5; i = i + 1) {
        let h = 0.01 + 0.12 * f32(i) / 4.0;
        let d = scene(p + h * n);
        occ = occ + (h - d) * sca;
        sca = sca * 0.95;
    }
    
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// Camera utilities
fn createCamera(ro: vec3<f32>, ta: vec3<f32>, cr: f32) -> mat3x3<f32> {
    let cw = normalize(ta - ro);
    let cp = vec3<f32>(sin(cr), cos(cr), 0.0);
    let cu = normalize(cross(cw, cp));
    let cv = cross(cu, cw);
    return mat3x3<f32>(cu, cv, cw);
}

fn getRayDirection(uv: vec2<f32>, p: vec3<f32>, target: vec3<f32>, fov: f32) -> vec3<f32> {
    let cam = createCamera(p, target, 0.0);
    let z = 1.0 / tan(fov * 0.5);
    return normalize(cam * vec3<f32>(uv.x, uv.y, z));
}
`;

// Export all libraries combined
export const stdlib = {
  noise: noiseLibrary,
  color: colorLibrary,
  sdf: sdfLibrary,
  filter: filterLibrary,
  easing: easingLibrary,
  lighting: lightingLibrary,
  raymarching: raymarchingLibrary,
};

// Get all libraries as a single string
export function getAllStdlib(): string {
  return [noiseLibrary, colorLibrary, sdfLibrary, filterLibrary, easingLibrary, lightingLibrary, raymarchingLibrary].join('\n\n');
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
  if (code.includes('valueNoise') || code.includes('fbm') || code.includes('hash') || code.includes('simplexNoise') || code.includes('voronoi')) {
    required.push(noiseLibrary);
  }

  // Check for color functions
  if (code.includes('rgb2hsv') || code.includes('hsv2rgb') || code.includes('blend') || code.includes('hueShift') || code.includes('saturate3')) {
    required.push(colorLibrary);
  }

  // Check for SDF functions
  if (code.includes('sdCircle') || code.includes('sdBox') || code.includes('opUnion') || code.includes('sdSphere') || code.includes('opSmooth')) {
    required.push(sdfLibrary);
  }

  // Check for filter functions
  if (code.includes('vignette') || code.includes('filmGrain') || code.includes('dither') || code.includes('chromatic') || code.includes('barrel')) {
    required.push(filterLibrary);
  }

  // Check for easing functions
  if (code.includes('easeIn') || code.includes('easeOut') || code.includes('Bounce') || code.includes('Elastic')) {
    required.push(easingLibrary);
  }

  // Check for lighting functions
  if (code.includes('cookTorrance') || code.includes('phongLighting') || code.includes('fresnelSchlick') || code.includes('distributionGGX') || code.includes('toneMapping')) {
    required.push(lightingLibrary);
  }

  // Check for ray marching functions
  if (code.includes('rayMarch') || code.includes('calcNormal') || code.includes('softShadow') || code.includes('ambientOcclusion') || code.includes('createCamera')) {
    required.push(raymarchingLibrary);
  }

  return required.join('\n\n');
}
