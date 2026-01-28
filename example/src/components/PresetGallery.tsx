import { useState } from 'react';

const CATEGORIES = ['All', 'Photography', 'Video', 'Gaming', 'Artistic'];
const PRESETS = [
  { name: 'Golden Hour', category: 'Photography', icon: '📷' },
  { name: 'Sci-Fi Neon', category: 'Gaming', icon: '🌈' },
  { name: 'Vintage Film', category: 'Photography', icon: '📼' },
  { name: 'Motion Blur', category: 'Video', icon: '💨' },
  { name: 'Pixel Art', category: 'Gaming', icon: '🎮' },
];

export function PresetGallery() {
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState('All');

  const filtered = category === 'All' ? PRESETS : PRESETS.filter((p) => p.category === category);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '0.5rem 1rem',
                  background: category === cat ? '#4a9eff' : '#2a2a3e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '1rem',
          }}
        >
          {filtered.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setSelected(preset.name)}
              style={{
                padding: '1.5rem',
                background: selected === preset.name ? '#2a3a5e' : '#2a2a3e',
                border: selected === preset.name ? '2px solid #4a9eff' : '1px solid #333',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{preset.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{preset.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                {preset.category}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 1rem 0' }}>Details</h3>
        {!selected ? (
          <div
            style={{
              padding: '2rem',
              background: '#1a1a2e',
              borderRadius: '4px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            Select a preset
          </div>
        ) : (
          <div style={{ padding: '1.5rem', background: '#1a1a2e', borderRadius: '4px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center' }}>
              {PRESETS.find((p) => p.name === selected)?.icon}
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>{selected}</h4>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
              Professional effect preset for creating stunning visuals
            </p>
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
              Apply Preset
            </button>
            <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#666' }}>
              ✓ Preset applied successfully!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
