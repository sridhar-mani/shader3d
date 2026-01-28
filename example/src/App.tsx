import { useState } from 'react';
import { ShaderPlayground } from './components/ShaderPlayground';
import { LayerEditor } from './components/LayerEditor';
import { PresetGallery } from './components/PresetGallery';
import { PaintEffects } from './components/PaintEffects';
import { NaturalLanguage } from './components/NaturalLanguage';
import { LearnFromExamples } from './components/LearnFromExamples';

type TabId = 'playground' | 'layers' | 'presets' | 'paint' | 'talk' | 'learn';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const tabs: Tab[] = [
  { id: 'playground', label: 'Playground', icon: '🎮', description: 'Write shaders in TypeScript' },
  {
    id: 'layers',
    label: 'Effect Layers',
    icon: '📚',
    description: 'Photoshop-style effect stacking',
  },
  { id: 'presets', label: 'Presets', icon: '✨', description: 'One-click professional effects' },
  {
    id: 'paint',
    label: 'Paint Effects',
    icon: '🎨',
    description: 'Draw gestures to create effects',
  },
  { id: 'talk', label: 'Talk to Me', icon: '💬', description: 'Describe effects in plain English' },
  { id: 'learn', label: 'Show Me', icon: '📷', description: 'Learn from example images' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('playground');

  const renderContent = () => {
    switch (activeTab) {
      case 'playground':
        return <ShaderPlayground />;
      case 'layers':
        return <LayerEditor />;
      case 'presets':
        return <PresetGallery />;
      case 'paint':
        return <PaintEffects />;
      case 'talk':
        return <NaturalLanguage />;
      case 'learn':
        return <LearnFromExamples />;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          <span style={{ color: '#4a9eff' }}>Shader</span>3D
        </h1>
        <span style={{ color: '#666', fontSize: '0.9rem' }}>
          The Progressive Graphics Programming Library
        </span>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '1rem 2rem',
          borderBottom: '1px solid #222',
          overflowX: 'auto',
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.25rem',
              background: activeTab === tab.id ? '#1a1a2e' : 'transparent',
              color: activeTab === tab.id ? '#4a9eff' : '#888',
              border: activeTab === tab.id ? '1px solid #333' : '1px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              fontSize: '0.95rem',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main style={{ padding: '2rem', flex: 1, overflow: 'auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
            {tabs.find((t) => t.id === activeTab)?.icon}{' '}
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
            {tabs.find((t) => t.id === activeTab)?.description}
          </p>
        </div>

        <div style={{ maxWidth: '1400px' }}>{renderContent()}</div>
      </main>

      <footer
        style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid #222',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.85rem',
        }}
      >
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Shader3D</strong> - Write GPU shaders in TypeScript, compile to WGSL for WebGPU
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <a
            href="https://github.com/sridhar-mani/newLang"
            style={{ color: '#4a9eff', textDecoration: 'none' }}
          >
            GitHub
          </a>
          {' • '}
          <a
            href="https://www.npmjs.com/org/shader3d"
            style={{ color: '#4a9eff', textDecoration: 'none' }}
          >
            npm
          </a>
        </p>
      </footer>
    </div>
  );
}
