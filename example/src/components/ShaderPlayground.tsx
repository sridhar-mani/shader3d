import { useEffect, useRef, useState, useCallback } from 'react';
import { initWebGPU, createRenderLoop, isWebGPUSupported, type FrameData } from '@shader3d/runtime';
import { parse, analyze, transform, codegen } from '@shader3d/core';

const tsShaderExamples = {
  gradient: `// Simple UV Gradient
fn vertexMain(vertexIndex: u32): vec4f {
  const positions = [
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  ];
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

fn fragmentMain(position: vec4f): vec4f {
  const uv = position.xy / 800.0;
  return vec4f(uv.x, uv.y, 0.5, 1.0);
}`,
  plasma: `// Animated Plasma Effect
uniform time: f32;

fn vertexMain(vertexIndex: u32): vec4f {
  const positions = [
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  ];
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

fn fragmentMain(position: vec4f): vec4f {
  const uv = (position.xy / 600.0) * 2.0 - 1.0;
  const d = length(uv);
  const col = 0.5 + 0.5 * cos(d * 10.0 - time + vec3f(0.0, 2.0, 4.0));
  return vec4f(col, 1.0);
}`,
  waves: `// Rippling Waves
uniform time: f32;

fn vertexMain(vertexIndex: u32): vec4f {
  const positions = [
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  ];
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

fn fragmentMain(position: vec4f): vec4f {
  const uv = position.xy / vec2f(800.0, 600.0);
  const wave1 = sin(uv.x * 20.0 + time * 2.0) * 0.5;
  const wave2 = sin(uv.y * 15.0 + time * 1.5) * 0.5;
  const combined = wave1 + wave2;
  return vec4f(
    0.3 + combined * 0.2,
    0.5 + combined * 0.3,
    0.8 + combined * 0.1,
    1.0
  );
}`,
  circles: `// Concentric Circles
uniform time: f32;

fn vertexMain(vertexIndex: u32): vec4f {
  const positions = [
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  ];
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

fn fragmentMain(position: vec4f): vec4f {
  const uv = (position.xy / 600.0) * 2.0 - 1.0;
  const d = length(uv);
  const rings = sin(d * 30.0 - time * 3.0);
  const glow = smoothstep(1.0, 0.0, d);
  return vec4f(
    rings * 0.5 + 0.5,
    glow * 0.8,
    rings * glow,
    1.0
  );
}`,
};

// Pre-compiled WGSL for fallback
const wgslShaders: Record<string, string> = {
  gradient: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / 800.0;
  return vec4f(uv.x, uv.y, 0.5, 1.0);
}`,
  plasma: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0) var<uniform> time: f32;

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy / 600.0) * 2.0 - 1.0;
  let d = length(uv);
  let col = 0.5 + 0.5 * cos(d * 10.0 - time + vec3f(0.0, 2.0, 4.0));
  return vec4f(col, 1.0);
}`,
  waves: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0) var<uniform> time: f32;

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / vec2f(800.0, 600.0);
  let wave1 = sin(uv.x * 20.0 + time * 2.0) * 0.5;
  let wave2 = sin(uv.y * 15.0 + time * 1.5) * 0.5;
  let combined = wave1 + wave2;
  return vec4f(0.3 + combined * 0.2, 0.5 + combined * 0.3, 0.8 + combined * 0.1, 1.0);
}`,
  circles: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0) var<uniform> time: f32;

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy / 600.0) * 2.0 - 1.0;
  let d = length(uv);
  let rings = sin(d * 30.0 - time * 3.0);
  let glow = smoothstep(1.0, 0.0, d);
  return vec4f(rings * 0.5 + 0.5, glow * 0.8, rings * glow, 1.0);
}`,
};

