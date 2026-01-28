import { useState } from 'react';

const SAMPLE_IMAGES = [
  {
    name: 'Golden Hour',
    url: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=200',
    icon: '🌅',
  },
  {
    name: 'Portrait',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    icon: '👤',
  },
  {
    name: 'Vintage',
    url: 'https://images.unsplash.com/photo-1518173946687-a4c036bc3c95?w=200',
    icon: '📼',
  },
  {
    name: 'Mountain',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=200',
    icon: '⛰️',
  },
];

export function LearnFromExamples() {
  const [selected, setSelected] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ colors: string[]; effects: string[] } | null>(null);

  const analyze = async (name: string) => {
    setSelected(name);
    setAnalysis({
      colors: ['Warm', 'Golden', 'Soft'],
      effects: ['Brightness +15%', 'Saturation +5%', 'Vignette'],
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Sample Images:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {SAMPLE_IMAGES.map((img) => (
            <button
              key={img.name}
              onClick={() => analyze(img.name)}
              style={{
                aspectRatio: '1',
                padding: 0,
                background: selected === img.name ? '#2a3a5e' : '#2a2a3e',
                border: selected === img.name ? '2px solid #4a9eff' : '1px solid #333',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{img.icon}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{img.name}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Or upload image:
          </label>
          <input
            type="file"
            accept="image/*"
            style={{
              display: 'block',
              width: '100%',
              padding: '1rem',
              background: '#1a1a2e',
              color: '#fff',
              border: '1px dashed #333',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Analysis</h3>
        {!analysis ? (
          <div
            style={{
              padding: '2rem',
              background: '#1a1a2e',
              borderRadius: '4px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            Select an image to analyze
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#888' }}>
                Detected Colors:
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {analysis.colors.map((color) => (
                  <div
                    key={color}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#2a2a3e',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {color}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#888' }}>
                Suggested Effects:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {analysis.effects.map((effect, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.75rem',
                      background: '#2a2a3e',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      borderLeft: '2px solid #4a9eff',
                    }}
                  >
                    {effect}
                  </div>
                ))}
              </div>
            </div>

            <button
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
              Apply Effects
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
