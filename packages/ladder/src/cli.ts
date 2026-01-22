#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { ProjectScaffolder } from './scaffolder'
import type { ScaffoldOptions, ProjectTemplate } from './scaffolder'
import { SkillLevelDetector, SKILL_LEVELS } from './detector'
import type { SkillLevel } from './detector'

/**
 * CLI Colors
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

/**
 * Print styled text
 */
function print(text: string, color?: keyof typeof colors): void {
  if (color) {
    console.log(`${colors[color]}${text}${colors.reset}`)
  } else {
    console.log(text)
  }
}

/**
 * Print banner
 */
function printBanner(): void {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════════╗
║                                                               ║
║   ${colors.bright}Shader3D${colors.reset}${colors.cyan}                                               ║
║   ${colors.dim}Progressive Graphics Programming${colors.reset}${colors.cyan}                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

/**
 * Ask a question
 */
async function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${colors.green}?${colors.reset} ${question}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for selection from list
 */
async function select<T extends string>(
  rl: readline.Interface,
  question: string,
  options: Array<{ value: T; label: string }>
): Promise<T> {
  console.log(`\n${colors.green}?${colors.reset} ${question}`);

  options.forEach((opt, i) => {
    console.log(`  ${colors.cyan}${i + 1})${colors.reset} ${opt.label}`);
  });

  while (true) {
    const answer = await ask(rl, `Enter number (1-${options.length}): `);
    const index = parseInt(answer) - 1;

    if (index >= 0 && index < options.length) {
      return options[index].value;
    }

    print(`Please enter a number between 1 and ${options.length}`, 'yellow');
  }
}

/**
 * Ask yes/no question
 */
async function confirm(
  rl: readline.Interface,
  question: string,
  defaultYes = true
): Promise<boolean> {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  const answer = await ask(rl, `${question} ${hint}: `);

  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Init command - create new project
 */
async function initCommand(args: string[]): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    printBanner();
    print("Let's create a new Shader3D project!\n", 'bright');

    // Project name
    const name = args[0] || (await ask(rl, 'Project name: '));
    if (!name) {
      print('Project name is required', 'red');
      process.exit(1);
    }

    // Skill level
    const level = await select<string>(rl, "What's your shader experience level?", [
      { value: '0', label: `${SKILL_LEVELS[0].name} - ${SKILL_LEVELS[0].description}` },
      { value: '1', label: `${SKILL_LEVELS[1].name} - ${SKILL_LEVELS[1].description}` },
      { value: '2', label: `${SKILL_LEVELS[2].name} - ${SKILL_LEVELS[2].description}` },
      { value: '3', label: `${SKILL_LEVELS[3].name} - ${SKILL_LEVELS[3].description}` },
    ]);

    // Template
    const template = await select<ProjectTemplate>(rl, 'Choose a template:', [
      { value: 'vite-vanilla', label: 'Vite + Vanilla JS/TS' },
      { value: 'vite-react', label: 'Vite + React' },
      { value: 'particles', label: 'Particle System Demo' },
      { value: 'raymarching', label: 'Raymarching/SDF Demo' },
      { value: 'minimal', label: 'Minimal (just shader + HTML)' },
    ]);

    // TypeScript
    const typescript = await confirm(rl, 'Use TypeScript?', true);

    // Git
    const git = await confirm(rl, 'Initialize git repository?', true);

    // Install deps
    const installDeps = await confirm(rl, 'Install dependencies?', true);

    const options: ScaffoldOptions = {
      name,
      template,
      level: parseInt(level) as SkillLevel,
      typescript,
      git,
      installDeps,
    };

    console.log();
    print('Creating project...', 'cyan');

    // Generate files
    const scaffolder = new ProjectScaffolder();
    const files = scaffolder.scaffold(options);

    const targetDir = path.join(process.cwd(), name);

    // Check if directory exists
    if (fs.existsSync(targetDir)) {
      const overwrite = await confirm(rl, `Directory "${name}" already exists. Overwrite?`, false);
      if (!overwrite) {
        print('Aborted', 'yellow');
        process.exit(0);
      }
    }

    // Write files
    await scaffolder.write(targetDir, files);

    // Init git
    if (git) {
      const { execSync } = await import('child_process');
      try {
        execSync('git init', { cwd: targetDir, stdio: 'ignore' });
        print('✓ Initialized git repository', 'green');
      } catch {
        print('⚠ Failed to initialize git', 'yellow');
      }
    }

    // Install dependencies
    if (installDeps) {
      print('\nInstalling dependencies...', 'cyan');
      const { execSync } = await import('child_process');
      try {
        execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
        print('✓ Dependencies installed', 'green');
      } catch {
        print('⚠ Failed to install dependencies', 'yellow');
      }
    }

    // Success message
    console.log();
    print('Project created successfully!', 'green');
    console.log();
    print('Next steps:', 'bright');
    console.log(`  cd ${name}`);
    if (!installDeps) console.log('  npm install');
    console.log('  npm run dev');
    console.log();
    print(
      `You're starting at Level ${level}: ${SKILL_LEVELS[parseInt(level) as SkillLevel].name}`,
      'cyan'
    );
    print("Run `shader3d upgrade` when you're ready to level up!", 'dim');
  } finally {
    rl.close();
  }
}

