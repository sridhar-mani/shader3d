// @shader3d/ladder - Programmatic API

import * as fs from 'fs';
import * as path from 'path';

export interface CompileOptions {
  minify?: boolean;
  sourceMaps?: boolean;
  includeStdlib?: boolean;
  target?: 'webgpu' | 'webgl2';
}

export interface CompileResult {
  code: string;
  metadata: ShaderMetadata;
  diagnostics: Diagnostic[];
}

export interface ShaderMetadata {
  entryPoints: Array<{ name: string; stage: 'vertex' | 'fragment' | 'compute' }>;
  bindings: Array<{ name: string; type: string; group: number; binding: number }>;
  structs: Array<{ name: string; fields: Array<{ name: string; type: string }> }>;
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string;
  line?: number;
  column?: number;
}

export interface ProjectConfig {
  name?: string;
  entry?: string | string[];
  outDir?: string;
  minify?: boolean;
  sourceMaps?: boolean;
  include?: string[];
  exclude?: string[];
}

export interface SkillLevel {
  level: number;
  name: string;
  description: string;
}

const SKILL_LEVELS: SkillLevel[] = [
  { level: 0, name: 'Beginner', description: 'Basic shader concepts' },
  { level: 1, name: 'Intermediate', description: 'Custom functions and math' },
  { level: 2, name: 'Advanced', description: 'Complex algorithms and optimizations' },
  { level: 3, name: 'Expert', description: 'Advanced graphics techniques' },
];

/**
 * Detect the skill level required for a shader based on its complexity
 */
export function detectSkillLevel(code: string): SkillLevel {
  let score = 0;

  // Check for advanced features
  if (/\bstruct\b/.test(code)) score += 1;
  if (/\b(for|while)\b/.test(code)) score += 1;
  if (/\bif\b/.test(code)) score += 0.5;
  if (/\barray\b/.test(code)) score += 1;
  if (/\btextureSample\b/.test(code)) score += 1;
  if (/\bdpd[xy]\b/.test(code)) score += 2;
  if (/\batomic\w+\b/.test(code)) score += 2;
  if (/\b(fbm|noise|voronoi)\b/.test(code)) score += 1;
  if (/\b(sdf|sd[A-Z]\w+)\b/.test(code)) score += 1.5;
  if (/\@compute\b/.test(code)) score += 1.5;
  if (/\bmat[34]x[34]\b/.test(code)) score += 1;

  // Count function definitions
  const funcCount = (code.match(/fn\s+\w+/g) || []).length;
  if (funcCount > 3) score += 1;
  if (funcCount > 6) score += 1;

  // Determine level
  if (score >= 8) return SKILL_LEVELS[3];
  if (score >= 5) return SKILL_LEVELS[2];
  if (score >= 2) return SKILL_LEVELS[1];
  return SKILL_LEVELS[0];
}

export interface ScaffoldOptions {
  template?: 'basic' | 'fullscreen' | 'compute' | 'raymarching';
  typescript?: boolean;
  git?: boolean;
}

/**
 * Create a new shader3d project
 */
export function scaffold(projectName: string, options: ScaffoldOptions = {}): void {
  const projectDir = path.resolve(process.cwd(), projectName);
  const template = options.template || 'basic';

  console.log(`Creating project: ${projectName} (${template} template)`);

  // Create directories
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src'));
  fs.mkdirSync(path.join(projectDir, 'dist'));

  // Create package.json
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'shader3d bundle && vite build',
      compile: 'shader3d compile src/main.shader.ts -o dist/shader.wgsl',
    },
    dependencies: {
      '@shader3d/core': '^0.1.0',
      '@shader3d/runtime': '^0.1.0',
    },
    devDependencies: {
      '@shader3d/vite-plugin': '^0.1.0',
      '@shader3d/ladder': '^0.1.0',
      vite: '^5.0.0',
    },
  };

  if (options.typescript) {
    (packageJson.devDependencies as Record<string, string>)['typescript'] = '^5.0.0';
  }

  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Create shader based on template
  const shaderContent = getTemplateShader(template);
  fs.writeFileSync(path.join(projectDir, 'src/main.shader.ts'), shaderContent);

  // Create config
  const config: ProjectConfig = {
    name: projectName,
    entry: 'src/main.shader.ts',
    outDir: 'dist',
    minify: false,
    sourceMaps: true,
  };
  fs.writeFileSync(path.join(projectDir, 'shader3d.config.json'), JSON.stringify(config, null, 2));

  // Initialize git if requested
  if (options.git) {
    fs.writeFileSync(path.join(projectDir, '.gitignore'), 'node_modules\ndist\n*.local\n');
  }

  console.log(`✅ Project created at ${projectDir}`);
}

