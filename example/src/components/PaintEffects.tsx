import { useState, useRef, useEffect } from 'react';
import { GestureRecognizer } from '@shader3d/paint-effects';

const GESTURE_EFFECTS: Record<string, string> = {
  circle: '⭕ Radial Blur',
  line: '➖ Motion Blur',
  zigzag: '〰️ Wave Distortion',
  spiral: '🌀 Swirl',
  scribble: '✏️ Grain',
  triangle: '🔺 Sharpen',
  rectangle: '⬜ Vignette',
};

export function PaintEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [detectedGestures, setDetectedGestures] = useState<string[]>([]);

  const recognizerRef = useRef(new GestureRecognizer());
  const strokeRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    strokeRef.current = [];

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    strokeRef.current.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    strokeRef.current.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || strokeRef.current.length < 3) {
      setIsDrawing(false);
      return;
    }

    setIsDrawing(false);

    try {
      const gesture = recognizerRef.current.recognize({
        points: strokeRef.current,
        startTime: Date.now(),
        endTime: Date.now(),
      });

      if (gesture && GESTURE_EFFECTS[gesture.type]) {
        setDetectedGestures((prev) => [GESTURE_EFFECTS[gesture.type], ...prev.slice(0, 4)]);
      }
    } catch {
      // Gesture recognition failed, ignore
    }

    strokeRef.current = [];
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
      <div>
        <div
          style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
            Draw gestures to recognize effects
          </p>
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
              setDetectedGestures([]);
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#4a2a2a',
              color: '#f88',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Clear
          </button>
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            background: '#1a1a2e',
            borderRadius: '8px',
            border: '2px solid #333',
            cursor: 'crosshair',
            display: 'block',
            width: '100%',
            height: '400px',
          }}
        />

        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#888', fontSize: '0.85rem' }}>
            Gesture Map:
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            {Object.entries(GESTURE_EFFECTS).map(([type, label]) => (
              <div
                key={type}
                style={{ padding: '0.5rem', background: '#2a2a3e', borderRadius: '4px' }}
              >
                {label.split(' ')[0]} {type}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 500 }}>Detected</h3>
        {detectedGestures.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              background: '#1a1a2e',
              borderRadius: '4px',
              textAlign: 'center',
              color: '#666',
              fontSize: '0.9rem',
            }}
          >
            Draw to detect
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {detectedGestures.map((gesture, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem',
                  background: '#2a2a3e',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                }}
              >
                {gesture}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
