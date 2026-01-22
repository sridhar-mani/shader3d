// @shader3d/vite-plugin - Vite plugin for shader3d compilation
// Build-time transformation of TypeScript shaders to WGSL

import type { Plugin, HmrContext, ViteDevServer } from 'vite';

// Simple filter pattern type (replaces @rollup/pluginutils)
type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null;

// Simple createFilter implementation
function createFilter(include?: FilterPattern, exclude?: FilterPattern): (id: string) => boolean {
  const includePatterns = include ? (Array.isArray(include) ? include : [include]) : null;
  const excludePatterns = exclude ? (Array.isArray(exclude) ? exclude : [exclude]) : [];

  return (id: string) => {
    // Check excludes first
    for (const pattern of excludePatterns) {
      if (typeof pattern === 'string') {
        if (id.includes(pattern)) return false;
      } else if (pattern instanceof RegExp) {
        if (pattern.test(id)) return false;
      }
    }

    // If no includes, match everything not excluded
    if (!includePatterns) return true;

    // Check includes
    for (const pattern of includePatterns) {
      if (typeof pattern === 'string') {
        if (id.includes(pattern) || id.endsWith(pattern.replace('**/*', ''))) return true;
      } else if (pattern instanceof RegExp) {
        if (pattern.test(id)) return true;
      }
    }

    return false;
  };
}

export interface Shader3dPluginOptions {
  /**
   * File extensions to process
   * @default ['.shader3d', '.shader3d.ts', '.shader.ts', '.wgsl.ts']
   */
  extensions?: string[];

  /**
   * Include patterns (minimatch)
   */
  include?: FilterPattern;

  /**
   * Exclude patterns (minimatch)
   */
  exclude?: FilterPattern;

  /**
   * Enable source maps
   * @default true in development
   */
  sourceMaps?: boolean;

  /**
   * Minify output in production
   * @default true
   */
  minify?: boolean;

  /**
   * Enable HMR for shaders
   * @default true
   */
  hmr?: boolean;

  /**
   * Include standard library functions automatically
   * @default true
   */
  includeStdlib?: boolean;

