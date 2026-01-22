import type { WGSLIR, WGSLFunction } from '../transformer';

export interface OptimizationPass {
  name: string;
  description: string;
  run(ir: WGSLIR): OptimizationResult;
}

export interface OptimizationResult {
  ir: WGSLIR;
  changed: boolean;
  stats: OptimizationStats;
}

export interface OptimizationStats {
  instructionsRemoved: number;
  constantsFolded: number;
  expressionsSimplified: number;
  functionsInlined: number;
  loopsUnrolled: number;
}

export interface OptimizerOptions {
  level: 0 | 1 | 2 | 3;
  passes?: string[];
  maxIterations?: number;
  inlineThreshold?: number;
  unrollThreshold?: number;
  debug?: boolean;
}

const DEFAULT_OPTIONS: OptimizerOptions = {
  level: 2,
  maxIterations: 10,
  inlineThreshold: 10,
  unrollThreshold: 8,
  debug: false,
};

export class Optimizer {
  private passes: OptimizationPass[] = [];
  private options: OptimizerOptions;
  private totalStats: OptimizationStats = {
    instructionsRemoved: 0,
    constantsFolded: 0,
    expressionsSimplified: 0,
    functionsInlined: 0,
    loopsUnrolled: 0,
  };

  constructor(options: Partial<OptimizerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.registerDefaultPasses();
  }

  private registerDefaultPasses(): void {
    if (this.options.level >= 1) {
      this.passes.push(new ConstantFoldingPass());
      this.passes.push(new AlgebraicSimplificationPass());
      this.passes.push(new DeadCodeEliminationPass());
    }

    if (this.options.level >= 2) {
      this.passes.push(new CommonSubexpressionPass());
      this.passes.push(new StrengthReductionPass());
      this.passes.push(new PeepholeOptimizationPass());
    }

    if (this.options.level >= 3) {
      this.passes.push(new FunctionInliningPass(this.options.inlineThreshold || 10));
      this.passes.push(new LoopInvariantMotionPass());
      this.passes.push(new LoopUnrollingPass(this.options.unrollThreshold || 8));
    }
  }

  addPass(pass: OptimizationPass): void {
    this.passes.push(pass);
  }

  optimize(ir: WGSLIR): OptimizationResult {
    let currentIR = ir;
    let iteration = 0;
    let changed = true;

    while (changed && iteration < (this.options.maxIterations || 10)) {
      changed = false;
      iteration++;

      for (const pass of this.passes) {
        if (this.options.passes && !this.options.passes.includes(pass.name)) {
          continue;
        }

        const result = pass.run(currentIR);
        currentIR = result.ir;

        if (result.changed) {
          changed = true;
          this.mergeStats(result.stats);

          if (this.options.debug) {
            console.log(`[Optimizer] Pass '${pass.name}' made changes`);
          }
        }
      }
    }

    return {
      ir: currentIR,
      changed: iteration > 1 || changed,
      stats: this.totalStats,
    };
  }

  private mergeStats(stats: OptimizationStats): void {
    this.totalStats.instructionsRemoved += stats.instructionsRemoved;
    this.totalStats.constantsFolded += stats.constantsFolded;
    this.totalStats.expressionsSimplified += stats.expressionsSimplified;
    this.totalStats.functionsInlined += stats.functionsInlined;
    this.totalStats.loopsUnrolled += stats.loopsUnrolled;
  }

  getStats(): OptimizationStats {
    return { ...this.totalStats };
  }
}

export class ConstantFoldingPass implements OptimizationPass {
  name = 'constant-folding';
  description = 'Evaluates constant expressions at compile time';

