# Shader3D

Write GPU shaders in TypeScript. Compiles to WGSL for WebGPU.

## Install

```bash
npm install @shader3d/core @shader3d/runtime
```

For Vite:
```bash
npm install @shader3d/vite-plugin -D
```

## Quick Start

```typescript
import { initWebGPU } from '@shader3d/runtime'

const shader = `
@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(pos[i], 0, 1);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1, 0, 0.5, 1);
}
`

const runtime = await initWebGPU(canvas)
runtime.createRenderPipeline('main', shader)
runtime.render()
```

## Packages

| Package | Description |
|---------|-------------|
| `@shader3d/core` | Parser and transpiler |
| `@shader3d/runtime` | WebGPU runtime |
| `@shader3d/vite-plugin` | Vite integration with HMR |
| `@shader3d/ladder` | CLI and learning tools |

## Vite Plugin

```typescript
// vite.config.ts
import shader3d from '@shader3d/vite-plugin'

export default {
  plugins: [shader3d()]
}
```

Then import `.shader3d` files directly:

```typescript
import myShader from './effects/glow.shader3d'
```

## CLI

```bash
npx shader3d init my-project
npx shader3d build
npx shader3d watch
```

## Browser Support

- Chrome 113+
- Edge 113+
- Firefox 141+
- Safari 18+

## License

Non-commercial use permitted. See [LICENSE](LICENSE) for details.
Commercial licensing available on request.