  /**
   * Custom import aliases for stdlib
   */
  stdlibAliases?: Record<string, string>;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

interface ShaderCache {
  source: string;
  compiled: string;
  metadata: ShaderMetadata;
  timestamp: number;
}

interface ShaderMetadata {
  entryPoints: Array<{ name: string; stage: string }>;
  bindings: Array<{ name: string; type: string; group: number; binding: number }>;
  structs: Array<{ name: string; fields: Array<{ name: string; type: string }> }>;
}

const DEFAULT_OPTIONS: Shader3dPluginOptions = {
  extensions: ['.shader3d', '.shader3d.ts', '.shader.ts', '.wgsl.ts'],
  sourceMaps: true,
  minify: true,
  hmr: true,
  includeStdlib: true,
  debug: false,
};

export default function shader3dPlugin(options: Shader3dPluginOptions = {}): Plugin {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cache = new Map<string, ShaderCache>();
  let server: ViteDevServer | null = null;
  let isProduction = false;

  // Create file filter
  const filter = createFilter(
    opts.include || opts.extensions!.map((ext) => `**/*${ext}`),
    opts.exclude
  );

  const log = (...args: unknown[]) => {
    if (opts.debug) {
      console.log('[shader3d]', ...args);
    }
  };

  return {
    name: 'vite-plugin-shader3d',

    configResolved(config) {
      isProduction = config.mode === 'production' || config.command === 'build';
      log('Mode:', isProduction ? 'production' : 'development');
    },

    configureServer(_server) {
      server = _server;
    },

    resolveId(source, importer) {
      // Handle stdlib imports
      if (source.startsWith('@shader3d/stdlib/')) {
        const module = source.replace('@shader3d/stdlib/', '');
        log('Resolving stdlib module:', module);
        return `\0shader3d-stdlib:${module}`;
      }

      // Handle aliased stdlib
      if (opts.stdlibAliases) {
        for (const [alias, target] of Object.entries(opts.stdlibAliases)) {
          if (source === alias) {
            return `\0shader3d-stdlib:${target}`;
          }
        }
      }

      return null;
    },

    load(id) {
      // Load stdlib modules
      if (id.startsWith('\0shader3d-stdlib:')) {
        const module = id.replace('\0shader3d-stdlib:', '');
        const stdlib = getStdlibModule(module);

        if (stdlib) {
          return `export default ${JSON.stringify(stdlib)};`;
        }

        this.error(`Unknown stdlib module: ${module}`);
      }

      return null;
    },

    transform(code: string, id: string) {
      // Check if this file should be processed
      const isShaderFile = opts.extensions!.some((ext) => id.endsWith(ext));
      if (!isShaderFile && !filter(id)) {
        return null;
      }

      log('Transforming:', id);

      try {
        // Check cache
        const cached = cache.get(id);
        if (cached && cached.source === code) {
          log('Using cached result for:', id);
          return {
            code: cached.compiled,
            map: null,
          };
        }

        // Compile the shader
        const result = compileShader(code, {
          sourceMaps: opts.sourceMaps && !isProduction,
          minify: opts.minify && isProduction,
          includeStdlib: opts.includeStdlib,
        });

        // Generate output module
        const output = generateModule(result, {
          id,
          hmr: opts.hmr && !isProduction,
        });

        // Cache result
        cache.set(id, {
          source: code,
          compiled: output,
          metadata: result.metadata,
          timestamp: Date.now(),
        });

        return {
          code: output,
          map: null, // TODO: Generate proper source map
        };
      } catch (error) {
        const err = error as Error;
        this.error(`Shader compilation error in ${id}: ${err.message}`);
      }
    },

    handleHotUpdate(ctx: HmrContext) {
      if (!opts.hmr) return;

      const isShaderFile = opts.extensions!.some((ext) => ctx.file.endsWith(ext));
      if (!isShaderFile) return;

      log('HMR update for:', ctx.file);

      // Invalidate cache
      cache.delete(ctx.file);

      // Custom HMR handling
      ctx.server.ws.send({
        type: 'custom',
        event: 'shader3d:update',
        data: {
          file: ctx.file,
          timestamp: Date.now(),
        },
      });

      return ctx.modules;
    },
  };
}

interface CompileOptions {
  sourceMaps?: boolean;
  minify?: boolean;
  includeStdlib?: boolean;
}

interface CompileOutput {
  code: string;
  metadata: ShaderMetadata;
  diagnostics: Array<{ severity: string; message: string }>;
}

function compileShader(source: string, options: CompileOptions): CompileOutput {
  // Import the core compiler dynamically to avoid circular dependencies
  // In a real implementation, this would be a proper import

  // For now, we'll implement a simplified inline compiler
  // This should be replaced with: import { compile } from '@shader3d/core'

  const result = simpleCompile(source, options);

  return {
    code: result.code,
    metadata: result.metadata,
    diagnostics: result.diagnostics,
  };
}

// Simplified compiler for the plugin (to be replaced with @shader3d/core)
function simpleCompile(source: string, options: CompileOptions): CompileOutput {
  // Basic transformation: wrap in WGSL template
  // This is a placeholder - the real implementation uses the full parser/transformer

  let code = source;

  // Detect decorators and transform
  const hasVertex = /@vertex/.test(source);
  const hasFragment = /@fragment/.test(source);
  const hasCompute = /@compute/.test(source);

  // Extract function bodies
  const functions = extractFunctions(source);

  // Build metadata
  const metadata: ShaderMetadata = {
    entryPoints: [],
    bindings: [],
    structs: [],
  };

  if (hasVertex) metadata.entryPoints.push({ name: 'vertex_main', stage: 'vertex' });
  if (hasFragment) metadata.entryPoints.push({ name: 'fragment_main', stage: 'fragment' });
  if (hasCompute) metadata.entryPoints.push({ name: 'compute_main', stage: 'compute' });

  // Transform TypeScript-like syntax to WGSL
  code = transformToWGSL(source);

  // Add stdlib if needed
  if (options.includeStdlib) {
    const stdlib = extractRequiredStdlib(code);
    if (stdlib) {
      code = stdlib + '\n\n' + code;
    }
  }

  // Minify if requested
  if (options.minify) {
    code = minifyWGSL(code);
  }

  return {
    code,
    metadata,
    diagnostics: [],
  };
}

function extractFunctions(
  source: string
): Array<{ name: string; body: string; decorators: string[] }> {
  const functions: Array<{ name: string; body: string; decorators: string[] }> = [];
  const regex = /((?:@\w+(?:\([^)]*\))?\s*)*)function\s+(\w+)\s*\([^)]*\)[^{]*\{/g;

  let match;
  while ((match = regex.exec(source)) !== null) {
    const decorators = match[1].match(/@\w+/g) || [];
    functions.push({
      name: match[2],
      body: '', // Would need proper parsing
      decorators,
    });
  }

  return functions;
}

function transformToWGSL(source: string): string {
  let result = source;

  // Transform function declarations
  result = result.replace(
    /function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g,
    (_, name, params, returnType) => {
      const wgslParams = transformParams(params);
      const wgslReturn = returnType ? transformType(returnType.trim()) : '';
      return `fn ${name}(${wgslParams})${wgslReturn ? ' -> ' + wgslReturn : ''} {`;
    }
  );

  // Transform variable declarations
  result = result.replace(/const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/g, (_, name, type) => {
    const wgslType = type ? ': ' + transformType(type.trim()) : '';
    return `let ${name}${wgslType} =`;
  });

  result = result.replace(/let\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/g, (_, name, type) => {
    const wgslType = type ? ': ' + transformType(type.trim()) : '';
    return `var ${name}${wgslType} =`;
  });

  // Transform type annotations
  result = transformTypeAnnotations(result);

  // Transform Math.* calls
  result = transformMathCalls(result);

  return result;
}

function transformParams(params: string): string {
  if (!params.trim()) return '';

  return params
    .split(',')
    .map((param) => {
      const match = param.trim().match(/(\w+)\s*:\s*(.+)/);
      if (match) {
        return `${match[1]}: ${transformType(match[2])}`;
      }
      return param.trim();
    })
    .join(', ');
}

function transformType(type: string): string {
  const typeMap: Record<string, string> = {
    number: 'f32',
    vec2f: 'vec2<f32>',
    vec3f: 'vec3<f32>',
    vec4f: 'vec4<f32>',
    mat4f: 'mat4x4<f32>',
    mat4x4f: 'mat4x4<f32>',
    mat3f: 'mat3x3<f32>',
    mat3x3f: 'mat3x3<f32>',
  };

  return typeMap[type] || type;
}

function transformTypeAnnotations(code: string): string {
  // Transform remaining type annotations in function bodies
  return code
    .replace(/:\s*vec2f\b/g, ': vec2<f32>')
    .replace(/:\s*vec3f\b/g, ': vec3<f32>')
    .replace(/:\s*vec4f\b/g, ': vec4<f32>')
    .replace(/:\s*mat4x4f\b/g, ': mat4x4<f32>')
    .replace(/:\s*number\b/g, ': f32');
}

function transformMathCalls(code: string): string {
  return code
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
    .replace(/Math\.exp\(/g, 'exp(')
    .replace(/Math\.log\(/g, 'log(')
    .replace(/Math\.PI/g, '3.141592653589793')
    .replace(/Math\.E/g, '2.718281828459045');
}

function minifyWGSL(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}\[\](),:;=+\-*/<>])\s*/g, '$1')
    .trim();
}

