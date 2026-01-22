#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface CommandOptions {
  watch?: boolean;
  output?: string;
  minify?: boolean;
  sourceMaps?: boolean;
  format?: 'wgsl' | 'json' | 'both';
  verbose?: boolean;
  config?: string;
}

interface ProjectConfig {
  name?: string;
  entry?: string | string[];
  outDir?: string;
  minify?: boolean;
  sourceMaps?: boolean;
  include?: string[];
  exclude?: string[];
}

const VERSION = '0.1.0';
const HELP_TEXT = `
Shader3D CLI v${VERSION}
Write shaders like TypeScript, compile to WGSL

Usage: shader3d <command> [options]

Commands:
  init [name]          Create a new shader3d project
  compile <file>       Compile a shader file to WGSL
  watch <file>         Watch and recompile on changes
  analyze <file>       Analyze shader for errors and suggestions
  bundle               Bundle all shaders in project
  upgrade              Upgrade shader3d to latest version

Options:
  -o, --output <path>  Output file path
  -w, --watch          Watch mode
  -m, --minify         Minify output
  --no-sourcemaps      Disable source maps
  -f, --format <type>  Output format: wgsl, json, or both
  -v, --verbose        Verbose output
  -c, --config <path>  Path to config file
  -h, --help           Show help
  --version            Show version

Examples:
  shader3d init my-shader-project
  shader3d compile src/shader.ts -o dist/shader.wgsl
  shader3d watch src/**/*.shader.ts
  shader3d analyze src/shader.ts
  shader3d bundle -c shader3d.config.json
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.includes('--version')) {
    console.log(`shader3d v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);
  const options = parseOptions(commandArgs);

  try {
    switch (command) {
      case 'init':
        await initCommand(commandArgs[0], options);
        break;
      case 'compile':
        await compileCommand(commandArgs[0], options);
        break;
      case 'watch':
        await watchCommand(commandArgs[0], options);
        break;
      case 'analyze':
        await analyzeCommand(commandArgs[0], options);
        break;
      case 'bundle':
        await bundleCommand(options);
        break;
      case 'upgrade':
        await upgradeCommand(options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "shader3d --help" for usage');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

function parseOptions(args: string[]): CommandOptions {
  const options: CommandOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-w':
      case '--watch':
        options.watch = true;
        break;
      case '-m':
      case '--minify':
        options.minify = true;
        break;
      case '--no-sourcemaps':
        options.sourceMaps = false;
        break;
      case '-f':
      case '--format':
        options.format = args[++i] as 'wgsl' | 'json' | 'both';
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-c':
      case '--config':
        options.config = args[++i];
        break;
    }
  }

  return options;
}

async function initCommand(name: string = 'shader3d-project', options: CommandOptions) {
  const projectDir = path.resolve(process.cwd(), name);

  console.log(`\n🎨 Creating new shader3d project: ${name}\n`);

  // Check if directory exists
  if (fs.existsSync(projectDir)) {
    throw new Error(`Directory already exists: ${projectDir}`);
  }

  // Create project structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src'));
  fs.mkdirSync(path.join(projectDir, 'dist'));

  // Create package.json
  const packageJson = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'shader3d bundle && vite build',
      compile: 'shader3d compile src/main.shader.ts -o dist/shader.wgsl',
      watch: 'shader3d watch src/**/*.shader.ts',
      analyze: 'shader3d analyze src/main.shader.ts',
    },
    dependencies: {
      '@shader3d/core': '^0.1.0',
      '@shader3d/runtime': '^0.1.0',
    },
    devDependencies: {
      '@shader3d/vite-plugin': '^0.1.0',
      '@shader3d/ladder': '^0.1.0',
      typescript: '^5.0.0',
      vite: '^5.0.0',
    },
  };
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
    },
    include: ['src/**/*'],
  };
  fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // Create vite.config.ts
  const viteConfig = `
import { defineConfig } from 'vite'
import shader3d from '@shader3d/vite-plugin'

export default defineConfig({
  plugins: [shader3d()]
})
`.trim();
  fs.writeFileSync(path.join(projectDir, 'vite.config.ts'), viteConfig);

  // Create shader3d.config.json
  const shader3dConfig: ProjectConfig = {
    name,
    entry: 'src/main.shader.ts',
    outDir: 'dist',
    minify: false,
    sourceMaps: true,
  };
  fs.writeFileSync(
    path.join(projectDir, 'shader3d.config.json'),
    JSON.stringify(shader3dConfig, null, 2)
  );

  // Create example shader
  const exampleShader = `
// Example shader3d file
// Write shaders like TypeScript, compile to WGSL

@fragment
function main(@builtin(position) pos: vec4f): @location(0) vec4f {
  // Get normalized coordinates
  const uv = pos.xy / resolution;
  
  // Create gradient
  const color = vec3f(uv.x, uv.y, 0.5 + 0.5 * Math.sin(time));
  
  return vec4f(color, 1.0);
}
`.trim();
  fs.writeFileSync(path.join(projectDir, 'src/main.shader.ts'), exampleShader);

  // Create index.html
  const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`.trim();
  fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml);

  // Create main.ts
  const mainTs = `
