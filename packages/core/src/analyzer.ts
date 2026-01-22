// Analyzer - Type checking, validation, and optimization

import type { Diagnostic, DiagnosticSeverity } from './types';
import type { WGSLIR, WGSLFunction, WGSLStruct, WGSLUniform } from './transformer';

export interface AnalysisResult {
  ir: WGSLIR;
  diagnostics: Diagnostic[];
  hints: PerformanceHint[];
  metadata: AnalysisMetadata;
}

export interface PerformanceHint {
  type: 'warning' | 'suggestion' | 'optimization';
  message: string;
  location?: { line: number; column: number };
  fix?: string;
}

export interface AnalysisMetadata {
  uniformCount: number;
  functionCount: number;
  entryPointCount: number;
  hasVertexShader: boolean;
  hasFragmentShader: boolean;
  hasComputeShader: boolean;
  estimatedRegisters: number;
  usedBuiltins: string[];
}

// WGSL built-in functions for validation
const WGSL_BUILTINS = new Set([
  // Math
  'abs',
  'acos',
  'asin',
  'atan',
  'atan2',
  'ceil',
  'clamp',
  'cos',
  'cosh',
  'cross',
  'degrees',
  'distance',
  'dot',
  'exp',
  'exp2',
  'floor',
  'fract',
  'fma',
  'inverseSqrt',
  'length',
  'log',
  'log2',
  'max',
  'min',
  'mix',
  'modf',
  'normalize',
  'pow',
  'radians',
  'reflect',
  'refract',
  'round',
  'sign',
  'sin',
  'sinh',
  'smoothstep',
  'sqrt',
  'step',
  'tan',
  'tanh',
  'trunc',
  // Vector
  'all',
  'any',
  'select',
  // Texture
  'textureSample',
  'textureSampleLevel',
  'textureSampleBias',
  'textureSampleGrad',
  'textureSampleCompare',
  'textureLoad',
  'textureStore',
  'textureDimensions',
  // Derivative
  'dpdx',
  'dpdy',
  'fwidth',
  'dpdxCoarse',
  'dpdyCoarse',
  'dpdxFine',
  'dpdyFine',
  // Atomic
  'atomicAdd',
  'atomicSub',
  'atomicMax',
  'atomicMin',
  'atomicAnd',
  'atomicOr',
  'atomicXor',
  'atomicLoad',
  'atomicStore',
  'atomicExchange',
  'atomicCompareExchangeWeak',
  // Pack/Unpack
  'pack4x8snorm',
  'pack4x8unorm',
  'pack2x16snorm',
  'pack2x16unorm',
  'pack2x16float',
  'unpack4x8snorm',
  'unpack4x8unorm',
  'unpack2x16snorm',
  'unpack2x16unorm',
  'unpack2x16float',
  // Synchronization
  'storageBarrier',
  'workgroupBarrier',
  'workgroupUniformLoad',
]);

// Types that can be used in WGSL
const WGSL_TYPES = new Set([
  'f32',
  'f16',
  'i32',
  'u32',
  'bool',
  'vec2',
  'vec3',
  'vec4',
  'mat2x2',
  'mat2x3',
  'mat2x4',
  'mat3x2',
  'mat3x3',
  'mat3x4',
  'mat4x2',
  'mat4x3',
  'mat4x4',
  'array',
  'struct',
  'sampler',
  'sampler_comparison',
  'texture_1d',
  'texture_2d',
  'texture_3d',
  'texture_cube',
  'texture_2d_array',
  'texture_cube_array',
  'texture_storage_1d',
  'texture_storage_2d',
  'texture_storage_3d',
  'texture_multisampled_2d',
  'texture_depth_2d',
  'texture_depth_cube',
]);

export class Analyzer {
  private diagnostics: Diagnostic[] = [];
  private hints: PerformanceHint[] = [];
  private usedBuiltins: Set<string> = new Set();
  private definedFunctions: Set<string> = new Set();
  private calledFunctions: Set<string> = new Set();

  analyze(ir: WGSLIR): AnalysisResult {
    this.diagnostics = [];
    this.hints = [];
    this.usedBuiltins = new Set();
    this.definedFunctions = new Set();
    this.calledFunctions = new Set();

    // Collect defined functions
    for (const fn of ir.functions) {
      this.definedFunctions.add(fn.name);
    }

    // Validate structs
    for (const struct of ir.structs) {
      this.validateStruct(struct);
    }

    // Validate uniforms
    this.validateUniforms(ir.uniforms);

    // Validate functions
    for (const fn of ir.functions) {
      this.validateFunction(fn);
    }

    // Check for entry points
    this.validateEntryPoints(ir);

    // Dead code elimination hints
    this.checkDeadCode(ir);

    // Performance analysis
    this.analyzePerformance(ir);

    // Build metadata
    const metadata = this.buildMetadata(ir);

    return {
      ir,
      diagnostics: this.diagnostics,
      hints: this.hints,
      metadata,
    };
  }

