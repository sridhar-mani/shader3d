import { describe, it, expect } from 'vitest'
import { analyze } from '../../packages/core/src/analyzer'
import { parse } from '../../packages/core/src/parser'
import * as fixtures from '../fixtures/shaders'

describe('Analyzer', () => {
  describe('analyze() function', () => {
    it('returns analysis result for valid shader', () => {
      const { ast } = parse(fixtures.basicFragment)
      const result = analyze(ast)
      
      expect(result).toBeDefined()
      expect(result.diagnostics).toBeDefined()
    })

    it('detects uniforms', () => {
      const { ast } = parse(fixtures.withUniforms)
      const result = analyze(ast)
      
      expect(result.uniforms).toBeDefined()
      expect(result.uniforms.length).toBeGreaterThan(0)
    })

    it('detects entry points', () => {
      const { ast } = parse(fixtures.basicFragment)
      const result = analyze(ast)
      
      expect(result.entryPoints).toBeDefined()
      expect(result.entryPoints.length).toBeGreaterThan(0)
    })
  })

  describe('type checking', () => {
    it('validates return type matches declaration', () => {
      const source = `
        @fragment
        function main(): vec4f {
          return vec4f(1.0, 0.0, 0.0, 1.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports return type mismatch', () => {
      const source = `
        @fragment
        function main(): vec4f {
          return 1.0;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    it('validates binary expression types', () => {
      const source = `
        function add(): f32 {
          return 1.0 + 2.0;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports type mismatch in binary expression', () => {
      const source = `
        function add(): f32 {
          return 1.0 + vec2f(1.0, 2.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    it('validates function call argument types', () => {
      const source = `
        function helper(x: f32): f32 {
          return x * 2.0;
        }
        
        function main(): f32 {
          return helper(1.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports argument type mismatch', () => {
      const source = `
        function helper(x: f32): f32 {
          return x * 2.0;
        }
        
        function main(): f32 {
          return helper(vec2f(1.0, 2.0));
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe('scope analysis', () => {
    it('detects undefined variables', () => {
      const { ast } = parse(fixtures.undefinedVariable)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
      expect(result.diagnostics[0].message).toMatch(/undefined|not defined|unknown/i)
    })

    it('detects undefined functions', () => {
      const source = `
        function main(): f32 {
          return unknownFunction();
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    it('allows shadowing in inner scope', () => {
      const source = `
        function main(): f32 {
          const x = 1.0;
          if (true) {
            const x = 2.0;
            return x;
          }
          return x;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('tracks variable declarations', () => {
      const source = `
        function main(): f32 {
          const x = 1.0;
          const y = x + 1.0;
          return y;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports duplicate declarations', () => {
      const source = `
        function main(): f32 {
          const x = 1.0;
          const x = 2.0;
          return x;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe('entry point validation', () => {
    it('validates fragment shader signature', () => {
      const { ast } = parse(fixtures.basicFragment)
      const result = analyze(ast)
      
      const fragmentEntry = result.entryPoints.find(e => e.stage === 'fragment')
      expect(fragmentEntry).toBeDefined()
    })

    it('validates vertex shader signature', () => {
      const { ast } = parse(fixtures.basicVertex)
      const result = analyze(ast)
      
      const vertexEntry = result.entryPoints.find(e => e.stage === 'vertex')
      expect(vertexEntry).toBeDefined()
    })

    it('validates compute shader signature', () => {
      const { ast } = parse(fixtures.computeShader)
      const result = analyze(ast)
      
      const computeEntry = result.entryPoints.find(e => e.stage === 'compute')
      expect(computeEntry).toBeDefined()
    })

    it('reports invalid fragment return type', () => {
      const source = `
        @fragment
        function main(): f32 {
          return 1.0;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe('uniform analysis', () => {
    it('extracts uniform names', () => {
      const { ast } = parse(fixtures.withUniforms)
      const result = analyze(ast)
      
      const uniformNames = result.uniforms.map(u => u.name)
      expect(uniformNames).toContain('time')
    })

    it('extracts uniform types', () => {
      const { ast } = parse(fixtures.withUniforms)
      const result = analyze(ast)
      
      const timeUniform = result.uniforms.find(u => u.name === 'time')
      expect(timeUniform?.type).toBe('f32')
    })

    it('assigns binding numbers', () => {
      const { ast } = parse(fixtures.withUniforms)
      const result = analyze(ast)
      
      for (const uniform of result.uniforms) {
        expect(uniform.binding).toBeDefined()
        expect(typeof uniform.binding).toBe('number')
      }
    })
  })

  describe('struct analysis', () => {
    it('validates struct field access', () => {
      const source = `
        struct Point { x: f32, y: f32 }
        
        function main(): f32 {
          const p: Point = Point { x: 1.0, y: 2.0 };
          return p.x;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports invalid field access', () => {
      const source = `
        struct Point { x: f32, y: f32 }
        
        function main(): f32 {
          const p: Point = Point { x: 1.0, y: 2.0 };
          return p.z;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    it('validates struct instantiation', () => {
      const source = `
        struct Point { x: f32, y: f32 }
        
        function main(): f32 {
          const p = Point { x: 1.0, y: 2.0 };
          return p.x;
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })
  })

  describe('control flow analysis', () => {
    it('validates all paths return', () => {
      const source = `
        function check(x: f32): f32 {
          if (x > 0.0) {
            return 1.0;
          } else {
            return -1.0;
          }
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('reports missing return in branch', () => {
      const { ast } = parse(fixtures.missingReturn)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe('builtin function validation', () => {
    it('recognizes Math.sin', () => {
      const source = `
        function main(): f32 {
          return Math.sin(1.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('recognizes Math.cos', () => {
      const source = `
        function main(): f32 {
          return Math.cos(1.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('recognizes Math.pow', () => {
      const source = `
        function main(): f32 {
          return Math.pow(2.0, 3.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics).toHaveLength(0)
    })

    it('validates Math function argument count', () => {
      const source = `
        function main(): f32 {
          return Math.pow(2.0);
        }
      `
      const { ast } = parse(source)
      const result = analyze(ast)
      
      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })
})