/**
 * Upgrade command - suggest next level
 */
async function upgradeCommand(): Promise<void> {
  const cwd = process.cwd();

  print('Analyzing your code...', 'cyan');

  // Find shader files
  const files = await findShaderFiles(cwd);
  if (files.length === 0) {
    print('No shader files found in current directory', 'yellow');
    return;
  }

  // Detect current level
  const detector = new SkillLevelDetector();
  let totalLevel = 0;
  let fileCount = 0;

  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const result = detector.detect(content, file);
    totalLevel += result.level;
    fileCount++;

    print(`\n${path.relative(cwd, file)}`, 'bright');
    print(`   Level: ${result.level} (${SKILL_LEVELS[result.level].name})`, 'cyan');
    print(`   Confidence: ${Math.round(result.confidence * 100)}%`, 'dim');

    if (result.suggestions.length > 0) {
      print('   Suggestions:', 'yellow');
      result.suggestions.slice(0, 3).forEach((s) => {
        print(`     - ${s}`, 'dim');
      });
    }
  }

  const avgLevel = Math.round(totalLevel / fileCount) as SkillLevel;
  const nextLevel = detector.getNextLevel(avgLevel);

  console.log();
  print(`═══════════════════════════════════════`, 'cyan');
  print(`Your current level: ${avgLevel} (${SKILL_LEVELS[avgLevel].name})`, 'bright');

  if (nextLevel) {
    print(`Next level: ${nextLevel} (${SKILL_LEVELS[nextLevel].name})`, 'green');
    console.log();
    print('To reach the next level, try:', 'bright');

    const learningPath = detector.getLearningPath(avgLevel, nextLevel);
    learningPath.forEach((item, i) => {
      print(`  ${i + 1}. ${item.description}`, 'dim');
    });
  } else {
    print("🏆 You've reached the highest level! You're a shader expert!", 'magenta');
  }
}

/**
 * Build command - compile shaders
 */
async function buildCommand(): Promise<void> {
  print('Building shaders...', 'cyan')

  const cwd = process.cwd()
  const files = await findShaderFiles(cwd)
  
  if (files.length === 0) {
    print('No shader files found', 'yellow')
    return
  }

  // Dynamically import the transpiler
  let Shader3DTranspiler: any
  try {
    const core = await import('@shader3d/core')
    Shader3DTranspiler = core.Shader3DTranspiler
  } catch {
    print('Could not load @shader3d/core. Make sure it\'s installed.', 'red')
    process.exit(1)
  }

  const transpiler = new Shader3DTranspiler()
  let success = 0
  let failed = 0

  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8')
    const relative = path.relative(cwd, file)
    
    try {
      const result = transpiler.transpile(content, relative)
      
      if (result.errors.length > 0) {
        print(`✗ ${relative}`, 'red')
        result.errors.forEach((e: any) => {
          print(`  ${e.message}`, 'dim')
        })
        failed++
      } else {
        // Write output
        const outPath = file.replace(/\.shader3d\.ts$/, '.wgsl')
        await fs.promises.writeFile(outPath, result.wgsl)
        
        print(`✓ ${relative} → ${path.relative(cwd, outPath)}`, 'green')
        success++
      }
    } catch (e: any) {
      print(`✗ ${relative}: ${e.message}`, 'red')
      failed++
    }
  }

  console.log()
  print(`Build complete: ${success} succeeded, ${failed} failed`, success > 0 ? 'green' : 'red')
}

