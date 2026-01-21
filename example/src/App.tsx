import { useState } from 'react'
import { ShaderCanvas } from './components/ShaderCanvas'
import { ShaderSelector, ShaderOption } from './components/ShaderSelector'
import { GRADIENT_SHADER } from './shaders/gradient.wgsl'
import { PLASMA_SHADER } from './shaders/plasma.wgsl'
import { METABALLS_SHADER } from './shaders/metaballs.wgsl'
import './App.css'

// Define available shader demos
const SHADER_OPTIONS: ShaderOption[] = [
  {
    id: 'gradient',
    name: 'Gradient',
    description: 'Animated color palette with waves',
    level: 2,
    shader: GRADIENT_SHADER
  },
  {
    id: 'plasma',
    name: 'Plasma',
    description: 'Classic demoscene effect',
    level: 2,
    shader: PLASMA_SHADER
  },
  {
    id: 'metaballs',
    name: 'Metaballs',
    description: 'Interactive blob simulation',
    level: 3,
    shader: METABALLS_SHADER
  }
]

function App() {
  const [selectedShader, setSelectedShader] = useState('gradient')

  const currentShader = SHADER_OPTIONS.find(s => s.id === selectedShader)!

  return (
    <div className="app">
      <header className="header">
        <h1>Shader3D</h1>
        <p className="tagline">Progressive Graphics Programming</p>
      </header>

      <main className="main">
        <ShaderSelector
          options={SHADER_OPTIONS}
          selected={selectedShader}
          onSelect={setSelectedShader}
        />

        <div className="canvas-container">
          <ShaderCanvas
            key={selectedShader}
            shader={currentShader.shader}
            width={800}
            height={500}
          />
          <div className="shader-info">
            <span className="shader-name">{currentShader.name}</span>
            <span className="shader-level">Level {currentShader.level}</span>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <h3>WebGPU Powered</h3>
            <p>Native GPU performance with modern WebGPU API</p>
          </div>
          <div className="feature">
            <h3>Progressive Learning</h3>
            <p>Start with JS, graduate to full WGSL mastery</p>
          </div>
          <div className="feature">
            <h3>HMR Support</h3>
            <p>Hot reload shaders without losing state</p>
          </div>
          <div className="feature">
            <h3>Type Safe</h3>
            <p>Full TypeScript support with strict mode</p>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>
          Built with Shader3D • 
          <a href="https://github.com/shader3d/shader3d" target="_blank" rel="noopener">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
