# @shader3d/vite-plugin

Vite plugin for Shader3D with HMR support.

Provides:
- Compile `.shader3d.ts` files
- Hot module replacement for shaders
- Virtual module injection
- Build-time optimization

## Install

```bash
npm install @shader3d/vite-plugin -D
```

## Setup

```typescript
// vite.config.ts
import shader3d from '@shader3d/vite-plugin'

export default {
  plugins: [shader3d()]
}
```

## Usage

```typescript
import shader from './effects/glow.shader3d'

const pipeline = await runtime.createRenderPipeline('glow', shader)
```

## License

See [LICENSE](../../LICENSE) in the root directory.
