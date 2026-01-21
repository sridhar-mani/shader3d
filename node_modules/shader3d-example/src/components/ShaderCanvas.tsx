import { useRef, useEffect } from 'react'
import { useWebGPU, useShaderAnimation } from '../hooks/useWebGPU'

interface ShaderCanvasProps {
  shader: string
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

export function ShaderCanvas({
  shader,
  width = 800,
  height = 600,
  className,
  style
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const { device, context, format, error } = useWebGPU(canvasRef)
  
  // Calculate actual canvas dimensions
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const canvasWidth = width * dpr
  const canvasHeight = height * dpr
  
  const { handleMouseMove } = useShaderAnimation(
    device,
    context,
    format,
    shader,
    { width: canvasWidth, height: canvasHeight }
  )

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasWidth
    canvas.height = canvasHeight
  }, [canvasWidth, canvasHeight])

  if (error) {
    return (
      <div 
        className={className}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: 12,
          color: '#ff6b6b',
          padding: 20,
          textAlign: 'center',
          ...style
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 10px' }}>⚠️ WebGPU Error</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>{error}</p>
          <p style={{ margin: '10px 0 0', fontSize: '0.875rem', opacity: 0.6 }}>
            Try Chrome 113+ or Edge 113+
          </p>
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      className={className}
      style={{
        width,
        height,
        borderRadius: 12,
        cursor: 'crosshair',
        ...style
      }}
    />
  )
}

export default ShaderCanvas
