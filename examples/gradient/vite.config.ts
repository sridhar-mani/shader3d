import { defineConfig } from 'vite'
import shader3d from '@shader3d/vite-plugin'

export default defineConfig({
  plugins: [
    shader3d({
      hmr: true,
      performanceHints: true,
      strictMode: 'standard'
    })
  ]
})
