import { useState } from 'react';

const EXAMPLES = [
  'Make it warm and soft',
  'Add vintage film grain',
  'Create a dramatic dark look',
  'Make it dreamy and ethereal',
];

export function NaturalLanguage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ layers: string[] } | null>(null);

  const process = (text: string) => {
    setInput(text);
    setResult({
      layers: ['Brightness +20%', 'Saturation +10%', 'Blur 0.5px'],
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Describe the effect you want:
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Make it warm and vintage with a film grain look"
          style={{
            width: '100%',
            height: '120px',
            padding: '1rem',
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '4px',
            fontFamily: 'inherit',
            marginBottom: '1rem',
            resize: 'vertical',
          }}
        />

        <button
          onClick={() => process(input)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            marginBottom: '1.5rem',
          }}
        >
          Generate Layers
        </button>

        <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Examples:</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => process(example)}
              style={{
                padding: '0.75rem',
                background: '#2a2a3e',
                color: '#ccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.9rem',
              }}
            >
              → {example}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Generated Layers</h3>
        {!result ? (
          <div
            style={{
              padding: '2rem',
              background: '#1a1a2e',
              borderRadius: '4px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            Describe an effect to generate layers
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {result.layers.map((layer, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem',
                  background: '#2a2a3e',
                  borderRadius: '4px',
                  borderLeft: '3px solid #4a9eff',
                }}
              >
                {layer}
              </div>
            ))}
            <button
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: '#4a9eff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Apply Layers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
