import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SkillLevel } from './detector'
import { SKILL_LEVELS } from './detector'

/**
 * Project template types
 */
export type ProjectTemplate = 
  | 'minimal'          // Just shader and index.html
  | 'vite-vanilla'     // Vite + vanilla JS/TS
  | 'vite-react'       // Vite + React
  | 'vite-vue'         // Vite + Vue
  | 'threejs'          // Three.js project
  | 'particles'        // Particle system demo
  | 'raymarching'      // Raymarching/SDF demo

/**
 * Scaffold options
 */
export interface ScaffoldOptions {
  name: string
  template: ProjectTemplate
  level: SkillLevel
  typescript?: boolean
  installDeps?: boolean
  git?: boolean
}

/**
 * File to generate
 */
interface GeneratedFile {
  path: string
  content: string
}

/**
 * Project Scaffolder
 */
export class ProjectScaffolder {
  /**
   * Generate project files
   */
  scaffold(options: ScaffoldOptions): GeneratedFile[] {
    const files: GeneratedFile[] = []

    // Always include package.json
    files.push(this.generatePackageJson(options))

    // Generate template-specific files
    switch (options.template) {
      case 'minimal':
        files.push(...this.generateMinimalTemplate(options))
        break
      case 'vite-vanilla':
        files.push(...this.generateViteVanillaTemplate(options))
        break
      case 'vite-react':
        files.push(...this.generateViteReactTemplate(options))
        break
      case 'particles':
        files.push(...this.generateParticlesTemplate(options))
        break
      case 'raymarching':
        files.push(...this.generateRaymarchingTemplate(options))
        break
      default:
        files.push(...this.generateViteVanillaTemplate(options))
    }

    // Add config files
    if (options.typescript) {
      files.push(this.generateTsConfig(options))
    }

    if (options.git) {
      files.push(this.generateGitignore())
    }

    // Add README
    files.push(this.generateReadme(options))

    return files
  }

  /**
   * Write files to disk
   */
  async write(targetDir: string, files: GeneratedFile[]): Promise<void> {
    for (const file of files) {
      const fullPath = path.join(targetDir, file.path)
      const dir = path.dirname(fullPath)
      
      await fs.promises.mkdir(dir, { recursive: true })
      await fs.promises.writeFile(fullPath, file.content)
    }
  }

  private generatePackageJson(options: ScaffoldOptions): GeneratedFile {
    const pkg = {
      name: options.name,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: options.typescript ? 'tsc && vite build' : 'vite build',
        preview: 'vite preview'
      },
      dependencies: {} as Record<string, string>,
      devDependencies: {
        'vite': '^5.0.0',
        '@shader3d/core': '^0.1.0',
        '@shader3d/runtime': '^0.1.0',
        '@shader3d/vite-plugin': '^0.1.0'
      } as Record<string, string>
    }

    if (options.typescript) {
      pkg.devDependencies['typescript'] = '^5.3.0'
    }

    if (options.template === 'vite-react') {
      pkg.dependencies['react'] = '^18.2.0'
      pkg.dependencies['react-dom'] = '^18.2.0'
      pkg.devDependencies['@vitejs/plugin-react'] = '^4.2.0'
      if (options.typescript) {
        pkg.devDependencies['@types/react'] = '^18.2.0'
        pkg.devDependencies['@types/react-dom'] = '^18.2.0'
      }
    }

    if (options.template === 'threejs') {
      pkg.dependencies['three'] = '^0.160.0'
      if (options.typescript) {
        pkg.devDependencies['@types/three'] = '^0.160.0'
      }
    }

