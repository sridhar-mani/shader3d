import { describe, bench } from 'vitest';
import { parse } from '../../packages/core/src/parser';
import { transform } from '../../packages/core/src/transformer';
import { generate } from '../../packages/core/src/codegen';
import * as fixtures from '../fixtures/shaders';

function compile(source: string): string {
  const { ast } = parse(source);
  const { ir } = transform(ast);
  const { code } = generate(ir);
  return code;
}

describe('Parser Performance', () => {
  bench('parse basic fragment shader', () => {
    parse(fixtures.basicFragment);
  });

  bench('parse basic vertex shader', () => {
    parse(fixtures.basicVertex);
  });

  bench('parse shader with uniforms', () => {
    parse(fixtures.withUniforms);
  });

  bench('parse shader with struct', () => {
    parse(fixtures.withStruct);
  });

  bench('parse compute shader', () => {
    parse(fixtures.computeShader);
  });

  bench('parse complex math shader', () => {
    parse(fixtures.complexMath);
  });

  bench('parse shader with loop', () => {
    parse(fixtures.withLoop);
  });

  bench('parse shader with conditional', () => {
    parse(fixtures.withConditional);
  });

  bench('parse shader with helper function', () => {
    parse(fixtures.helperFunction);
  });

  bench('parse shader with multiple entry points', () => {
    parse(fixtures.multipleEntryPoints);
  });
});

describe('Transformer Performance', () => {
  const basicFragmentAST = parse(fixtures.basicFragment).ast;
  const basicVertexAST = parse(fixtures.basicVertex).ast;
  const uniformsAST = parse(fixtures.withUniforms).ast;
  const structAST = parse(fixtures.withStruct).ast;
  const computeAST = parse(fixtures.computeShader).ast;
  const complexMathAST = parse(fixtures.complexMath).ast;
  const loopAST = parse(fixtures.withLoop).ast;
  const conditionalAST = parse(fixtures.withConditional).ast;

  bench('transform basic fragment shader', () => {
    transform(basicFragmentAST);
  });

  bench('transform basic vertex shader', () => {
    transform(basicVertexAST);
  });

  bench('transform shader with uniforms', () => {
    transform(uniformsAST);
  });

  bench('transform shader with struct', () => {
    transform(structAST);
  });

  bench('transform compute shader', () => {
    transform(computeAST);
  });

  bench('transform complex math shader', () => {
    transform(complexMathAST);
  });

  bench('transform shader with loop', () => {
    transform(loopAST);
  });

  bench('transform shader with conditional', () => {
    transform(conditionalAST);
  });
});

describe('Codegen Performance', () => {
  const basicFragmentIR = transform(parse(fixtures.basicFragment).ast).ir;
  const basicVertexIR = transform(parse(fixtures.basicVertex).ast).ir;
  const uniformsIR = transform(parse(fixtures.withUniforms).ast).ir;
  const structIR = transform(parse(fixtures.withStruct).ast).ir;
  const computeIR = transform(parse(fixtures.computeShader).ast).ir;
  const complexMathIR = transform(parse(fixtures.complexMath).ast).ir;

  bench('generate basic fragment shader', () => {
    generate(basicFragmentIR);
  });

  bench('generate basic vertex shader', () => {
    generate(basicVertexIR);
  });

  bench('generate shader with uniforms', () => {
    generate(uniformsIR);
  });

  bench('generate shader with struct', () => {
    generate(structIR);
  });

  bench('generate compute shader', () => {
    generate(computeIR);
  });

  bench('generate complex math shader', () => {
    generate(complexMathIR);
  });
});

describe('Full Pipeline Performance', () => {
  bench('compile basic fragment shader', () => {
    compile(fixtures.basicFragment);
  });

  bench('compile basic vertex shader', () => {
    compile(fixtures.basicVertex);
  });

  bench('compile shader with uniforms', () => {
    compile(fixtures.withUniforms);
  });

  bench('compile shader with struct', () => {
    compile(fixtures.withStruct);
  });

  bench('compile compute shader', () => {
    compile(fixtures.computeShader);
  });

  bench('compile complex math shader', () => {
    compile(fixtures.complexMath);
  });

  bench('compile shader with loop', () => {
    compile(fixtures.withLoop);
  });

  bench('compile shader with conditional', () => {
    compile(fixtures.withConditional);
  });

  bench('compile shader with helper function', () => {
    compile(fixtures.helperFunction);
  });

  bench('compile shader with multiple entry points', () => {
    compile(fixtures.multipleEntryPoints);
  });
});