  private validateStruct(struct: WGSLStruct) {
    if (struct.fields.length === 0) {
      this.addDiagnostic('warning', `Struct '${struct.name}' has no fields`, 'W001');
    }

    const fieldNames = new Set<string>();
    for (const field of struct.fields) {
      if (fieldNames.has(field.name)) {
        this.addDiagnostic(
          'error',
          `Duplicate field '${field.name}' in struct '${struct.name}'`,
          'E001'
        );
      }
      fieldNames.add(field.name);

      // Validate type
      this.validateType(field.type);
    }
  }

  private validateUniforms(uniforms: WGSLUniform[]) {
    const bindingMap = new Map<string, WGSLUniform>();

    for (const uniform of uniforms) {
      const key = `${uniform.group}:${uniform.binding}`;
      const existing = bindingMap.get(key);
      if (existing) {
        this.addDiagnostic(
          'error',
          `Binding conflict: '${uniform.name}' and '${existing.name}' both use @group(${uniform.group}) @binding(${uniform.binding})`,
          'E002'
        );
      }
      bindingMap.set(key, uniform);
    }
  }

  private validateFunction(fn: WGSLFunction) {
    // Validate return type
    if (fn.returnType && fn.returnType !== 'void') {
      this.validateType(fn.returnType);
    }

    // Validate parameters
    for (const param of fn.params) {
      this.validateType(param.type);
    }

    // Analyze function body for builtins and calls
    for (const line of fn.body) {
      this.analyzeLine(line);
    }

    // Check for missing return statement
    if (fn.returnType && fn.returnType !== 'void') {
      const hasReturn = fn.body.some((line) => line.trim().startsWith('return'));
      if (!hasReturn) {
        this.addDiagnostic(
          'warning',
          `Function '${fn.name}' may not return a value on all paths`,
          'W002'
        );
      }
    }

    // Entry point specific validation
    if (fn.isEntryPoint) {
      this.validateEntryPoint(fn);
    }
  }

  private validateEntryPoint(fn: WGSLFunction) {
    if (fn.stage === 'vertex') {
      // Vertex shader should have position output
      const hasPositionOutput = fn.decorators.some((d) => d.includes('position'));
      // This is just a hint, not an error
      if (!hasPositionOutput && fn.returnType !== 'void') {
        this.hints.push({
          type: 'suggestion',
          message: `Vertex function '${fn.name}' should output position with @builtin(position)`,
        });
      }
    }

    if (fn.stage === 'fragment') {
      // Fragment shader typically returns color
      if (fn.returnType === 'void') {
        this.addDiagnostic(
          'warning',
          `Fragment function '${fn.name}' has no return value - did you forget to return color?`,
          'W003'
        );
      }
    }
  }

  private validateType(typeStr: string) {
    // Extract base type from complex types like vec4<f32>
    const baseType = typeStr.replace(/<.*>/, '').replace(/\d+x\d+/, '');

    // Check if it's a known type
    const knownTypes = [
      'f32',
      'f16',
      'i32',
      'u32',
      'bool',
      'vec',
      'mat',
      'array',
      'sampler',
      'texture',
      'void',
    ];
    const isKnown = knownTypes.some((t) => baseType.startsWith(t));

    if (!isKnown && !typeStr.match(/^[A-Z]/)) {
      // Not a primitive and doesn't look like a struct name (capital letter)
      this.addDiagnostic(
        'warning',
        `Unknown type '${typeStr}' - make sure it's a valid WGSL type or defined struct`,
        'W004'
      );
    }
  }

