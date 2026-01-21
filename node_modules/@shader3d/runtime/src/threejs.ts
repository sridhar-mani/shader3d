// Three.js type definitions (to avoid hard dependency)
interface ThreeShaderMaterial {
  vertexShader: string
  fragmentShader: string
  uniforms: Record<string, { value: any }>
  needsUpdate: boolean
}

interface ThreeWebGLRenderer {
  domElement: HTMLCanvasElement
  render(scene: any, camera: any): void
}

interface ThreeScene {
  add(object: any): void
  remove(object: any): void
}

/**
 * Shader3D uniform descriptors for Three.js
 */
export interface UniformDescriptor {
  name: string
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat3' | 'mat4' | 'sampler2D' | 'samplerCube'
  value: any
}

/**
 * Options for Three.js adapter
 */
export interface ThreeJSAdapterOptions {
  /** Auto-inject time uniform */
  autoTime?: boolean
  /** Auto-inject resolution uniform */
  autoResolution?: boolean
  /** Auto-inject mouse uniform */
  autoMouse?: boolean
}

/**
 * Three.js Adapter for Shader3D
 * 
 * Bridges Shader3D generated GLSL with Three.js ShaderMaterial
 */
export class ThreeJSAdapter {
  private options: ThreeJSAdapterOptions
  private uniforms: Record<string, { value: any }> = {}
  private startTime: number = Date.now()
  private animationId?: number
  private canvas?: HTMLCanvasElement
  private mousePosition = { x: 0, y: 0 }

  constructor(options: ThreeJSAdapterOptions = {}) {
    this.options = {
      autoTime: true,
      autoResolution: true,
      autoMouse: true,
      ...options
    }

    this.setupBuiltinUniforms()
  }

  /**
   * Setup Shadertoy-compatible builtin uniforms
   */
  private setupBuiltinUniforms(): void {
    if (this.options.autoTime) {
      this.uniforms['time'] = { value: 0 }
      this.uniforms['iTime'] = { value: 0 } // Shadertoy compat
    }

    if (this.options.autoResolution) {
      this.uniforms['resolution'] = { value: { x: 800, y: 600 } }
      this.uniforms['iResolution'] = { value: { x: 800, y: 600, z: 1 } }
    }

    if (this.options.autoMouse) {
      this.uniforms['mouse'] = { value: { x: 0, y: 0, z: 0, w: 0 } }
      this.uniforms['iMouse'] = { value: { x: 0, y: 0, z: 0, w: 0 } }
    }
  }

  /**
   * Create Three.js ShaderMaterial from Shader3D GLSL
   * 
   * @param vertexShader - GLSL vertex shader code
   * @param fragmentShader - GLSL fragment shader code
   * @param customUniforms - Additional uniforms
   */
  createMaterial(
    vertexShader: string,
    fragmentShader: string,
    customUniforms?: Record<string, UniformDescriptor>
  ): ThreeShaderMaterial {
    // Merge custom uniforms
    if (customUniforms) {
      Object.entries(customUniforms).forEach(([name, desc]) => {
        this.uniforms[name] = { value: desc.value }
      })
    }

    // Inject uniform declarations if not present
    const processedVertex = this.injectUniforms(vertexShader)
    const processedFragment = this.injectUniforms(fragmentShader)

    return {
      vertexShader: processedVertex,
      fragmentShader: processedFragment,
      uniforms: this.uniforms,
      needsUpdate: true
    }
  }

  /**
   * Inject builtin uniform declarations into shader
   */
  private injectUniforms(shader: string): string {
    const declarations: string[] = []

    if (this.options.autoTime && !shader.includes('uniform float time')) {
      declarations.push('uniform float time;')
      declarations.push('uniform float iTime;')
    }

    if (this.options.autoResolution && !shader.includes('uniform vec')) {
      declarations.push('uniform vec2 resolution;')
      declarations.push('uniform vec3 iResolution;')
    }

    if (this.options.autoMouse && !shader.includes('uniform vec4 mouse')) {
      declarations.push('uniform vec4 mouse;')
      declarations.push('uniform vec4 iMouse;')
    }

    if (declarations.length === 0) return shader

    // Insert after #version or precision declarations
    const insertPoint = shader.indexOf('void main')
    if (insertPoint === -1) return shader

    return shader.slice(0, insertPoint) + 
           '\n// Shader3D Builtin Uniforms\n' +
           declarations.join('\n') + '\n\n' +
           shader.slice(insertPoint)
  }

