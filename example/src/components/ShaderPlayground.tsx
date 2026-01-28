import { useState, useCallback } from 'react';
import { parse, analyze, transform, codegen } from '@shader3d/core';

// ============================================================================
// SHADER3D EXAMPLE GALLERY
// These examples demonstrate why Shader3D's TypeScript-like syntax is superior
// to writing raw WGSL. Each example highlights specific TypeScript features.
// ============================================================================

const EXAMPLE_SHADERS = {
  // ---------------------------------------------------------------------------
  // BEGINNER EXAMPLES: Basic TypeScript syntax advantages
  // ---------------------------------------------------------------------------

  typedVariables: {
    name: 'Type-Safe Gradients',
    description: 'Demonstrates TypeScript-style explicit type annotations and const declarations for safer shader code.',
    code: `// TypeScript Feature: Explicit Type Annotations
// Unlike raw WGSL, Shader3D lets you use familiar TypeScript type syntax
// This prevents type mismatches at compile time, not GPU runtime!

@fragment
function main(uv: vec2f): vec4f {
  // Explicit types make intentions crystal clear
  const red: f32 = uv.x;           // TypeScript-style: type after colon
  const green: f32 = uv.y;         // The compiler catches type errors early
  const blue: f32 = 0.5;           // No more silent GPU failures!
  
  // Type-safe vector construction
  const color: vec3f = vec3f(red, green, blue);
  
  // Smooth gradient with type-checked math
  const brightness: f32 = (red + green + blue) / 3.0;
  const enhanced: vec3f = color * (0.5 + brightness * 0.5);
  
  return vec4f(enhanced, 1.0);
}`,
  },

  helperFunctions: {
    name: 'Reusable Helper Functions',
    description: 'Shows how TypeScript-style function definitions with typed parameters enable modular, reusable shader code.',
    code: `// TypeScript Feature: Typed Function Declarations
// Write reusable helper functions just like in TypeScript!
// Functions have clear parameter types and return types.

// Helper: Circle signed distance function
// Notice the TypeScript-style parameter typing
function circleSDF(point: vec2f, center: vec2f, radius: f32): f32 {
  return length(point - center) - radius;
}

// Helper: Soft edge for smooth anti-aliasing
function softEdge(distance: f32, smoothness: f32): f32 {
  return smoothstep(smoothness, -smoothness, distance);
}

// Helper: Create a color gradient between two colors
function lerpColor(a: vec3f, b: vec3f, t: f32): vec3f {
  return mix(a, b, clamp(t, 0.0, 1.0));
}

@fragment
function main(uv: vec2f): vec4f {
  // Use our typed helper functions - clean and readable!
  const centered: vec2f = uv * 2.0 - 1.0;
  
  const dist: f32 = circleSDF(centered, vec2f(0.0, 0.0), 0.5);
  const circle: f32 = softEdge(dist, 0.02);
  
  const innerColor: vec3f = vec3f(1.0, 0.4, 0.2);
  const outerColor: vec3f = vec3f(0.1, 0.2, 0.5);
  const gradient: vec3f = lerpColor(innerColor, outerColor, length(centered));
  
  return vec4f(gradient * circle + outerColor * (1.0 - circle), 1.0);
}`,
  },

  // ---------------------------------------------------------------------------
  // INTERMEDIATE EXAMPLES: Combined TypeScript features
  // ---------------------------------------------------------------------------

  structuredData: {
    name: 'Struct-Based Organization',
    description: 'Leverages TypeScript-style struct definitions for organizing complex shader data with named fields.',
    code: `// TypeScript Feature: Struct Definitions
// Define structured types for complex shader data
// Just like TypeScript interfaces, but for GPU data!

// Define a Light struct with typed fields
struct Light {
  position: vec3f,
  color: vec3f,
  intensity: f32
}

// Define Material properties
struct Material {
  albedo: vec3f,
  roughness: f32,
  metallic: f32
}

// Type-safe lighting calculation using our structs
function calculateLighting(
  normal: vec3f,
  viewDir: vec3f,
  light: Light,
  material: Material
): vec3f {
  const lightDir: vec3f = normalize(light.position);
  const diff: f32 = max(dot(normal, lightDir), 0.0);
  
  const halfDir: vec3f = normalize(lightDir + viewDir);
  const spec: f32 = pow(max(dot(normal, halfDir), 0.0), 32.0);
  
  const diffuse: vec3f = material.albedo * diff * light.color;
  const specular: vec3f = light.color * spec * (1.0 - material.roughness);
  
  return (diffuse + specular) * light.intensity;
}

@fragment
function main(uv: vec2f): vec4f {
  const centered: vec2f = uv * 2.0 - 1.0;
  
  // Initialize structs with clear, typed data
  var light: Light;
  light.position = vec3f(1.0, 1.0, 2.0);
  light.color = vec3f(1.0, 0.9, 0.8);
  light.intensity = 1.5;
  
  var mat: Material;
  mat.albedo = vec3f(0.8, 0.3, 0.2);
  mat.roughness = 0.3;
  mat.metallic = 0.0;
  
  // Create a simple surface normal from UV
  const normal: vec3f = normalize(vec3f(centered.x, centered.y, 1.0));
  const viewDir: vec3f = vec3f(0.0, 0.0, 1.0);
  
  const lit: vec3f = calculateLighting(normal, viewDir, light, mat);
  
  return vec4f(lit, 1.0);
}`,
  },

  animatedPatterns: {
    name: 'Animated Math Patterns',
    description: 'Uses Math.* functions (auto-mapped to WGSL) and auto-detected time uniform for dynamic visuals.',
    code: `// TypeScript Feature: Math.* Function Mapping
// Use familiar JavaScript Math functions - Shader3D maps them to WGSL!
// The 'time' uniform is auto-detected and injected automatically.

// Fractal-like pattern using modular functions
function fbm(p: vec2f, octaves: i32): f32 {
  var value: f32 = 0.0;
  var amplitude: f32 = 0.5;
  var frequency: f32 = 1.0;
  
  for (var i: i32 = 0; i < octaves; i = i + 1) {
    // Math.sin is automatically converted to WGSL sin()
    value = value + amplitude * (
      sin(p.x * frequency + time) * 
      cos(p.y * frequency + time * 0.7)
    );
    frequency = frequency * 2.0;
    amplitude = amplitude * 0.5;
  }
  
  return value;
}

// Create smooth color palette
function palette(t: f32): vec3f {
  const a: vec3f = vec3f(0.5, 0.5, 0.5);
  const b: vec3f = vec3f(0.5, 0.5, 0.5);
  const c: vec3f = vec3f(1.0, 1.0, 1.0);
  const d: vec3f = vec3f(0.263, 0.416, 0.557);
  
  // Using Math.PI would work too! (maps to 3.14159...)
  return a + b * cos(6.28318 * (c * t + d));
}

@fragment
function main(uv: vec2f): vec4f {
  const centered: vec2f = (uv - 0.5) * 4.0;
  
  // Animated distance field
  const dist: f32 = length(centered);
  const noise: f32 = fbm(centered + time * 0.3, 4);
  
  const pattern: f32 = sin(dist * 3.0 - time * 2.0 + noise * 2.0);
  const color: vec3f = palette(pattern * 0.5 + 0.5 + time * 0.1);
  
  // Vignette effect
  const vignette: f32 = 1.0 - smoothstep(0.5, 2.0, dist);
  
  return vec4f(color * vignette, 1.0);
}`,
  },

  conditionalLogic: {
    name: 'Conditional Shader Logic',
    description: 'Demonstrates if/else branching with comparison operators for creating complex procedural effects.',
    code: `// TypeScript Feature: Familiar Control Flow
// Use if/else, for loops, and comparison operators just like TypeScript!
// Much more readable than WGSL's select() or step() gymnastics.

// Determine which zone a point is in
function getZone(uv: vec2f): i32 {
  if (uv.x < 0.33) {
    if (uv.y < 0.5) {
      return 0;  // Bottom-left zone
    } else {
      return 1;  // Top-left zone
    }
  } else if (uv.x < 0.66) {
    return 2;    // Middle zone
  } else {
    return 3;    // Right zone
  }
}

// Get color for each zone with animation
function zoneColor(zone: i32, t: f32): vec3f {
  if (zone == 0) {
    return vec3f(
      0.5 + 0.5 * sin(t * 2.0),
      0.3,
      0.2
    );
  } else if (zone == 1) {
    return vec3f(
      0.2,
      0.5 + 0.5 * sin(t * 2.5),
      0.3
    );
  } else if (zone == 2) {
    return vec3f(
      0.3,
      0.2,
      0.5 + 0.5 * sin(t * 3.0)
    );
  } else {
    return vec3f(
      0.5 + 0.3 * sin(t * 1.5),
      0.5 + 0.3 * cos(t * 1.5),
      0.2
    );
  }
}

@fragment
function main(uv: vec2f): vec4f {
  const zone: i32 = getZone(uv);
  const baseColor: vec3f = zoneColor(zone, time);
  
  // Add animated grid pattern using loops
  var grid: f32 = 0.0;
  for (var i: i32 = 1; i <= 3; i = i + 1) {
    const scale: f32 = f32(i) * 10.0;
    const lineX: f32 = smoothstep(0.0, 0.02, abs(fract(uv.x * scale) - 0.5));
    const lineY: f32 = smoothstep(0.0, 0.02, abs(fract(uv.y * scale) - 0.5));
    grid = grid + (1.0 - lineX * lineY) * 0.15 / f32(i);
  }
  
  return vec4f(baseColor + grid, 1.0);
}`,
  },

  // ---------------------------------------------------------------------------
  // ADVANCED EXAMPLES: Complex patterns and optimization
  // ---------------------------------------------------------------------------

  proceduralNoise: {
    name: 'Procedural Noise Generator',
    description: 'Advanced shader demonstrating function composition, loops, and mathematical patterns for procedural generation.',
    code: `// TypeScript Feature: Function Composition & Reusability
// Build complex effects by composing simple, well-typed functions.
// This modular approach makes shaders maintainable and debuggable!

// Hash function - deterministic pseudo-random
function hash(p: vec2f): f32 {
  const k: vec2f = vec2f(0.3183099, 0.3678794);
  const q: vec2f = p * k + k.yx;
  return fract(16.0 * k.x * fract(q.x * q.y * (q.x + q.y)));
}

// 2D Value noise with smooth interpolation
function valueNoise(p: vec2f): f32 {
  const i: vec2f = floor(p);
  const f: vec2f = fract(p);
  
  // Smooth interpolation curve
  const u: vec2f = f * f * (3.0 - 2.0 * f);
  
  // Sample four corners
  const a: f32 = hash(i + vec2f(0.0, 0.0));
  const b: f32 = hash(i + vec2f(1.0, 0.0));
  const c: f32 = hash(i + vec2f(0.0, 1.0));
  const d: f32 = hash(i + vec2f(1.0, 1.0));
  
  // Bilinear interpolation
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion - layered noise
function fbmNoise(p: vec2f): f32 {
  var result: f32 = 0.0;
  var amplitude: f32 = 0.5;
  var frequency: f32 = 1.0;
  
  for (var i: i32 = 0; i < 5; i = i + 1) {
    result = result + amplitude * valueNoise(p * frequency);
    frequency = frequency * 2.0;
    amplitude = amplitude * 0.5;
  }
  
  return result;
}

// Domain warping for organic look
function warpedNoise(p: vec2f, t: f32): f32 {
  const warp1: vec2f = vec2f(
    fbmNoise(p + vec2f(0.0, 0.0) + t * 0.1),
    fbmNoise(p + vec2f(5.2, 1.3) + t * 0.15)
  );
  
  const warp2: vec2f = vec2f(
    fbmNoise(p + 4.0 * warp1 + vec2f(1.7, 9.2) + t * 0.2),
    fbmNoise(p + 4.0 * warp1 + vec2f(8.3, 2.8) + t * 0.25)
  );
  
  return fbmNoise(p + 2.0 * warp2);
}

@fragment
function main(uv: vec2f): vec4f {
  const scale: f32 = 3.0;
  const p: vec2f = uv * scale;
  
  const n: f32 = warpedNoise(p, time * 0.5);
  
  // Color mapping
  const col1: vec3f = vec3f(0.1, 0.1, 0.3);
  const col2: vec3f = vec3f(0.8, 0.4, 0.2);
  const col3: vec3f = vec3f(1.0, 0.9, 0.7);
  
  var color: vec3f;
  if (n < 0.4) {
    color = mix(col1, col2, n / 0.4);
  } else {
    color = mix(col2, col3, (n - 0.4) / 0.6);
  }
  
  return vec4f(color, 1.0);
}`,
  },

  interactiveRaymarching: {
    name: 'Interactive Raymarching',
    description: 'Showcases mouse interaction, complex math, and performance-optimized loops for 3D rendering on the GPU.',
    code: `// TypeScript Feature: Complex Algorithm Implementation
// Shader3D makes implementing raymarching clean and maintainable.
// Uses auto-detected 'mouse' and 'resolution' uniforms!

// Signed distance functions for primitives
function sdSphere(p: vec3f, r: f32): f32 {
  return length(p) - r;
}

function sdBox(p: vec3f, b: vec3f): f32 {
  const d: vec3f = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, vec3f(0.0)));
}

// Smooth minimum for organic blending
function smin(a: f32, b: f32, k: f32): f32 {
  const h: f32 = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Scene distance function - compose multiple shapes
function sceneSDF(p: vec3f): f32 {
  // Animated sphere position
  const spherePos: vec3f = vec3f(
    sin(time * 1.2) * 0.5,
    cos(time * 0.9) * 0.3,
    0.0
  );
  
  const sphere: f32 = sdSphere(p - spherePos, 0.5);
  const box: f32 = sdBox(p + vec3f(0.0, 0.0, 0.5), vec3f(0.3, 0.3, 0.3));
  
  // Blend shapes smoothly
  return smin(sphere, box, 0.3);
}

// Calculate surface normal via gradient
function calcNormal(p: vec3f): vec3f {
  const e: f32 = 0.001;
  return normalize(vec3f(
    sceneSDF(p + vec3f(e, 0.0, 0.0)) - sceneSDF(p - vec3f(e, 0.0, 0.0)),
    sceneSDF(p + vec3f(0.0, e, 0.0)) - sceneSDF(p - vec3f(0.0, e, 0.0)),
    sceneSDF(p + vec3f(0.0, 0.0, e)) - sceneSDF(p - vec3f(0.0, 0.0, e))
  ));
}

@fragment
function main(uv: vec2f): vec4f {
  // Mouse-controlled camera (auto-detected uniform!)
  const mouseInfluence: vec2f = (mouse / resolution - 0.5) * 2.0;
  
  const rayOrigin: vec3f = vec3f(0.0, 0.0, -3.0);
  const rayDir: vec3f = normalize(vec3f(
    (uv - 0.5) * 2.0 + mouseInfluence * 0.5,
    1.0
  ));
  
  // Raymarching loop - optimized iteration
  var t: f32 = 0.0;
  var hit: bool = false;
  
  for (var i: i32 = 0; i < 64; i = i + 1) {
    const p: vec3f = rayOrigin + rayDir * t;
    const d: f32 = sceneSDF(p);
    
    if (d < 0.001) {
      hit = true;
      break;
    }
    
    t = t + d;
    
    if (t > 10.0) {
      break;
    }
  }
  
  // Shading
  if (hit) {
    const p: vec3f = rayOrigin + rayDir * t;
    const n: vec3f = calcNormal(p);
    const light: vec3f = normalize(vec3f(1.0, 1.0, -1.0));
    const diff: f32 = max(dot(n, light), 0.0);
    const spec: f32 = pow(max(dot(reflect(-light, n), -rayDir), 0.0), 32.0);
    
    const col: vec3f = vec3f(0.4, 0.6, 0.8) * diff + vec3f(1.0) * spec * 0.5;
    return vec4f(col, 1.0);
  } else {
    // Gradient background
    return vec4f(vec3f(0.1 + uv.y * 0.1), 1.0);
  }
}`,
  },
};