/**
 * Watch command - watch and rebuild
 */
async function watchCommand(): Promise<void> {
  print('Watching for changes... (Ctrl+C to stop)', 'cyan')
  
  const cwd = process.cwd()
  const chokidar = await import('chokidar').catch(() => null)
  
  if (!chokidar) {
    print('Please install chokidar: npm install -D chokidar', 'yellow')
    return
  }

  const watcher = chokidar.watch(['**/*.shader3d.ts', '**/*.s3d'], {
    cwd,
    ignored: /node_modules/,
    persistent: true
  })

  watcher.on('change', async (filePath: string) => {
    print(`\n📝 Changed: ${filePath}`, 'yellow')
    await buildCommand()
  })

  watcher.on('add', async (filePath: string) => {
    print(`\n➕ Added: ${filePath}`, 'green')
    await buildCommand()
  })
}

/**
 * Info command - show system info
 */
function infoCommand(): void {
  printBanner()
  
  print('System Information:', 'bright')
  console.log(`  Node.js: ${process.version}`)
  console.log(`  Platform: ${process.platform}`)
  console.log(`  Architecture: ${process.arch}`)
  
  console.log()
  print('Shader3D Version:', 'bright')
  console.log('  @shader3d/core: 0.1.0')
  console.log('  @shader3d/runtime: 0.1.0')
  console.log('  @shader3d/vite-plugin: 0.1.0')
  console.log('  @shader3d/ladder: 0.1.0')
  
  console.log()
  print('Skill Levels:', 'bright')
  Object.entries(SKILL_LEVELS).forEach(([level, info]) => {
    console.log(`  ${level}: ${info.name} - ${info.description}`)
  })
}

/**
 * Help command
 */
function helpCommand(): void {
  printBanner()
  
  console.log('Usage: shader3d <command> [options]')
  console.log()
  print('Commands:', 'bright')
  console.log('  init [name]    Create a new Shader3D project')
  console.log('  upgrade        Analyze code and suggest next skill level')
  console.log('  build          Compile shader files')
  console.log('  watch          Watch and rebuild on changes')
  console.log('  info           Show system information')
  console.log('  help           Show this help message')
  console.log()
  print('Examples:', 'bright')
  console.log('  shader3d init my-shader-project')
  console.log('  shader3d upgrade')
  console.log('  shader3d build')
}

/**
 * Find shader files in directory
 */
async function findShaderFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  
  async function walk(current: string): Promise<void> {
    const entries = await fs.promises.readdir(current, { withFileTypes: true })
    
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        await walk(full)
      } else if (entry.isFile() && (
        entry.name.endsWith('.shader3d.ts') ||
        entry.name.endsWith('.s3d')
      )) {
        files.push(full)
      }
    }
  }
  
  await walk(dir)
  return files
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  try {
    switch (command) {
      case 'init':
      case 'new':
      case 'create':
        await initCommand(args.slice(1))
        break
      case 'upgrade':
      case 'level':
        await upgradeCommand()
        break
      case 'build':
      case 'compile':
        await buildCommand()
        break
      case 'watch':
        await watchCommand()
        break
      case 'info':
      case 'version':
        infoCommand()
        break
      case 'help':
      case '--help':
      case '-h':
        helpCommand()
        break
      default:
        print(`Unknown command: ${command}`, 'red')
        helpCommand()
        process.exit(1)
    }
  } catch (e: any) {
    print(`Error: ${e.message}`, 'red')
    process.exit(1)
  }
}

// Run CLI
main()

export { main, initCommand, upgradeCommand, buildCommand, watchCommand }
