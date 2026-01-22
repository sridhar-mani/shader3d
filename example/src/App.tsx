import { useEffect, useRef, useState, useCallback } from 'react';
import { initWebGPU, createRenderLoop, type FrameData } from '@shader3d/runtime';

const shaderExamples = {
  gradient: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / 800.0;
  return vec4f(uv.x, uv.y, 0.5, 1.0);
}`,
  plasma: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)
  );
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
  triangle: `@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2f(0.0, 0.5), vec2f(-0.5, -0.5), vec2f(0.5, -0.5)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.4, 0.6, 1.0);
}`,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedShader, setSelectedShader] = useState<keyof typeof shaderExamples>('gradient');
  const [webgpuSupported, setWebgpuSupported] = useState(true);
  const [error, setError] = useState<string>('');
  const cleanupRef = useRef<(() => void) | null>(null);

  const initShader = useCallback(async (shaderName: keyof typeof shaderExamples) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    try {
      const ctx = await initWebGPU(canvas);
      const { device, context, format } = ctx;

      const shaderCode = shaderExamples[shaderName];
      const shaderModule = device.createShaderModule({ code: shaderCode });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
      });

      const render = (_frame: FrameData) => {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              loadOp: 'clear',
              clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
              storeOp: 'store',
            },
          ],
        });

        renderPass.setPipeline(pipeline);
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
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setWebgpuSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.gpu) {
      setWebgpuSupported(false);
      setError('WebGPU is not supported in your browser');
      return;
    }

    initShader(selectedShader);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [selectedShader, initShader]);

  if (!webgpuSupported) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Shader3D Example</h1>
        <div
          style={{
            padding: '1rem',
            background: '#ff6b6b',
            color: 'white',
            borderRadius: '8px',
            marginTop: '1rem',
          }}
        >
          <strong>WebGPU Not Supported</strong>
          <p>Your browser doesn't support WebGPU. Try Chrome 113+, Edge 113+, or Safari 18+.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Shader3D Examples</h1>
      <p>Interactive WebGPU shader demonstrations built with Shader3D</p>

      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Select Shader:</label>
        {(Object.keys(shaderExamples) as Array<keyof typeof shaderExamples>).map((name) => (
          <button
            key={name}
            onClick={() => setSelectedShader(name)}
            style={{
              padding: '0.5rem 1rem',
              marginRight: '0.5rem',
              background: selectedShader === name ? '#4a9eff' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: '#ff6b6b',
            color: 'white',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          border: '1px solid #444',
          borderRadius: '8px',
          display: 'block',
          maxWidth: '100%',
        }}
      />

      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#222',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          overflow: 'auto',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{shaderExamples[selectedShader]}</pre>
      </div>

      <div style={{ marginTop: '2rem', color: '#888', fontSize: '0.9rem' }}>
        <p>
          <strong>Shader3D</strong> - Write GPU shaders in TypeScript, compile to WGSL for WebGPU
        </p>
        <p>
          <a href="https://github.com/sridhar-mani/newLang" style={{ color: '#4a9eff' }}>
            View on GitHub
          </a>
          {' | '}
          <a href="https://www.npmjs.com/org/shader3d" style={{ color: '#4a9eff' }}>
            npm Packages
          </a>
        </p>
      </div>
    </div>
  );
}