type ShaderName = keyof typeof EXAMPLE_SHADERS;

interface CompileResult {
  success: boolean;
  wgsl?: string;
  error?: string;
  metadata?: {
    uniforms: string[];
    functions: string[];
  };
}

export function ShaderPlayground() {
  const [selectedShader, setSelectedShader] = useState<ShaderName>('typedVariables');
  const [customCode, setCustomCode] = useState(EXAMPLE_SHADERS.typedVariables.code);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCustom, setIsCustom] = useState(false);

  // Compile shader using @shader3d/core pipeline
  const compileShader = useCallback((source: string) => {
    try {
      // Step 1: Parse TypeScript-like syntax into AST
      const parseResult = parse(source);

      // Step 2: Transform AST into intermediate representation
      const transformResult = transform(parseResult.ast);

      // Step 3: Analyze for optimizations and validation
      const analysisResult = analyze(transformResult.ir);

      // Step 4: Generate WGSL code
      const codegenResult = codegen(analysisResult.ir);

      setCompileResult({
        success: true,
        wgsl: codegenResult.code,
        metadata: {
          uniforms: [],
          functions: [],
        },
      });
    } catch (err) {
      setCompileResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const handlePresetSelect = (name: ShaderName) => {
    setSelectedShader(name);
    setCustomCode(EXAMPLE_SHADERS[name].code);
    setIsCustom(false);
    setCompileResult(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      {/* Left Panel - Code Editor */}
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Example Shaders:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(Object.keys(EXAMPLE_SHADERS) as ShaderName[]).map((name) => (
              <button
                key={name}
                onClick={() => handlePresetSelect(name)}
                title={EXAMPLE_SHADERS[name].description}
                style={{
                  padding: '0.5rem 1rem',
                  background: selectedShader === name && !isCustom ? '#4a9eff' : '#2a2a3e',
                  color: selectedShader === name && !isCustom ? '#fff' : '#aaa',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {EXAMPLE_SHADERS[name].name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Shader3D Code (TypeScript-like syntax):
          </label>
          <textarea
            value={customCode}
            onChange={(e) => {
              setCustomCode(e.target.value);
              setIsCustom(true);
            }}
            style={{
              width: '100%',
              height: '280px',
              background: '#1a1a2e',
              color: '#e0e0e0',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={() => compileShader(customCode)}
          style={{
            padding: '0.75rem 2rem',
            background: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
          }}
        >
          🔧 Compile to WGSL
        </button>
      </div>

      {/* Right Panel - Compilation Result */}
      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontWeight: 500 }}>Compilation Result</h3>

        {compileResult === null && (
          <div
            style={{
              padding: '2rem',
              background: '#1a1a2e',
              borderRadius: '8px',
              color: '#888',
              textAlign: 'center',
            }}
          >
            Click "Compile to WGSL" to see the generated code
          </div>
        )}

        {compileResult?.success && (
          <>
            <div
              style={{
                padding: '0.75rem',
                background: '#1a4a1a',
                color: '#8f8',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
            >
              ✓ Compilation successful!
              {compileResult.metadata && (
                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
                  Uniforms: {compileResult.metadata.uniforms.join(', ') || 'none'} • Functions:{' '}
                  {compileResult.metadata.functions.join(', ') || 'none'}
                </div>
              )}
            </div>
            <pre
              style={{
                padding: '1rem',
                background: '#1a1a2e',
                borderRadius: '8px',
                fontSize: '0.8rem',
                overflow: 'auto',
                maxHeight: '350px',
                margin: 0,
              }}
            >
              {compileResult.wgsl}
            </pre>
          </>
        )}

        {compileResult?.success === false && (
          <div
            style={{
              padding: '1rem',
              background: '#4a1a1a',
              color: '#f88',
              borderRadius: '8px',
            }}
          >
            <strong>Compile Error:</strong>
            <pre style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap' }}>
              {compileResult.error}
            </pre>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', color: '#666', fontSize: '0.85rem' }}>
          <strong>How it works:</strong>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Write shaders in TypeScript-like syntax</li>
            <li>
              <code>parse()</code> → AST
            </li>
            <li>
              <code>transform()</code> → IR
            </li>
            <li>
              <code>analyze()</code> → Optimized IR
            </li>
            <li>
              <code>codegen()</code> → WGSL
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