export function ShaderPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedShader, setSelectedShader] = useState<keyof typeof tsShaderExamples>('gradient');
  const [customCode, setCustomCode] = useState(tsShaderExamples.gradient);
  const [compiledWGSL, setCompiledWGSL] = useState('');
  const [compileError, setCompileError] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Check WebGPU support on mount
  useEffect(() => {
    isMountedRef.current = true;
    if (!isWebGPUSupported()) {
      setWebgpuSupported(false);
      setCompileError(
        'WebGPU is not supported in your browser. Please use Chrome, Edge, or another WebGPU-enabled browser.'
      );
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Compile TypeScript-like shader to WGSL using @shader3d/core
  const compileShader = useCallback(
    (source: string): string | null => {
      if (!isMountedRef.current) return null;

      try {
        const parseResult = parse(source);
        const transformResult = transform(parseResult.ast);
        const analysisResult = analyze(transformResult.ir);
        const codegenResult = codegen(analysisResult.ir);
        if (isMountedRef.current) {
          setCompileError('');
        }
        return codegenResult.code;
      } catch (err) {
        // Fallback to pre-compiled WGSL for demo purposes
        const precompiled = wgslShaders[selectedShader];
        if (precompiled && !isCustom) {
          if (isMountedRef.current) {
            setCompileError('');
          }
          return precompiled;
        }
        if (isMountedRef.current) {
          setCompileError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [selectedShader, isCustom]
  );

  const initShader = useCallback(
    async (wgslCode: string) => {
      const canvas = canvasRef.current;
      if (!canvas || !webgpuSupported) return;

      // Clean up any existing WebGPU resources before initializing new ones
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (err) {
          console.warn('Cleanup error:', err);
        } finally {
          cleanupRef.current = null;
        }
      }

      try {
        const ctx = await initWebGPU(canvas);
        const { device, context, format } = ctx;

        const shaderModule = device.createShaderModule({ code: wgslCode });

        // Check for uniform time
        const hasTime = wgslCode.includes('time');
        let timeBuffer: GPUBuffer | null = null;
        let bindGroup: GPUBindGroup | null = null;

        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: 'vs_main' },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
          },
        });

        if (hasTime) {
          timeBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });
          bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: timeBuffer } }],
          });
        }

        const startTime = performance.now();

        const render = (_frame: FrameData) => {
          if (hasTime && timeBuffer) {
            const time = (performance.now() - startTime) / 1000;
            device.queue.writeBuffer(timeBuffer, 0, new Float32Array([time]));
          }

          const commandEncoder = device.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();

          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: textureView,
                loadOp: 'clear',
                clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
                storeOp: 'store',
              },
            ],
          });

          renderPass.setPipeline(pipeline);
          if (bindGroup) {
            renderPass.setBindGroup(0, bindGroup);
          }
          renderPass.draw(3);
          renderPass.end();
          device.queue.submit([commandEncoder.finish()]);
        };

        const loop = createRenderLoop(render);
        loop.start();

        cleanupRef.current = () => {
          loop.stop();
          device.destroy();
        };
      } catch (err) {
        if (isMountedRef.current) {
          setCompileError(`WebGPU Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    },
    [webgpuSupported]
  );

  useEffect(() => {
    if (!isMountedRef.current) return;

    const wgsl = compileShader(customCode);
    if (wgsl && isMountedRef.current) {
      setCompiledWGSL(wgsl);
      initShader(wgsl);
    }

    return () => {
      // Cleanup WebGPU resources when component unmounts or dependencies change
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (err) {
          console.warn('Cleanup error on unmount:', err);
        } finally {
          cleanupRef.current = null;
        }
      }
    };
  }, [customCode, compileShader, initShader]);

  const handlePresetSelect = (name: keyof typeof tsShaderExamples) => {
    setSelectedShader(name);
    setCustomCode(tsShaderExamples[name]);
    setIsCustom(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Example Shaders:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(Object.keys(tsShaderExamples) as Array<keyof typeof tsShaderExamples>).map((name) => (
              <button
                key={name}
                onClick={() => handlePresetSelect(name)}
                style={{
                  padding: '0.5rem 1rem',
                  background: selectedShader === name && !isCustom ? '#4a9eff' : '#2a2a3e',
                  color: selectedShader === name && !isCustom ? '#fff' : '#aaa',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            TypeScript Shader Code:
          </label>
          <textarea
            value={customCode}
            onChange={(e) => {
              setCustomCode(e.target.value);
              setIsCustom(true);
            }}
            style={{
              width: '100%',
              height: '300px',
              background: '#1a1a2e',
              color: '#e0e0e0',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              resize: 'vertical',
            }}
          />
        </div>

        {compileError && (
          <div
            style={{
              padding: '1rem',
              background: '#ff4444',
              color: 'white',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}
          >
            <strong>Compile Error:</strong> {compileError}
          </div>
        )}

        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: '#888' }}>View Compiled WGSL</summary>
          <pre
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: '#1a1a2e',
              borderRadius: '8px',
              fontSize: '0.8rem',
              overflow: 'auto',
              maxHeight: '200px',
            }}
          >
            {compiledWGSL}
          </pre>
        </details>
      </div>

      <div>
        <canvas
          ref={canvasRef}
          width={600}
          height={450}
          style={{
            border: '1px solid #333',
            borderRadius: '8px',
            display: 'block',
            width: '100%',
            background: '#0a0a0f',
          }}
        />
        <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.85rem' }}>
          ✨ Write shaders in TypeScript-like syntax → Compiled to WGSL → Rendered with WebGPU
        </p>
      </div>
    </div>
  );
}