describe('Large Shader Performance', () => {
  const largeShader = `
    uniform time: f32;
    uniform resolution: vec2f;
    uniform mouse: vec2f;
    
    struct Light {
      position: vec3f,
      color: vec3f,
      intensity: f32
    }
    
    struct Material {
      diffuse: vec3f,
      specular: vec3f,
      shininess: f32
    }
    
    function calculateLighting(
      position: vec3f,
      normal: vec3f,
      viewDir: vec3f,
      light: Light,
      material: Material
    ): vec3f {
      const lightDir = normalize(light.position - position);
      const diff = Math.max(dot(normal, lightDir), 0.0);
      const diffuse = light.color * diff * material.diffuse;
      
      const reflectDir = reflect(-lightDir, normal);
      const spec = Math.pow(Math.max(dot(viewDir, reflectDir), 0.0), material.shininess);
      const specular = light.color * spec * material.specular;
      
      return (diffuse + specular) * light.intensity;
    }
    
    function sdfSphere(p: vec3f, radius: f32): f32 {
      return length(p) - radius;
    }
    
    function sdfBox(p: vec3f, b: vec3f): f32 {
      const q = abs(p) - b;
      return length(Math.max(q, vec3f(0.0))) + Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0.0);
    }
    
    function sdfUnion(d1: f32, d2: f32): f32 {
      return Math.min(d1, d2);
    }
    
    function sdfIntersection(d1: f32, d2: f32): f32 {
      return Math.max(d1, d2);
    }
    
    function sdfDifference(d1: f32, d2: f32): f32 {
      return Math.max(d1, -d2);
    }
    
    function scene(p: vec3f): f32 {
      const sphere = sdfSphere(p - vec3f(0.0, 0.0, 0.0), 1.0);
      const box = sdfBox(p - vec3f(2.0, 0.0, 0.0), vec3f(0.8, 0.8, 0.8));
      return sdfUnion(sphere, box);
    }
    
    function estimateNormal(p: vec3f): vec3f {
      const eps = 0.001;
      const n = vec3f(
        scene(p + vec3f(eps, 0.0, 0.0)) - scene(p - vec3f(eps, 0.0, 0.0)),
        scene(p + vec3f(0.0, eps, 0.0)) - scene(p - vec3f(0.0, eps, 0.0)),
        scene(p + vec3f(0.0, 0.0, eps)) - scene(p - vec3f(0.0, 0.0, eps))
      );
      return normalize(n);
    }
    
    function rayMarch(ro: vec3f, rd: vec3f): f32 {
      var t = 0.0;
      for (var i = 0; i < 100; i = i + 1) {
        const p = ro + rd * t;
        const d = scene(p);
        if (d < 0.001) {
          return t;
        }
        t = t + d;
        if (t > 100.0) {
          return -1.0;
        }
      }
      return -1.0;
    }
    
    @fragment
    function main(@builtin(position) fragCoord: vec4f): vec4f {
      const uv = (fragCoord.xy - resolution * 0.5) / resolution.y;
      
      const ro = vec3f(0.0, 0.0, -5.0);
      const rd = normalize(vec3f(uv.x, uv.y, 1.0));
      
      const t = rayMarch(ro, rd);
      
      if (t > 0.0) {
        const p = ro + rd * t;
        const n = estimateNormal(p);
        
        const light = Light {
          position: vec3f(2.0, 2.0, -2.0),
          color: vec3f(1.0, 1.0, 1.0),
          intensity: 1.0
        };
        
        const material = Material {
          diffuse: vec3f(0.8, 0.2, 0.2),
          specular: vec3f(1.0, 1.0, 1.0),
          shininess: 32.0
        };
        
        const viewDir = -rd;
        const color = calculateLighting(p, n, viewDir, light, material);
        
        return vec4f(color, 1.0);
      }
      
      return vec4f(0.1, 0.1, 0.15, 1.0);
    }
  `;

  bench('parse large raymarching shader', () => {
    parse(largeShader);
  });

  bench('compile large raymarching shader', () => {
    compile(largeShader);
  });
});

describe('Memory Stress Test', () => {
  bench('compile 100 shaders sequentially', () => {
    for (let i = 0; i < 100; i++) {
      compile(fixtures.basicFragment);
    }
  });

  bench('compile varied shaders', () => {
    compile(fixtures.basicFragment);
    compile(fixtures.basicVertex);
    compile(fixtures.withUniforms);
    compile(fixtures.withStruct);
    compile(fixtures.computeShader);
    compile(fixtures.complexMath);
    compile(fixtures.withLoop);
    compile(fixtures.withConditional);
    compile(fixtures.helperFunction);
    compile(fixtures.multipleEntryPoints);
  });
});