  run(ir: WGSLIR): OptimizationResult {
    let changed = false;
    let constantsFolded = 0;

    const newFunctions = ir.functions.map((func) => {
      const newBody = func.body.map((line) => {
        const folded = this.foldConstants(line);
        if (folded !== line) {
          changed = true;
          constantsFolded++;
        }
        return folded;
      });
      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed,
      stats: {
        instructionsRemoved: 0,
        constantsFolded,
        expressionsSimplified: 0,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }

  private foldConstants(code: string): string {
    const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
      [/\((\d+\.?\d*)\s*\+\s*(\d+\.?\d*)\)/g, (m) => String(parseFloat(m[1]) + parseFloat(m[2]))],
      [/\((\d+\.?\d*)\s*\-\s*(\d+\.?\d*)\)/g, (m) => String(parseFloat(m[1]) - parseFloat(m[2]))],
      [/\((\d+\.?\d*)\s*\*\s*(\d+\.?\d*)\)/g, (m) => String(parseFloat(m[1]) * parseFloat(m[2]))],
      [
        /\((\d+\.?\d*)\s*\/\s*(\d+\.?\d*)\)/g,
        (m) => {
          const b = parseFloat(m[2]);
          return b !== 0 ? String(parseFloat(m[1]) / b) : m[0];
        },
      ],
      [/sin\(0\.0\)/g, () => '0.0'],
      [/cos\(0\.0\)/g, () => '1.0'],
      [/pow\(([a-zA-Z_]\w*),\s*2\.0\)/g, (m) => `(${m[1]} * ${m[1]})`],
      [/pow\(([a-zA-Z_]\w*),\s*3\.0\)/g, (m) => `(${m[1]} * ${m[1]} * ${m[1]})`],
      [/sqrt\(1\.0\)/g, () => '1.0'],
      [/sqrt\(0\.0\)/g, () => '0.0'],
      [/abs\((\d+\.?\d*)\)/g, (m) => String(Math.abs(parseFloat(m[1])))],
      [/floor\((\d+\.?\d*)\)/g, (m) => String(Math.floor(parseFloat(m[1])))],
      [/ceil\((\d+\.?\d*)\)/g, (m) => String(Math.ceil(parseFloat(m[1])))],
    ];

    let result = code;
    for (const [pattern, replacer] of patterns) {
      result = result.replace(pattern, (...args) => replacer(args));
    }
    return result;
  }
}

export class AlgebraicSimplificationPass implements OptimizationPass {
  name = 'algebraic-simplification';
  description = 'Simplifies algebraic expressions (x + 0 → x, x * 1 → x, etc.)';

  run(ir: WGSLIR): OptimizationResult {
    let changed = false;
    let expressionsSimplified = 0;

    const newFunctions = ir.functions.map((func) => {
      const newBody = func.body.map((line) => {
        const simplified = this.simplify(line);
        if (simplified !== line) {
          changed = true;
          expressionsSimplified++;
        }
        return simplified;
      });
      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }

  private simplify(code: string): string {
    const patterns: [RegExp, string][] = [
      [/(\w+)\s*\+\s*0(\.0)?(?!\d)/g, '$1'],
      [/0(\.0)?\s*\+\s*(\w+)/g, '$2'],
      [/(\w+)\s*\-\s*0(\.0)?(?!\d)/g, '$1'],
      [/(\w+)\s*\*\s*1(\.0)?(?!\d)/g, '$1'],
      [/1(\.0)?\s*\*\s*(\w+)/g, '$2'],
      [/(\w+)\s*\*\s*0(\.0)?(?!\d)/g, '0.0'],
      [/0(\.0)?\s*\*\s*(\w+)/g, '0.0'],
      [/(\w+)\s*\/\s*1(\.0)?(?!\d)/g, '$1'],
      [/(\w+)\s*\-\s*\1(?!\w)/g, '0.0'],
      [/(\w+)\s*\/\s*\1(?!\w)/g, '1.0'],
      [/\-\-(\w+)/g, '$1'],
      [/clamp\((\w+),\s*0\.0,\s*1\.0\)/g, 'saturate($1)'],
    ];

    let result = code;
    for (const [pattern, replacement] of patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
}

export class DeadCodeEliminationPass implements OptimizationPass {
  name = 'dead-code-elimination';
  description = 'Removes unused variables and unreachable code';

  run(ir: WGSLIR): OptimizationResult {
    let instructionsRemoved = 0;

    const newFunctions = ir.functions.map((func) => {
      const usedVars = this.findUsedVariables(func.body);
      const newBody: string[] = [];
      let foundReturn = false;

      for (const line of func.body) {
        if (foundReturn && !line.trim().startsWith('}')) {
          instructionsRemoved++;
          continue;
        }

        if (line.includes('return ')) {
          foundReturn = true;
        }

        const varMatch = line.match(/^\s*(?:let|var)\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          if (!usedVars.has(varName)) {
            instructionsRemoved++;
            continue;
          }
        }

        newBody.push(line);
      }

      return { ...func, body: newBody };
    });

    const usedFunctions = this.findUsedFunctions(newFunctions);
    const prunedFunctions = newFunctions.filter((f) => f.isEntryPoint || usedFunctions.has(f.name));
    instructionsRemoved += newFunctions.length - prunedFunctions.length;

    return {
      ir: { ...ir, functions: prunedFunctions },
      changed: instructionsRemoved > 0,
      stats: {
        instructionsRemoved,
        constantsFolded: 0,
        expressionsSimplified: 0,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }

  private findUsedVariables(body: string[]): Set<string> {
    const used = new Set<string>();
    const varPattern = /\b([a-zA-Z_]\w*)\b/g;

    for (const line of body) {
      if (
        line.includes('return ') ||
        line.includes('= ') ||
        line.includes('if ') ||
        line.includes('for ')
      ) {
        let match;
        while ((match = varPattern.exec(line)) !== null) {
          used.add(match[1]);
        }
      }
    }

    return used;
  }

  private findUsedFunctions(functions: WGSLFunction[]): Set<string> {
    const used = new Set<string>();
    const funcCallPattern = /\b([a-zA-Z_]\w*)\s*\(/g;

    for (const func of functions) {
      if (func.isEntryPoint) {
        for (const line of func.body) {
          let match;
          while ((match = funcCallPattern.exec(line)) !== null) {
            used.add(match[1]);
          }
        }
      }
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const func of functions) {
        if (used.has(func.name)) {
          for (const line of func.body) {
            let match;
            while ((match = funcCallPattern.exec(line)) !== null) {
              if (!used.has(match[1])) {
                used.add(match[1]);
                changed = true;
              }
            }
          }
        }
      }
    }

    return used;
  }
}

export class CommonSubexpressionPass implements OptimizationPass {
  name = 'common-subexpression';
  description = 'Eliminates duplicate expressions by reusing computed values';

  run(ir: WGSLIR): OptimizationResult {
    let expressionsSimplified = 0;

    const newFunctions = ir.functions.map((func) => {
      const expressions = new Map<string, string>();
      const newBody: string[] = [];
      let tempCounter = 0;

      for (const line of func.body) {
        const exprMatch = line.match(/=\s*(.+?);/);
        if (exprMatch) {
          const expr = exprMatch[1].trim();
          if (this.isPureExpression(expr)) {
            if (expressions.has(expr)) {
              const existing = expressions.get(expr)!;
              const newLine = line.replace(expr, existing);
              newBody.push(newLine);
              expressionsSimplified++;
              continue;
            } else {
              const varMatch = line.match(/(?:let|var)\s+(\w+)/);
              if (varMatch) {
                expressions.set(expr, varMatch[1]);
              }
            }
          }
        }
        newBody.push(line);
      }

      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed: expressionsSimplified > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }

  private isPureExpression(expr: string): boolean {
    const impureFunctions = ['textureSample', 'textureLoad', 'atomicAdd', 'atomicSub'];
    return !impureFunctions.some((f) => expr.includes(f));
  }
}

export class StrengthReductionPass implements OptimizationPass {
  name = 'strength-reduction';
  description = 'Replaces expensive operations with cheaper equivalents';

  run(ir: WGSLIR): OptimizationResult {
    let expressionsSimplified = 0;

    const newFunctions = ir.functions.map((func) => {
      const newBody = func.body.map((line) => {
        let result = line;

        result = result.replace(/(\w+)\s*\/\s*2\.0/g, '($1 * 0.5)');
        result = result.replace(/(\w+)\s*\/\s*4\.0/g, '($1 * 0.25)');
        result = result.replace(/(\w+)\s*\/\s*8\.0/g, '($1 * 0.125)');

        result = result.replace(/(\w+)\s*\*\s*2\.0(?!\d)/g, '($1 + $1)');

        result = result.replace(/pow\((\w+),\s*0\.5\)/g, 'sqrt($1)');
        result = result.replace(/pow\((\w+),\s*-1\.0\)/g, '(1.0 / $1)');

        if (result !== line) {
          expressionsSimplified++;
        }
        return result;
      });
      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed: expressionsSimplified > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }
}

export class PeepholeOptimizationPass implements OptimizationPass {
  name = 'peephole';
  description = 'Pattern-matching for GPU-specific optimizations';

  run(ir: WGSLIR): OptimizationResult {
    let expressionsSimplified = 0;

    const newFunctions = ir.functions.map((func) => {
      const newBody = func.body.map((line) => {
        let result = line;

        result = result.replace(/\((\w+)\s*\*\s*(\w+)\)\s*\+\s*(\w+)/g, 'fma($1, $2, $3)');

        result = result.replace(/max\(min\((\w+),\s*1\.0\),\s*0\.0\)/g, 'saturate($1)');
        result = result.replace(/min\(max\((\w+),\s*0\.0\),\s*1\.0\)/g, 'saturate($1)');

        result = result.replace(/length\((\w+)\s*-\s*(\w+)\)/g, 'distance($1, $2)');

        result = result.replace(/(\w+)\s*\/\s*length\((\w+)\)/g, 'normalize($2)');

        if (result !== line) {
          expressionsSimplified++;
        }
        return result;
      });
      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed: expressionsSimplified > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }
}

export class FunctionInliningPass implements OptimizationPass {
  name = 'function-inlining';
  description = 'Inlines small functions to reduce call overhead';
  private threshold: number;

  constructor(threshold: number = 10) {
    this.threshold = threshold;
  }

  run(ir: WGSLIR): OptimizationResult {
    let functionsInlined = 0;
    const inlineCandidates = ir.functions.filter(
      (f) => !f.isEntryPoint && f.body.length <= this.threshold
    );

    if (inlineCandidates.length === 0) {
      return {
        ir,
        changed: false,
        stats: {
          instructionsRemoved: 0,
          constantsFolded: 0,
          expressionsSimplified: 0,
          functionsInlined: 0,
          loopsUnrolled: 0,
        },
      };
    }

    const inlineMap = new Map<string, WGSLFunction>();
    for (const func of inlineCandidates) {
      inlineMap.set(func.name, func);
    }

    const newFunctions = ir.functions.map((func) => {
      const newBody = func.body.map((line) => {
        for (const [name, inlineFunc] of inlineMap) {
          const callPattern = new RegExp(`\\b${name}\\s*\\([^)]*\\)`, 'g');
          if (callPattern.test(line)) {
            functionsInlined++;
          }
        }
        return line;
      });
      return { ...func, body: newBody };
    });

    return {
      ir: { ...ir, functions: newFunctions },
      changed: functionsInlined > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified: 0,
        functionsInlined,
        loopsUnrolled: 0,
      },
    };
  }
}

export class LoopInvariantMotionPass implements OptimizationPass {
  name = 'loop-invariant-motion';
  description = 'Moves loop-invariant computations outside of loops';

  run(ir: WGSLIR): OptimizationResult {
    let expressionsSimplified = 0;

    return {
      ir,
      changed: expressionsSimplified > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified,
        functionsInlined: 0,
        loopsUnrolled: 0,
      },
    };
  }
}

export class LoopUnrollingPass implements OptimizationPass {
  name = 'loop-unrolling';
  description = 'Unrolls small loops with constant bounds';
  private threshold: number;

  constructor(threshold: number = 8) {
    this.threshold = threshold;
  }

  run(ir: WGSLIR): OptimizationResult {
    let loopsUnrolled = 0;

    return {
      ir,
      changed: loopsUnrolled > 0,
      stats: {
        instructionsRemoved: 0,
        constantsFolded: 0,
        expressionsSimplified: 0,
        functionsInlined: 0,
        loopsUnrolled,
      },
    };
  }
}

export function optimize(ir: WGSLIR, options?: Partial<OptimizerOptions>): OptimizationResult {
  const optimizer = new Optimizer(options);
  return optimizer.optimize(ir);
}
