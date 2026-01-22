# @shader3d/runtime

WebGPU and Three.js runtime for Shader3D.

Provides:
- WebGPU context initialization
- Render pipeline management
- Three.js shader integration
- HMR (Hot Module Reload) support
- Built-in uniforms (time, resolution, mouse)

## Install

```bash
npm install @shader3d/runtime
```

## Usage

```typescript
import { initWebGPU } from '@shader3d/runtime'

const runtime = await initWebGPU(canvas)
const pipeline = await runtime.createRenderPipeline('main', shaderCode)
runtime.render()
```

## License

See [LICENSE](../../LICENSE) in the root directory.