    return {
      path: 'package.json',
      content: JSON.stringify(pkg, null, 2)
    }
  }

  private generateMinimalTemplate(options: ScaffoldOptions): GeneratedFile[] {
    const ext = options.typescript ? 'ts' : 'js'
    
    return [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.name}</title>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script type="module" src="/src/main.${ext}"></script>
</body>
</html>`
      },
      {
        path: `src/main.${ext}`,
        content: this.getShaderExample(options.level, options.typescript)
      }
    ]
  }

  private generateViteVanillaTemplate(options: ScaffoldOptions): GeneratedFile[] {
    const files = this.generateMinimalTemplate(options)
    
    // Add vite config
    files.push({
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import shader3d from '@shader3d/vite-plugin'

export default defineConfig({
  plugins: [
    shader3d({
      hmr: true,
      performanceHints: true
    })
  ]
})
`
    })

    return files
  }

  private generateViteReactTemplate(options: ScaffoldOptions): GeneratedFile[] {
    const ext = options.typescript ? 'tsx' : 'jsx'
    
    return [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.${ext}"></script>
</body>
</html>`
      },
      {
        path: `src/main.${ext}`,
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')${options.typescript ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`
      },
      {
        path: `src/App.${ext}`,
        content: `import { useState } from 'react'
import ShaderCanvas from './components/ShaderCanvas'
import './App.css'

function App() {
  return (
    <div className="app">
      <h1>🎨 ${options.name}</h1>
      <ShaderCanvas />
    </div>
  )
}

export default App
`
      },
      {
        path: `src/components/ShaderCanvas.${ext}`,
        content: this.getReactShaderComponent(options.level, options.typescript)
      },
      {
        path: 'src/index.css',
        content: `body { margin: 0; font-family: system-ui; background: #1a1a2e; color: #fff; }
.app { padding: 2rem; text-align: center; }
h1 { margin-bottom: 1rem; }
`
      },
      {
        path: 'src/App.css',
        content: `canvas { border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
`
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import shader3d from '@shader3d/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    shader3d({ hmr: true })
  ]
})
`
      }
    ]
  }

  private generateParticlesTemplate(options: ScaffoldOptions): GeneratedFile[] {
    const files = this.generateViteVanillaTemplate(options)
    const ext = options.typescript ? 'ts' : 'js'
    
    // Replace main.ts with particle system
    files.find(f => f.path.includes('main.'))!.content = `
import { initWebGPU } from '@shader3d/runtime'

