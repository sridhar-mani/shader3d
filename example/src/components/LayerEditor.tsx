import { useState } from 'react';

const EFFECTS = ['Blur', 'Glow', 'Color', 'Noise', 'Distortion'];

interface Layer {
  id: string;
  name: string;
  effect: string;
  opacity: number;
}

export function LayerEditor() {
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Base', effect: 'Blur', opacity: 100 },
  ]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
      <div
        style={{
          padding: '1.5rem',
          background: '#1a1a2e',
          borderRadius: '8px',
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        Preview
      </div>

      <div>
        <h3 style={{ margin: '0 0 1rem 0' }}>Layers ({layers.length})</h3>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}
        >
          {layers.map((layer) => (
            <div
              key={layer.id}
              style={{
                padding: '0.75rem',
                background: '#2a2a3e',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{layer.name}</div>
              <div style={{ color: '#888', fontSize: '0.8rem' }}>
                {layer.effect} • {layer.opacity}%
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setLayers([
              ...layers,
              {
                id: String(Date.now()),
                name: `Layer ${layers.length + 1}`,
                effect: EFFECTS[0],
                opacity: 100,
              },
            ])
          }
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Add Layer
        </button>
      </div>
    </div>
  );
}