import { createShaderRenderer, createRenderLoop } from '@shader3d/runtime'
import shaderCode from './main.shader.ts'

async function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const renderer = await createShaderRenderer(canvas, shaderCode, [
    { name: 'time', type: 'f32', value: 0 },
    { name: 'resolution', type: 'vec2f', value: [canvas.width, canvas.height] }
  ])

  const loop = createRenderLoop((frame) => {
    renderer.updateUniforms({
      time: frame.time,
      resolution: frame.resolution
    })
    renderer.render()
  })

  loop.start()

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    renderer.resize(canvas.width, canvas.height)
  })
}

init().catch(console.error)
`.trim();
  fs.writeFileSync(path.join(projectDir, 'src/main.ts'), mainTs);

  // Create .gitignore
  const gitignore = `
node_modules
dist
*.local
.DS_Store
`.trim();
  fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore);

  console.log('✅ Project created successfully!');
  console.log(`
Next steps:
  cd ${name}
  npm install
  npm run dev
`);
}

async function compileCommand(inputFile: string, options: CommandOptions) {
  if (!inputFile) {
    throw new Error('Input file required. Usage: shader3d compile <file>');
  }

  const inputPath = path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  console.log(`\n🔨 Compiling: ${inputFile}\n`);

  const source = fs.readFileSync(inputPath, 'utf-8');

  // Compile using core compiler
  const result = compileShader(source, {
    minify: options.minify,
    sourceMaps: options.sourceMaps !== false,
  });

  // Check for errors
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:');
    for (const err of errors) {
      console.error(`  ❌ ${err.message}`);
    }
    process.exit(1);
  }

  // Determine output path
  const outputPath = options.output || inputPath.replace(/\.(ts|shader3d)$/, '.wgsl');

  // Write output
  const format = options.format || 'wgsl';

  if (format === 'wgsl' || format === 'both') {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.code);
    console.log(`✅ WGSL written to: ${outputPath}`);
  }

  if (format === 'json' || format === 'both') {
    const jsonPath = outputPath.replace('.wgsl', '.json');
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          code: result.code,
          metadata: result.metadata,
        },
        null,
        2
      )
    );
    console.log(`✅ JSON written to: ${jsonPath}`);
  }

  // Show warnings
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
  if (warnings.length > 0 && options.verbose) {
    console.log('\nWarnings:');
    for (const warn of warnings) {
      console.log(`  ⚠️  ${warn.message}`);
    }
  }

  console.log('\n✨ Compilation complete!');
}

async function watchCommand(pattern: string, options: CommandOptions) {
  if (!pattern) {
    throw new Error('File pattern required. Usage: shader3d watch <pattern>');
  }

  console.log(`\n👀 Watching: ${pattern}\n`);
  console.log('Press Ctrl+C to stop\n');

  // Simple file watching implementation
  const files = findFiles(pattern);
  const lastModified = new Map<string, number>();

  // Initial compile
  for (const file of files) {
    try {
      await compileCommand(file, { ...options, verbose: false });
      lastModified.set(file, Date.now());
    } catch (e) {
      console.error(`Error compiling ${file}:`, (e as Error).message);
    }
  }

  // Watch for changes
  const checkInterval = setInterval(() => {
    for (const file of files) {
      try {
        const stat = fs.statSync(file);
        const mtime = stat.mtimeMs;
        const last = lastModified.get(file) || 0;

        if (mtime > last) {
          console.log(`\n📝 File changed: ${file}`);
          compileCommand(file, { ...options, verbose: false })
            .then(() => lastModified.set(file, Date.now()))
            .catch((e) => console.error('Compile error:', (e as Error).message));
        }
      } catch (e) {
        // File might have been deleted
      }
    }
  }, 500);

  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    console.log('\n\n👋 Watch mode stopped');
    process.exit(0);
  });
}

async function analyzeCommand(inputFile: string, options: CommandOptions) {
  if (!inputFile) {
    throw new Error('Input file required. Usage: shader3d analyze <file>');
  }

  const inputPath = path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  console.log(`\n🔍 Analyzing: ${inputFile}\n`);

  const source = fs.readFileSync(inputPath, 'utf-8');

  // Compile and analyze
  const result = compileShader(source, { sourceMaps: false });

  // Display results
  console.log('📊 Analysis Results:');
  console.log('─'.repeat(40));

  // Metadata
  console.log(`\n📦 Shader Info:`);
  console.log(`   Entry Points: ${result.metadata.entryPoints.length}`);
  for (const ep of result.metadata.entryPoints) {
    console.log(`     - ${ep.name} (${ep.stage})`);
  }
  console.log(`   Uniforms: ${result.metadata.bindings.length}`);
  for (const b of result.metadata.bindings) {
    console.log(`     - ${b.name}: ${b.type}`);
  }
  console.log(`   Structs: ${result.metadata.structs.length}`);

  // Diagnostics
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
  const hints = result.diagnostics.filter((d) => d.severity === 'hint');

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    for (const err of errors) {
      console.log(`   ${err.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    for (const warn of warnings) {
      console.log(`   ${warn.message}`);
    }
  }

  if (hints.length > 0) {
    console.log(`\n💡 Suggestions (${hints.length}):`);
    for (const hint of hints) {
      console.log(`   ${hint.message}`);
    }
  }

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  if (errors.length === 0) {
    console.log('✅ No errors found!');
  } else {
    console.log(`❌ Found ${errors.length} error(s)`);
    process.exit(1);
  }
}

