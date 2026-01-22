import { describe, it, expect, beforeEach } from 'vitest'
import { parse } from '../../packages/core/src/parser'
import { transform } from '../../packages/core/src/transformer'
import { generate } from '../../packages/core/src/codegen'
import { analyze } from '../../packages/core/src/analyzer'
import * as fixtures from '../fixtures/shaders'

function compile(source: string): { code: string; errors: any[] } {
  const { ast, diagnostics: parseErrors } = parse(source)
  if (parseErrors.length > 0) {
    return { code: '', errors: parseErrors }
  }
  
  const { ir, diagnostics: transformErrors } = transform(ast)
  if (transformErrors.length > 0) {
    return { code: '', errors: transformErrors }
  }
  
  const { code, diagnostics: codegenErrors } = generate(ir)
  return { code, errors: codegenErrors }
}

describe('Full Pipeline Integration', () => {
  describe('end-to-end compilation', () => {
    it('compiles basic fragment shader', () => {
      const result = compile(fixtures.basicFragment)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('@fragment')
      expect(result.code).toContain('fn main')
      expect(result.code).toContain('vec4')
    })

    it('compiles basic vertex shader', () => {
      const result = compile(fixtures.basicVertex)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('@vertex')
      expect(result.code).toContain('fn main')
    })

    it('compiles compute shader', () => {
      const result = compile(fixtures.computeShader)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('@compute')
      expect(result.code).toContain('@workgroup_size')
    })

    it('compiles shader with uniforms', () => {
      const result = compile(fixtures.withUniforms)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('@group')
      expect(result.code).toContain('@binding')
      expect(result.code).toContain('uniform')
    })

    it('compiles shader with structs', () => {
      const result = compile(fixtures.withStruct)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('struct')
    })

    it('compiles shader with complex math', () => {
      const result = compile(fixtures.complexMath)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toMatch(/sin|cos|pow|sqrt/)
    })

    it('compiles shader with loops', () => {
      const result = compile(fixtures.withLoop)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('for')
    })

    it('compiles shader with conditionals', () => {
      const result = compile(fixtures.withConditional)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('if')
    })

    it('compiles shader with helper functions', () => {
      const result = compile(fixtures.helperFunction)
      
      expect(result.errors).toHaveLength(0)
      const fnCount = (result.code.match(/fn /g) || []).length
      expect(fnCount).toBeGreaterThanOrEqual(2)
    })

    it('compiles shader with multiple entry points', () => {
      const result = compile(fixtures.multipleEntryPoints)
      
      expect(result.errors).toHaveLength(0)
      expect(result.code).toContain('@vertex')
      expect(result.code).toContain('@fragment')
    })
  })

  describe('error handling', () => {
    it('reports syntax errors', () => {
      const result = compile(fixtures.syntaxError)
      
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('reports type errors', () => {
      const result = compile(fixtures.typeError)
      
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('reports undefined variables', () => {
      const result = compile(fixtures.undefinedVariable)
      
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('reports missing return', () => {
      const result = compile(fixtures.missingReturn)
      
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('error messages quality', () => {
    it('includes line number in error', () => {
      const result = compile(fixtures.syntaxError)
      
      if (result.errors.length > 0) {
        const error = result.errors[0]
        expect(error.line).toBeDefined()
      }
    })

    it('includes column number in error', () => {
      const result = compile(fixtures.syntaxError)
      
      if (result.errors.length > 0) {
        const error = result.errors[0]
        expect(error.column).toBeDefined()
      }
    })

    it('includes descriptive message', () => {
      const result = compile(fixtures.syntaxError)
      
      if (result.errors.length > 0) {
        const error = result.errors[0]
        expect(error.message).toBeDefined()
        expect(error.message.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('Semantic Analysis Integration', () => {
  it('validates types across pipeline', () => {
    const source = `
      @fragment
      function main(): vec4f {
        const x: f32 = 1.0;
        const y: f32 = 2.0;
        return vec4f(x, y, 0.0, 1.0);
      }
    `
    const { ast } = parse(source)
    const analysisResult = analyze(ast)
    
    expect(analysisResult.diagnostics).toHaveLength(0)
  })

  it('detects type mismatches', () => {
    const source = `
      @fragment
      function main(): vec4f {
        const x: i32 = 1.0; // Type mismatch: i32 = f32
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `
    const { ast } = parse(source)
    const analysisResult = analyze(ast)
    
    expect(analysisResult.diagnostics.length).toBeGreaterThan(0)
  })

  it('validates uniform usage', () => {
    const source = `
      uniform time: f32;
      
      @fragment
      function main(): vec4f {
        return vec4f(time, 0.0, 0.0, 1.0);
      }
    `
    const { ast } = parse(source)
    const analysisResult = analyze(ast)
    
    expect(analysisResult.uniforms).toContainEqual(
      expect.objectContaining({ name: 'time' })
    )
  })

  it('validates struct field access', () => {
    const source = `
      struct Vertex {
        position: vec3f,
        color: vec4f
      }
      
      @vertex
      function main(@location(0) v: Vertex): vec4f {
        return v.color;
      }
    `
    const { ast } = parse(source)
    const analysisResult = analyze(ast)
    
    expect(analysisResult.diagnostics).toHaveLength(0)
  })
})

describe('Roundtrip Consistency', () => {
  it('produces consistent output for same input', () => {
    const result1 = compile(fixtures.basicFragment)
    const result2 = compile(fixtures.basicFragment)
    
    expect(result1.code).toBe(result2.code)
  })

  it('produces consistent output across multiple compilations', () => {
    const results = []
    for (let i = 0; i < 5; i++) {
      results.push(compile(fixtures.complexMath))
    }
    
    const first = results[0].code
    for (const result of results) {
      expect(result.code).toBe(first)
    }
  })
})

describe('Edge Cases', () => {
  it('handles empty function body', () => {
    const source = `
      function noop(): void {
      }
    `
    const result = compile(source)
    expect(result.code).toContain('fn noop')
  })

  it('handles deeply nested expressions', () => {
    const source = `
      @fragment
      function main(): vec4f {
        const x = ((((1.0 + 2.0) * 3.0) - 4.0) / 5.0);
        return vec4f(x, x, x, 1.0);
      }
    `
    const result = compile(source)
    expect(result.errors).toHaveLength(0)
  })

  it('handles unicode identifiers', () => {
    const source = `
      function calcΔ(): f32 {
        return 1.0;
      }
    `
    const result = compile(source)
    expect(result.code).toContain('calc')
  })

  it('handles long function names', () => {
    const source = `
      function thisIsAVeryLongFunctionNameThatShouldStillWork(): f32 {
        return 1.0;
      }
    `
    const result = compile(source)
    expect(result.code).toContain('thisIsAVeryLongFunctionNameThatShouldStillWork')
  })

  it('handles many parameters', () => {
    const source = `
      function manyParams(a: f32, b: f32, c: f32, d: f32, e: f32, f: f32): f32 {
        return a + b + c + d + e + f;
      }
    `
    const result = compile(source)
    expect(result.errors).toHaveLength(0)
  })

  it('handles chained member access', () => {
    const source = `
      @fragment
      function main(): vec4f {
        const v = vec4f(1.0, 2.0, 3.0, 4.0);
        const rgb = v.xyz;
        return vec4f(rgb, 1.0);
      }
    `
    const result = compile(source)
    expect(result.code).toContain('.xyz')
  })

  it('handles swizzle operations', () => {
    const source = `
      @fragment
      function main(): vec4f {
        const v = vec4f(1.0, 2.0, 3.0, 4.0);
        return v.rgba;
      }
    `
    const result = compile(source)
    expect(result.errors).toHaveLength(0)
  })
})

describe('WGSL Output Validity', () => {
  it('generates syntactically valid WGSL', () => {
    const result = compile(fixtures.basicFragment)
    
    expect(result.code).not.toContain('function ')
    expect(result.code).toContain('fn ')
    expect(result.code).not.toContain('const ')
    expect(result.code).toMatch(/let |var /)
  })

  it('generates proper semicolons', () => {
    const result = compile(fixtures.withLoop)
    
    expect(result.code.split(';').length).toBeGreaterThan(1)
  })

  it('generates balanced braces', () => {
    const result = compile(fixtures.multipleEntryPoints)
    
    const opens = (result.code.match(/\{/g) || []).length
    const closes = (result.code.match(/\}/g) || []).length
    expect(opens).toBe(closes)
  })

  it('generates balanced parentheses', () => {
    const result = compile(fixtures.complexMath)
    
    const opens = (result.code.match(/\(/g) || []).length
    const closes = (result.code.match(/\)/g) || []).length
    expect(opens).toBe(closes)
  })
})