  private analyzeLine(line: string) {
    // Find function calls
    const callMatch = line.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
    if (callMatch) {
      for (const match of callMatch) {
        const fnName = match.replace(/\s*\($/, '');
        this.calledFunctions.add(fnName);
        if (WGSL_BUILTINS.has(fnName)) {
          this.usedBuiltins.add(fnName);
        }
      }
    }
  }

  private validateEntryPoints(ir: WGSLIR) {
    if (ir.entryPoints.length === 0) {
      this.addDiagnostic(
        'error',
        'No entry points found. Add @vertex, @fragment, or @compute decorator to a function.',
        'E003'
      );
    }

    const hasVertex = ir.entryPoints.some((e) => e.stage === 'vertex');
    const hasFragment = ir.entryPoints.some((e) => e.stage === 'fragment');

    // For graphics shaders, typically need both vertex and fragment
    if (hasVertex && !hasFragment) {
      this.hints.push({
        type: 'suggestion',
        message: 'Vertex shader without fragment shader - add @fragment function for rendering',
      });
    }

    if (hasFragment && !hasVertex) {
      this.hints.push({
        type: 'suggestion',
        message:
          'Fragment shader without vertex shader - you may need a fullscreen triangle vertex shader',
      });
    }
  }

  private checkDeadCode(ir: WGSLIR) {
    // Find functions that are defined but never called (except entry points)
    for (const fn of ir.functions) {
      if (!fn.isEntryPoint && !this.calledFunctions.has(fn.name)) {
        this.hints.push({
          type: 'warning',
          message: `Function '${fn.name}' is defined but never called`,
        });
      }
    }
  }

  private analyzePerformance(ir: WGSLIR) {
    // Check for expensive operations
    for (const fn of ir.functions) {
      for (const line of fn.body) {
        // Check for division (expensive on some GPUs)
        if (line.includes(' / ') && !line.includes('// ')) {
          this.hints.push({
            type: 'optimization',
            message: 'Consider replacing division with multiplication by reciprocal when possible',
          });
          break;
        }

        // Check for pow with integer exponent
        if (line.match(/pow\([^,]+,\s*[234]\.0\s*\)/)) {
          this.hints.push({
            type: 'optimization',
            message: 'pow() with small integer exponent can be replaced with multiplication',
          });
        }
      }
    }

    // Check uniform count
    if (ir.uniforms.length > 16) {
      this.hints.push({
        type: 'warning',
        message: `High uniform count (${ir.uniforms.length}) - consider packing into structs`,
      });
    }
  }

  private buildMetadata(ir: WGSLIR): AnalysisMetadata {
    return {
      uniformCount: ir.uniforms.length,
      functionCount: ir.functions.length,
      entryPointCount: ir.entryPoints.length,
      hasVertexShader: ir.entryPoints.some((e) => e.stage === 'vertex'),
      hasFragmentShader: ir.entryPoints.some((e) => e.stage === 'fragment'),
      hasComputeShader: ir.entryPoints.some((e) => e.stage === 'compute'),
      estimatedRegisters: this.estimateRegisters(ir),
      usedBuiltins: Array.from(this.usedBuiltins),
    };
  }

  private estimateRegisters(ir: WGSLIR): number {
    // Rough estimate based on uniforms and function complexity
    let estimate = ir.uniforms.length * 4; // Each uniform takes ~4 registers

    for (const fn of ir.functions) {
      estimate += fn.params.length * 2;
      estimate += Math.ceil(fn.body.length / 4); // Rough estimate
    }

    return estimate;
  }

  private addDiagnostic(severity: DiagnosticSeverity, message: string, code: string) {
    this.diagnostics.push({
      severity,
      message,
      code,
    });
  }
}

// Optimization passes

export function constantFold(ir: WGSLIR): WGSLIR {
  // Simple constant folding for the IR
  const optimized = { ...ir };

  for (const fn of optimized.functions) {
    fn.body = fn.body.map((line) => {
      // Fold simple arithmetic with constants
      // Example: 2.0 * 3.0 -> 6.0
      return line
        .replace(/(\d+\.?\d*)\s*\*\s*(\d+\.?\d*)/g, (_, a, b) => {
          return String(parseFloat(a) * parseFloat(b));
        })
        .replace(/(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)/g, (_, a, b) => {
          return String(parseFloat(a) + parseFloat(b));
        })
        .replace(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/g, (_, a, b) => {
          return String(parseFloat(a) - parseFloat(b));
        });
    });
  }

  return optimized;
}

export function deadCodeElimination(ir: WGSLIR): WGSLIR {
  // Remove unreachable code after return statements
  const optimized = { ...ir };

  for (const fn of optimized.functions) {
    const newBody: string[] = [];
    let hitReturn = false;

    for (const line of fn.body) {
      if (hitReturn && !line.trim().startsWith('}')) {
        continue; // Skip unreachable code
      }
      if (line.trim().startsWith('return')) {
        hitReturn = true;
      }
      if (line.trim() === '}') {
        hitReturn = false; // Reset for next block
      }
      newBody.push(line);
    }

    fn.body = newBody;
  }

  return optimized;
}

export function analyze(ir: WGSLIR): AnalysisResult {
  const analyzer = new Analyzer();
  return analyzer.analyze(ir);
}
