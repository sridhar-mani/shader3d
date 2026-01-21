import * as path from 'node:path';
/**
 * Create Shader3D Vite plugin
 */
export default function shader3DPlugin(options = {}) {
    const { extensions = ['.shader3d', '.3d', '.wgsl.ts'], hmr = true, overlay = true, magicComments = true, performanceHints = true, strict = false,
    // Reserved for future GLSL fallback support
    // glslFallback = false,
     } = options;
    let server;
    let transpiler;
    // Module cache for HMR
    const moduleCache = new Map();
    // Simple hash function for cache invalidation
    const hashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    };
    return {
        name: 'vite-plugin-shader3d',
        // Run before other plugins
        enforce: 'pre',
        /**
         * Store dev server reference
         */
        configureServer(_server) {
            server = _server;
            // Custom middleware for shader debugging
            server.middlewares.use((req, res, next) => {
                if (req.url === '/__shader3d__/info') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        version: '0.1.0',
                        cachedModules: moduleCache.size,
                        extensions,
                        hmrEnabled: hmr
                    }));
                    return;
                }
                next();
            });
        },
        /**
         * Resolve virtual modules
         */
        resolveId(id) {
            // Virtual module for shader registry
            if (id === 'virtual:shader3d/registry') {
                return '\0virtual:shader3d/registry';
            }
            // Virtual module for runtime
            if (id === 'virtual:shader3d/runtime') {
                return '\0virtual:shader3d/runtime';
            }
            return null;
        },
        /**
         * Load virtual modules
         */
        load(id) {
            // Shader registry virtual module
            if (id === '\0virtual:shader3d/registry') {
                return generateRegistryModule(moduleCache);
            }
            // Runtime virtual module
            if (id === '\0virtual:shader3d/runtime') {
                return generateRuntimeModule();
            }
            return null;
        },
        /**
         * Transform shader files
         */
        async transform(code, id) {
            // Check if file should be processed
            if (!shouldProcess(id, extensions)) {
                // Check for magic comments in JS/TS files
                if (magicComments && (id.endsWith('.js') || id.endsWith('.ts') || id.endsWith('.tsx'))) {
                    if (hasMagicComments(code)) {
                        return await transformMagicComments(code, id, this, moduleCache, performanceHints);
                    }
                }
                return null;
            }
            try {
                // Lazy load transpiler
                if (!transpiler) {
                    // Dynamic import - the package is a workspace dependency
                    transpiler = await import('@shader3d/core').catch(() => {
                        // Fallback: use direct import for development
                        // @ts-expect-error - Resolved at runtime
                        return import('../../../core/src/index.js');
                    });
                }
                // Transpile the shader
                const result = transpiler.transpile(code, id, {
                    sourceMap: true,
                    strict,
                    debug: true
                });
                // Check for errors
                if (result.errors && result.errors.some(e => e.severity === 'error')) {
                    const errorMsg = formatErrors(result.errors, id);
                    this.error(errorMsg);
                    return null;
                }
                // Show warnings
                if (result.errors) {
                    result.errors
                        .filter(e => e.severity === 'warning')
                        .forEach(w => this.warn(w.message));
                }
                // Performance hints
                if (performanceHints) {
                    const shaderCount = (result.wgsl.match(/@compute|@vertex|@fragment/g) || []).length;
                    console.log(`\x1b[35m✨ Shader3D:\x1b[0m ${path.basename(id)} → ${shaderCount} GPU shader(s)`);
                }
                // Cache for HMR
                const hash = hashCode(code);
                moduleCache.set(id, {
                    js: result.js,
                    wgsl: result.wgsl,
                    timestamp: Date.now(),
                    hash
                });
                // Generate output with HMR support
                let output = result.js;
                // Add HMR client code
                if (hmr && server) {
                    output += generateHMRCode(id);
                }
                return {
                    code: output,
                    map: null // Source map is embedded
                };
            }
            catch (error) {
                this.error(`Failed to compile ${id}: ${error.message}`);
                return null;
            }
        },
        /**
         * Handle Hot Module Replacement
         */
        async handleHotUpdate(ctx) {
            const { file, server, read } = ctx;
            // Check if this is a shader file
            if (!shouldProcess(file, extensions)) {
                // Check for magic comments
                if (magicComments && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx'))) {
                    const content = await read();
                    if (!hasMagicComments(content)) {
                        return;
                    }
                }
                else {
                    return;
                }
            }
            if (!hmr)
                return;
            try {
                const source = await read();
                const hash = hashCode(source);
                const cached = moduleCache.get(file);
                // Skip if content hasn't changed
                if (cached && cached.hash === hash) {
                    return [];
                }
                // Lazy load transpiler
                if (!transpiler) {
                    transpiler = await import('@shader3d/core').catch(() => {
                        // @ts-expect-error - Resolved at runtime
                        return import('../../../core/src/index.js');
                    });
                }
                // Recompile
                const result = transpiler.transpile(source, file, {
                    sourceMap: true,
                    strict
                });
                // Handle errors with overlay
                if (result.errors && result.errors.some(e => e.severity === 'error')) {
                    if (overlay) {
                        server.ws.send({
                            type: 'error',
                            err: {
                                message: formatErrors(result.errors, file),
                                stack: '',
                                loc: result.errors[0]?.location ? {
                                    file: result.errors[0].location.file,
                                    line: result.errors[0].location.line,
                                    column: result.errors[0].location.column
                                } : undefined
                            }
                        });
                    }
                    return [];
                }
                // Update cache
                moduleCache.set(file, {
                    js: result.js,
                    wgsl: result.wgsl,
                    timestamp: Date.now(),
                    hash
                });
                // Send custom HMR event with shader code
                console.log(`\x1b[35m🔄 Shader3D:\x1b[0m Hot reloading ${path.basename(file)}`);
                server.ws.send({
                    type: 'custom',
                    event: 'shader3d:update',
                    data: {
                        file,
                        wgsl: result.wgsl,
                        timestamp: Date.now()
                    }
                });
                // Let Vite handle the JS module update
                return undefined;
            }
            catch (error) {
                console.error(`\x1b[31m❌ Shader3D:\x1b[0m HMR failed for ${file}:`, error.message);
                return [];
            }
        }
    };
}
// Helper Functions
function shouldProcess(id, extensions) {
    return extensions.some(ext => id.endsWith(ext));
}
function hasMagicComments(code) {
    return /@3d-shader\s+(compute|vertex|fragment)/.test(code) ||
        /@shader3d/.test(code);
}
async function transformMagicComments(code, id, ctx, cache, hints) {
    // Find magic comments
    const magicRegex = /\/\*\s*@3d-shader\s+(compute|vertex|fragment)(?:\s+\w+=\S+)*\s*\*\/\s*function\s+(\w+)/g;
    const matches = [...code.matchAll(magicRegex)];
    if (matches.length === 0) {
        return null;
    }
    if (hints) {
        console.log(`\x1b[33m🎯 Shader3D:\x1b[0m ${path.basename(id)} → ${matches.length} magic comment shader(s)`);
    }
    // Generate WGSL stubs for magic comment functions
    // Full conversion would happen with @shader3d/ladder
    const wgslCode = `// Auto-generated from magic comments in ${path.basename(id)}\n` +
        matches.map(m => `// @${m[1]} fn ${m[2]}`).join('\n');
    // Inject shader code export
    const output = `
// Shader3D Magic Comments - Auto-injected
export const __shader3d_magic__ = {
  functions: ${JSON.stringify(matches.map(m => ({ stage: m[1], name: m[2] })))},
  hint: "Run 'npx shader3d upgrade ${path.basename(id)}' for full type-safe shaders"
};

${code}
`;
    cache.set(id, {
        js: output,
        wgsl: wgslCode,
        timestamp: Date.now(),
        hash: ''
    });
    return { code: output, map: null };
}
function formatErrors(errors, file) {
    return errors.map(err => {
        const loc = err.location
            ? `:${err.location.line}:${err.location.column}`
            : '';
        return `[${err.severity.toUpperCase()}] ${path.basename(file)}${loc}\n  ${err.message}`;
    }).join('\n\n');
}
function generateHMRCode(id) {
    return `

// Shader3D HMR Client
if (import.meta.hot) {
  import.meta.hot.accept();
  
  import.meta.hot.on('shader3d:update', (data) => {
    if (data.file === ${JSON.stringify(id)}) {
      console.log('🔄 Shader3D: Shader updated, recreating pipelines...');
      
      // Dispatch event for runtime to handle
      window.dispatchEvent(new CustomEvent('shader3d:hot-update', {
        detail: {
          file: data.file,
          wgsl: data.wgsl,
          timestamp: data.timestamp
        }
      }));
    }
  });
}
`;
}
function generateRegistryModule(cache) {
    const entries = Array.from(cache.entries());
    return `
// Shader3D Registry - Auto-generated
export const shaderRegistry = new Map();

${entries.map(([file, mod]) => `
shaderRegistry.set(${JSON.stringify(file)}, {
  wgsl: ${JSON.stringify(mod.wgsl)},
  timestamp: ${mod.timestamp}
});
`).join('\n')}

export function getShader(file) {
  return shaderRegistry.get(file);
}

export function getAllShaders() {
  return Array.from(shaderRegistry.entries());
}
`;
}
function generateRuntimeModule() {
    return `
// Shader3D Runtime Helpers - Auto-generated

/**
 * Initialize WebGPU with error handling
 */
export async function initWebGPU() {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported. Use Chrome 113+, Firefox 141+, or Safari 26+');
  }
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No GPU adapter available');
  }
  
  const device = await adapter.requestDevice();
  
  return { adapter, device };
}

/**
 * Create shader module from WGSL code
 */
export function createShaderModule(device, code, label = 'shader') {
  return device.createShaderModule({
    label,
    code
  });
}

/**
 * Setup HMR listener for shader hot reloading
 */
export function setupShaderHMR(callback) {
  window.addEventListener('shader3d:hot-update', (event) => {
    callback(event.detail);
  });
}

/**
 * Built-in uniforms helper
 */
export function createUniformBuffer(device, size = 64) {
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
}

/**
 * Write standard uniforms
 */
export function writeUniforms(device, buffer, uniforms) {
  const data = new Float32Array([
    uniforms.time || 0,
    uniforms.deltaTime || 0,
    uniforms.frame || 0,
    0, // padding
    uniforms.resolution?.[0] || 800,
    uniforms.resolution?.[1] || 600,
    uniforms.mouse?.[0] || 0,
    uniforms.mouse?.[1] || 0,
    uniforms.mouse?.[2] || 0,
    uniforms.mouse?.[3] || 0
  ]);
  
  device.queue.writeBuffer(buffer, 0, data);
}
`;
}
//# sourceMappingURL=index.js.map