  /**
   * Update builtin uniforms (call in animation loop)
   */
  update(): void {
    const elapsed = (Date.now() - this.startTime) / 1000

    if (this.options.autoTime) {
      this.uniforms['time'].value = elapsed
      this.uniforms['iTime'].value = elapsed
    }

    if (this.options.autoMouse) {
      this.uniforms['mouse'].value = {
        x: this.mousePosition.x,
        y: this.mousePosition.y,
        z: 0,
        w: 0
      }
      this.uniforms['iMouse'].value = this.uniforms['mouse'].value
    }
  }

  /**
   * Set resolution (call on resize)
   */
  setResolution(width: number, height: number): void {
    if (this.options.autoResolution) {
      this.uniforms['resolution'].value = { x: width, y: height }
      this.uniforms['iResolution'].value = { x: width, y: height, z: 1 }
    }
  }

  /**
   * Set mouse position
   */
  setMouse(x: number, y: number): void {
    this.mousePosition = { x, y }
  }

  /**
   * Setup mouse tracking on element
   */
  setupMouseTracking(element: HTMLElement): () => void {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect()
      this.mousePosition = {
        x: e.clientX - rect.left,
        y: rect.height - (e.clientY - rect.top) // Flip Y for shader coords
      }
    }

    element.addEventListener('mousemove', handleMouseMove)

    // Return cleanup function
    return () => {
      element.removeEventListener('mousemove', handleMouseMove)
    }
  }

  /**
   * Get uniform value
   */
  getUniform(name: string): any {
    return this.uniforms[name]?.value
  }

  /**
   * Set uniform value
   */
  setUniform(name: string, value: any): void {
    if (this.uniforms[name]) {
      this.uniforms[name].value = value
    } else {
      this.uniforms[name] = { value }
    }
  }

  /**
   * Get all uniforms (for Three.js ShaderMaterial)
   */
  getUniforms(): Record<string, { value: any }> {
    return this.uniforms
  }
}

/**
 * Create a fullscreen quad geometry (for fragment shader effects)
 * 
 * Usage with Three.js:
 * ```js
 * const geometry = createFullscreenQuad();
 * const material = adapter.createMaterial(vertexShader, fragmentShader);
 * const mesh = new THREE.Mesh(geometry, material);
 * ```
 */
export function createFullscreenQuadVertices(): Float32Array {
  // Two triangles forming a quad from -1 to 1
  return new Float32Array([
    -1, -1, 0,  // bottom-left
     1, -1, 0,  // bottom-right
    -1,  1, 0,  // top-left
    -1,  1, 0,  // top-left
     1, -1, 0,  // bottom-right
     1,  1, 0   // top-right
  ])
}

/**
 * Create fullscreen quad UVs
 */
export function createFullscreenQuadUVs(): Float32Array {
  return new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
  ])
}

/**
 * Standard vertex shader for fullscreen effects
 * Works with Shader3D fragment shaders
 */
export const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

/**
 * Convert Shadertoy-style mainImage to Three.js compatible fragment shader
 */
export function convertShadertoyFragment(shadertoyCode: string): string {
  // Wrap mainImage in main() and handle outputs
  const wrapper = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;

// Shadertoy code
${shadertoyCode}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  mainImage(fragColor, fragCoord);
}
`
  return wrapper
}

/**
 * Common Three.js includes that Shader3D shaders can use
 */
export const THREE_SHADER_CHUNKS = {
  common: `
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
`,

  noise: `
// Simple noise functions
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`,

  sdf: `
// SDF primitives
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

// SDF operations
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(-d1, d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
`
}

/**
 * Create Three.js adapter
 */
export function createThreeJSAdapter(options?: ThreeJSAdapterOptions): ThreeJSAdapter {
  return new ThreeJSAdapter(options)
}