function getTemplateShader(template: string): string {
  switch (template) {
    case 'fullscreen':
      return `
// Fullscreen shader effect
// Uses fullscreen triangle technique for efficiency

@fragment
function main(@builtin(position) fragPos: vec4f): @location(0) vec4f {
  const uv = fragPos.xy / resolution;
  const color = vec3f(uv, 0.5 + 0.5 * Math.sin(time));
  return vec4f(color, 1.0);
}
`.trim();

    case 'compute':
      return `
// Compute shader example
// Parallel computation on the GPU

struct Particle {
  position: vec2f,
  velocity: vec2f
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(64)
function update(@builtin(global_invocation_id) id: vec3u) {
  const i = id.x;
  if (i >= arrayLength(&particles)) { return; }
  
  particles[i].position += particles[i].velocity * deltaTime;
  
  // Boundary wrap
  if (particles[i].position.x > 1.0) { particles[i].position.x = -1.0; }
  if (particles[i].position.y > 1.0) { particles[i].position.y = -1.0; }
}
`.trim();

    case 'raymarching':
      return `
// Raymarching SDF shader
// Render 3D scenes using signed distance functions

fn sdSphere(p: vec3f, r: f32): f32 {
  return length(p) - r;
}

fn sdBox(p: vec3f, b: vec3f): f32 {
  const q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn scene(p: vec3f): f32 {
  const sphere = sdSphere(p - vec3f(0.0, 0.0, 5.0), 1.0);
  const box = sdBox(p - vec3f(2.0, 0.0, 5.0), vec3f(0.5));
  return min(sphere, box);
}

fn getNormal(p: vec3f): vec3f {
  const e = 0.001;
  return normalize(vec3f(
    scene(p + vec3f(e, 0.0, 0.0)) - scene(p - vec3f(e, 0.0, 0.0)),
    scene(p + vec3f(0.0, e, 0.0)) - scene(p - vec3f(0.0, e, 0.0)),
    scene(p + vec3f(0.0, 0.0, e)) - scene(p - vec3f(0.0, 0.0, e))
  ));
}

@fragment
function main(@builtin(position) fragPos: vec4f): @location(0) vec4f {
  const uv = (fragPos.xy - resolution * 0.5) / resolution.y;
  
  // Camera setup
  const ro = vec3f(0.0, 0.0, 0.0);
  const rd = normalize(vec3f(uv, 1.0));
  
  // Raymarch
  var t = 0.0;
  for (var i = 0; i < 64; i++) {
    const p = ro + rd * t;
    const d = scene(p);
    if (d < 0.001) { break; }
    t += d;
    if (t > 100.0) { break; }
  }
  
  // Shading
  if (t < 100.0) {
    const p = ro + rd * t;
    const n = getNormal(p);
    const light = vec3f(1.0, 1.0, -1.0);
    const diff = max(dot(n, normalize(light)), 0.0);
    return vec4f(vec3f(diff), 1.0);
  }
  
  return vec4f(0.0, 0.0, 0.0, 1.0);
}
`.trim();

    default: // basic
      return `
// Basic shader3d example
// Write shaders like TypeScript, compile to WGSL

@fragment
function main(@builtin(position) pos: vec4f): @location(0) vec4f {
  const uv = pos.xy / resolution;
  return vec4f(uv.x, uv.y, 0.5, 1.0);
}
`.trim();
  }
}