async function bundleCommand(options: CommandOptions) {
  console.log('\n📦 Bundling shaders...\n');

  // Load config
  const configPath = options.config || 'shader3d.config.json';
  let config: ProjectConfig = {};

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`Using config: ${configPath}`);
  }

  const entries = Array.isArray(config.entry)
    ? config.entry
    : [config.entry || 'src/**/*.shader.ts'];
  const outDir = config.outDir || 'dist';

  // Find all shader files
  const files: string[] = [];
  for (const entry of entries) {
    files.push(...findFiles(entry));
  }

  if (files.length === 0) {
    console.log('No shader files found');
    return;
  }

  console.log(`Found ${files.length} shader file(s)`);

  // Compile each file
  fs.mkdirSync(outDir, { recursive: true });
  let successCount = 0;

  for (const file of files) {
    try {
      const outputFile = path.join(
        outDir,
        path.relative('src', file).replace(/\.(ts|shader3d)$/, '.wgsl')
      );
      await compileCommand(file, {
        ...options,
        output: outputFile,
        minify: config.minify ?? options.minify,
        sourceMaps: config.sourceMaps ?? options.sourceMaps,
      });
      successCount++;
    } catch (e) {
      console.error(`Failed to compile ${file}:`, (e as Error).message);
    }
  }

  console.log(`\n✨ Bundle complete! (${successCount}/${files.length} succeeded)`);
}

async function upgradeCommand(_options: CommandOptions) {
  console.log('\n⬆️  Checking for updates...\n');

  // This would typically use npm to check for updates
  console.log('Current version:', VERSION);
  console.log('To upgrade, run:');
  console.log(
    '  npm update @shader3d/core @shader3d/runtime @shader3d/vite-plugin @shader3d/ladder'
  );
}

interface CompileResult {
  code: string;
  metadata: {
    entryPoints: Array<{ name: string; stage: string }>;
    bindings: Array<{ name: string; type: string; group: number; binding: number }>;
    structs: Array<{ name: string; fields: Array<{ name: string; type: string }> }>;
  };
  diagnostics: Array<{ severity: string; message: string; code?: string }>;
}

function compileShader(
  source: string,
  options: { minify?: boolean; sourceMaps?: boolean }
): CompileResult {
  // Simplified inline compiler
  // In production, this would import from @shader3d/core

  let code = source;
  const diagnostics: Array<{ severity: string; message: string; code?: string }> = [];

  // Basic transformations
  code = code
    .replace(/function\s+(\w+)/g, 'fn $1')
    .replace(/const\s+(\w+)/g, 'let $1')
    .replace(/Math\.sin/g, 'sin')
    .replace(/Math\.cos/g, 'cos')
    .replace(/Math\.PI/g, '3.141592653589793');

  // Extract metadata
  const entryPoints: Array<{ name: string; stage: string }> = [];

  if (/@vertex/.test(source)) {
    const match = source.match(/@vertex\s*\n\s*fn\s+(\w+)/);
    entryPoints.push({ name: match?.[1] || 'vertex_main', stage: 'vertex' });
  }
  if (/@fragment/.test(source)) {
    const match = source.match(/@fragment\s*\n\s*fn\s+(\w+)/);
    entryPoints.push({ name: match?.[1] || 'fragment_main', stage: 'fragment' });
  }
  if (/@compute/.test(source)) {
    const match = source.match(/@compute\s*\n\s*fn\s+(\w+)/);
    entryPoints.push({ name: match?.[1] || 'compute_main', stage: 'compute' });
  }

  if (options.minify) {
    code = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    code,
    metadata: {
      entryPoints,
      bindings: [],
      structs: [],
    },
    diagnostics,
  };
}

function findFiles(pattern: string): string[] {
  // Simple glob implementation
  const files: string[] = [];

  if (pattern.includes('*')) {
    // Handle glob patterns
    const baseDir = pattern.split('*')[0] || '.';
    const ext = pattern.split('.').pop() || 'ts';

    function walkDir(dir: string) {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith(`.${ext}`)) {
          files.push(fullPath);
        }
      }
    }

    walkDir(baseDir);
  } else {
    // Single file
    if (fs.existsSync(pattern)) {
      files.push(pattern);
    }
  }

  return files;
}

// Run CLI
main().catch(console.error);
