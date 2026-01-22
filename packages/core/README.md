# @shader3d/core

Core transpiler and code generation for Shader3D.

Provides:
- TypeScript DSL parser
- WGSL, GLSL, and JavaScript code generators
- Type validation and strict mode
- Source map support
- Shader AST types

## Install

```bash
npm install @shader3d/core
```

## Usage

```typescript
import { transpile } from '@shader3d/core'

const wgsl = transpile(`
  fn main() -> vec4f {
    return vec4f(1, 0, 0.5, 1);
  }
`)
```

## License

See [LICENSE](../../LICENSE) in the root directory.