// Particle shader (Level ${options.level})
const PARTICLE_SHADER = \`
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  color: vec4<f32>,
}

struct Uniforms {
  time: f32,
  deltaTime: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];
  
  // Simple physics
  p.vel.y -= 0.001;
  p.pos += p.vel;
  
  // Wrap around
  if (p.pos.y < -1.0) { p.pos.y = 1.0; p.vel.y = 0.0; }
  
  particles[i] = p;
}
\`;

async function main() {
  const canvas = document.getElementById('canvas')${options.typescript ? ' as HTMLCanvasElement' : ''};
  const runtime = await initWebGPU(canvas);
  
  // Create particle buffer
  const PARTICLE_COUNT = 10000;
  const particleData = new Float32Array(PARTICLE_COUNT * 8);
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particleData[i * 8 + 0] = Math.random() * 2 - 1; // pos.x
    particleData[i * 8 + 1] = Math.random() * 2 - 1; // pos.y
    particleData[i * 8 + 2] = (Math.random() - 0.5) * 0.01; // vel.x
    particleData[i * 8 + 3] = (Math.random() - 0.5) * 0.01; // vel.y
    particleData[i * 8 + 4] = Math.random(); // color.r
    particleData[i * 8 + 5] = Math.random(); // color.g
    particleData[i * 8 + 6] = Math.random(); // color.b
    particleData[i * 8 + 7] = 1.0; // color.a
  }
  
  const particleBuffer = runtime.createStorageBuffer('particles', particleData.byteLength, particleData);
  const uniformBuffer = runtime.createUniformBuffer('uniforms', 16);
  
  // Create compute pipeline
  const pipeline = await runtime.createComputePipeline('particle_update', PARTICLE_SHADER, 'main');
  const bindGroup = runtime.createBindGroup('main', 'particle_update', [
    { binding: 0, buffer: particleBuffer },
    { binding: 1, buffer: uniformBuffer }
  ]);
  
  // Animation loop
  runtime.startAnimationLoop((time, dt) => {
    runtime.updateBuffer(uniformBuffer, new Float32Array([time, dt, 0, 0]));
    runtime.dispatchCompute('particle_update', bindGroup, [Math.ceil(PARTICLE_COUNT / 64)]);
  });
}

main().catch(console.error);
`

    return files
  }

  private generateRaymarchingTemplate(options: ScaffoldOptions): GeneratedFile[] {
    const files = this.generateViteVanillaTemplate(options)
    const ext = options.typescript ? 'ts' : 'js'
    
    files.find(f => f.path.includes('main.'))!.content = `
import { initWebGPU } from '@shader3d/runtime'

// Raymarching shader - SDF scene
const RAYMARCHING_SHADER = \`
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
    vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
  );
  var out: VertexOutput;
  out.position = vec4(positions[i], 0.0, 1.0);
  out.uv = positions[i] * 0.5 + 0.5;
  return out;
}

// SDF primitives
fn sdSphere(p: vec3<f32>, r: f32) -> f32 { return length(p) - r; }
fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

fn scene(p: vec3<f32>) -> f32 {
  // Animated sphere
  let sphere = sdSphere(p - vec3(sin(u.time) * 0.5, 0.0, 0.0), 0.5);
  // Box
  let box = sdBox(p - vec3(-0.5, 0.0, 0.0), vec3(0.3));
  // Ground plane
  let ground = p.y + 1.0;
  
  return opSmoothUnion(opSmoothUnion(sphere, box, 0.3), ground, 0.1);
}

fn calcNormal(p: vec3<f32>) -> vec3<f32> {
  let e = vec2(0.001, 0.0);
  return normalize(vec3(
    scene(p + e.xyy) - scene(p - e.xyy),
    scene(p + e.yxy) - scene(p - e.yxy),
    scene(p + e.yyx) - scene(p - e.yyx)
  ));
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = (in.uv * 2.0 - 1.0) * vec2(u.resolution.x / u.resolution.y, 1.0);
  
  // Camera
  let ro = vec3(0.0, 0.5, 3.0);
  let rd = normalize(vec3(uv, -1.5));
  
  // Raymarching
  var t = 0.0;
  for (var i = 0; i < 64; i++) {
    let p = ro + rd * t;
    let d = scene(p);
    if (d < 0.001) { break; }
    t += d;
    if (t > 20.0) { break; }
  }
  
  // Shading
  var col = vec3(0.1, 0.1, 0.15);
  if (t < 20.0) {
    let p = ro + rd * t;
    let n = calcNormal(p);
    let light = normalize(vec3(1.0, 1.0, 1.0));
    let diff = max(dot(n, light), 0.0);
    col = vec3(0.8, 0.6, 0.4) * diff + vec3(0.1);
  }
  
  return vec4(pow(col, vec3(0.4545)), 1.0);
}
\`;

async function main() {
  const canvas = document.getElementById('canvas')${options.typescript ? ' as HTMLCanvasElement' : ''};
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const runtime = await initWebGPU(canvas);
  const uniformBuffer = runtime.createUniformBuffer('uniforms', 32);
  
  await runtime.createRenderPipeline('raymarch', RAYMARCHING_SHADER, {
    vertexEntry: 'vs_main',
    fragmentEntry: 'fs_main'
  });
  
  const bindGroup = runtime.createBindGroup('main', 'raymarch', [
    { binding: 0, buffer: uniformBuffer }
  ]);
  
  runtime.startAnimationLoop((time) => {
    runtime.updateBuffer(uniformBuffer, new Float32Array([
      time, 0, 0, 0,
      canvas.width, canvas.height, 0, 0
    ]));
    runtime.renderFullscreenQuad('raymarch', bindGroup);
  });
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    runtime.resize(canvas.width, canvas.height);
  });
}

main().catch(console.error);
`

    return files
  }

  private getShaderExample(level: SkillLevel, typescript?: boolean): string {
    const type = typescript ? ': HTMLCanvasElement' : ''
    
    if (level === 0) {
      return `
/* @3d-shader fragment */
function gradient(uv) {
  return { r: uv.x, g: uv.y, b: 0.5, a: 1.0 };
}

// Setup canvas
const canvas = document.getElementById('canvas')${type};
canvas.width = 800;
canvas.height = 600;

// Note: Level 0 requires Shader3D runtime to execute
console.log('Level 0: Magic Comment shader ready');
`
    }

    return `
import { initWebGPU } from '@shader3d/runtime'

const GRADIENT_SHADER = \`
@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
  );
  return vec4(positions[i], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / vec2(800.0, 600.0);
  return vec4(uv.x, uv.y, 0.5, 1.0);
}
\`;

async function main() {
  const canvas = document.getElementById('canvas')${type};
  canvas.width = 800;
  canvas.height = 600;
  
  const runtime = await initWebGPU(canvas);
  await runtime.createRenderPipeline('gradient', GRADIENT_SHADER);
  
  runtime.startAnimationLoop(() => {
    runtime.renderFullscreenQuad('gradient');
  });
}

main().catch(console.error);
`
  }

  private getReactShaderComponent(level: SkillLevel, typescript?: boolean): string {
    const props = typescript ? ': React.FC' : ''
    const canvasType = typescript ? ' as HTMLCanvasElement' : ''
    
    return `
import { useEffect, useRef, useState } from 'react'
import { initWebGPU } from '@shader3d/runtime'

const ShaderCanvas${props} = () => {
  const canvasRef = useRef${typescript ? '<HTMLCanvasElement>' : ''}(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 600;
    
    let frameCount = 0;
    let lastTime = performance.now();
    
    const SHADER = \`
@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4(pos[i], 0.0, 1.0);
}

struct Uniforms { time: f32, }
@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / vec2(800.0, 600.0);
  let color = 0.5 + 0.5 * cos(u.time + uv.xyx + vec3(0.0, 2.0, 4.0));
  return vec4(color, 1.0);
}
    \`;
    
    initWebGPU(canvas).then(async runtime => {
      const uniformBuffer = runtime.createUniformBuffer('u', 16);
      await runtime.createRenderPipeline('main', SHADER);
      const bindGroup = runtime.createBindGroup('main', 'main', [
        { binding: 0, buffer: uniformBuffer }
      ]);
      
      runtime.startAnimationLoop((time) => {
        runtime.updateBuffer(uniformBuffer, new Float32Array([time, 0, 0, 0]));
        runtime.renderFullscreenQuad('main', bindGroup);
        
        frameCount++;
        const now = performance.now();
        if (now - lastTime > 1000) {
          setFps(Math.round(frameCount * 1000 / (now - lastTime)));
          frameCount = 0;
          lastTime = now;
        }
      });
    }).catch(console.error);
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <p>FPS: {fps}</p>
    </div>
  );
};

export default ShaderCanvas;
`
  }

  private generateTsConfig(options: ScaffoldOptions): GeneratedFile {
    return {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          jsx: options.template.includes('react') ? 'react-jsx' : undefined
        },
        include: ['src']
      }, null, 2)
    }
  }

  private generateGitignore(): GeneratedFile {
    return {
      path: '.gitignore',
      content: `node_modules
dist
.DS_Store
*.local
`
    }
  }

  private generateReadme(options: ScaffoldOptions): GeneratedFile {
    const levelInfo = SKILL_LEVELS[options.level]
    
    return {
      path: 'README.md',
      content: `# ${options.name}

A Shader3D project using **${levelInfo.name}** (Level ${options.level}).

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Skill Level: ${levelInfo.name}

${levelInfo.description}

### Features at this level:
${levelInfo.features.map(f => `- ${f}`).join('\n')}

## Learn More

- [Shader3D Documentation](https://shader3d.dev)
- [WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [WGSL Spec](https://www.w3.org/TR/WGSL/)
`
    }
  }
}

/**
 * Create project scaffolder
 */
export function createScaffolder(): ProjectScaffolder {
  return new ProjectScaffolder()
}

/**
 * Scaffold a new project
 */
export function scaffoldProject(options: ScaffoldOptions): GeneratedFile[] {
  const scaffolder = new ProjectScaffolder()
  return scaffolder.scaffold(options)
}