function getStdlibModule(module: string): string | null {
  const modules: Record<string, string> = {
    noise: `
fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, vec3<f32>(p3.y + 33.33, p3.z + 33.33, p3.x + 33.33));
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2<f32>(1.0, 0.0)), u.x),
    mix(hash12(i + vec2<f32>(0.0, 1.0)), hash12(i + vec2<f32>(1.0, 1.0)), u.x),
    u.y
  );
}
`,
    color: `
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
`,
    sdf: `
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdBox(p: vec2<f32>, b: vec2<f32>) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn opUnion(d1: f32, d2: f32) -> f32 {
  return min(d1, d2);
}

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
`,
  };

  return modules[module] || null;
}

function extractRequiredStdlib(code: string): string {
  const required: string[] = [];

  // Check for noise functions
  if (/\b(hash12|valueNoise|fbm|voronoi)\b/.test(code)) {
    const noise = getStdlibModule('noise');
    if (noise) required.push(noise);
  }

  // Check for color functions
  if (/\b(rgb2hsv|hsv2rgb|hueShift)\b/.test(code)) {
    const color = getStdlibModule('color');
    if (color) required.push(color);
  }

  // Check for SDF functions
  if (/\b(sdCircle|sdBox|opUnion|opSmooth)\b/.test(code)) {
    const sdf = getStdlibModule('sdf');
    if (sdf) required.push(sdf);
  }

  return required.join('\n');
}

interface ModuleOptions {
  id: string;
  hmr?: boolean;
}

function generateModule(result: CompileOutput, options: ModuleOptions): string {
  const { code, metadata } = result;

  let output = `
// Generated by @shader3d/vite-plugin
const shaderCode = ${JSON.stringify(code)};

const shaderMetadata = ${JSON.stringify(metadata, null, 2)};

export default shaderCode;
export { shaderCode, shaderMetadata };
export const code = shaderCode;
export const metadata = shaderMetadata;
`;

  // Add HMR support
  if (options.hmr) {
    output += `

// HMR Support
if (import.meta.hot) {
  import.meta.hot.accept();
  
  import.meta.hot.on('shader3d:update', (data) => {
    console.log('[shader3d] Hot update:', data.file);
    // Emit custom event for shader hot reload
    window.dispatchEvent(new CustomEvent('shader3d:hot-update', {
      detail: { code: shaderCode, metadata: shaderMetadata }
    }));
  });
}
`;
  }

  return output;
}

export { shader3dPlugin };
export type { ShaderMetadata, CompileOutput };