/**
 * Compile shader source code to WGSL
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const diagnostics: Diagnostic[] = [];
  let code = source;

  // Basic validation
  if (!source.trim()) {
    diagnostics.push({
      severity: 'error',
      message: 'Empty shader source',
    });
    return { code: '', metadata: { entryPoints: [], bindings: [], structs: [] }, diagnostics };
  }

  // Transform TypeScript-like syntax to WGSL
  code = transformSource(code);

  // Extract metadata
  const metadata = extractMetadata(source);

  // Check for entry points
  if (metadata.entryPoints.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message: 'No entry points found. Add @vertex, @fragment, or @compute decorator.',
    });
  }

  // Minify if requested
  if (options.minify) {
    code = minify(code);
  }

  return { code, metadata, diagnostics };
}

function transformSource(source: string): string {
  return (
    source
      // Transform function declarations
      .replace(/function\s+(\w+)/g, 'fn $1')
      // Transform const to let (WGSL uses let for constants in functions)
      .replace(/const\s+(\w+)/g, 'let $1')
      // Transform Math.* calls
      .replace(/Math\.sin\(/g, 'sin(')
      .replace(/Math\.cos\(/g, 'cos(')
      .replace(/Math\.tan\(/g, 'tan(')
      .replace(/Math\.abs\(/g, 'abs(')
      .replace(/Math\.floor\(/g, 'floor(')
      .replace(/Math\.ceil\(/g, 'ceil(')
      .replace(/Math\.min\(/g, 'min(')
      .replace(/Math\.max\(/g, 'max(')
      .replace(/Math\.pow\(/g, 'pow(')
      .replace(/Math\.sqrt\(/g, 'sqrt(')
      .replace(/Math\.PI/g, '3.141592653589793')
      .replace(/Math\.E/g, '2.718281828459045')
      // Transform types
      .replace(/:\s*vec2f\b/g, ': vec2<f32>')
      .replace(/:\s*vec3f\b/g, ': vec3<f32>')
      .replace(/:\s*vec4f\b/g, ': vec4<f32>')
      .replace(/:\s*mat4x4f\b/g, ': mat4x4<f32>')
  );
}

function extractMetadata(source: string): ShaderMetadata {
  const entryPoints: Array<{ name: string; stage: 'vertex' | 'fragment' | 'compute' }> = [];
  const bindings: Array<{ name: string; type: string; group: number; binding: number }> = [];
  const structs: Array<{ name: string; fields: Array<{ name: string; type: string }> }> = [];

  // Extract entry points
  const vertexMatch = source.match(/@vertex\s*(?:\n|\r\n)?\s*function\s+(\w+)/);
  if (vertexMatch) {
    entryPoints.push({ name: vertexMatch[1], stage: 'vertex' });
  }

  const fragmentMatch = source.match(/@fragment\s*(?:\n|\r\n)?\s*function\s+(\w+)/);
  if (fragmentMatch) {
    entryPoints.push({ name: fragmentMatch[1], stage: 'fragment' });
  }

  const computeMatch = source.match(/@compute\s*(?:\n|\r\n)?\s*function\s+(\w+)/);
  if (computeMatch) {
    entryPoints.push({ name: computeMatch[1], stage: 'compute' });
  }

  // Extract bindings
  const bindingRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var(?:<[^>]+>)?\s+(\w+)\s*:\s*(\w+)/g;
  let bindingMatch;
  while ((bindingMatch = bindingRegex.exec(source)) !== null) {
    bindings.push({
      name: bindingMatch[3],
      type: bindingMatch[4],
      group: parseInt(bindingMatch[1]),
      binding: parseInt(bindingMatch[2]),
    });
  }

  // Extract structs
  const structRegex = /struct\s+(\w+)\s*\{([^}]+)\}/g;
  let structMatch;
  while ((structMatch = structRegex.exec(source)) !== null) {
    const fields: Array<{ name: string; type: string }> = [];
    const fieldRegex = /(\w+)\s*:\s*(\w+(?:<[^>]+>)?)/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(structMatch[2])) !== null) {
      fields.push({ name: fieldMatch[1], type: fieldMatch[2] });
    }
    structs.push({ name: structMatch[1], fields });
  }

  return { entryPoints, bindings, structs };
}

/**
 * Minify WGSL code
 */
export function minify(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}\[\](),:;=+\-*/<>])\s*/g, '$1')
    .trim();
}

/**
 * Compile a shader file and write the output
 */
export async function compileFile(
  inputPath: string,
  outputPath?: string,
  options: CompileOptions = {}
): Promise<CompileResult> {
  const source = fs.readFileSync(inputPath, 'utf-8');
  const result = compile(source, options);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.code);
  }

  return result;
}

/**
 * Watch a file for changes and recompile
 */
export function watchFile(
  inputPath: string,
  outputPath: string,
  options: CompileOptions = {},
  callback?: (result: CompileResult) => void
): { stop: () => void } {
  let lastMtime = 0;

  const checkFile = () => {
    try {
      const stat = fs.statSync(inputPath);
      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        const result = compileFile(inputPath, outputPath, options);
        result.then((r) => callback?.(r));
      }
    } catch (e) {
      // File might have been deleted
    }
  };

  const interval = setInterval(checkFile, 500);
  checkFile(); // Initial compile

  return {
    stop: () => clearInterval(interval),
  };
}

/**
 * Load and parse a shader3d config file
 */
export function loadConfig(configPath: string = 'shader3d.config.json'): ProjectConfig {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

export { SKILL_LEVELS };
