export interface ShaderOption {
  id: string
  name: string
  description: string
  level: number
  shader: string
}

interface ShaderSelectorProps {
  options: ShaderOption[]
  selected: string
  onSelect: (id: string) => void
}

const LEVEL_COLORS: Record<number, string> = {
  0: '#4ecdc4',
  1: '#45b7d1',
  2: '#96ceb4',
  3: '#ff6b6b'
}

export function ShaderSelector({ options, selected, onSelect }: ShaderSelectorProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginBottom: 20
    }}>
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          style={{
            padding: '12px 20px',
            border: selected === option.id ? '2px solid #fff' : '2px solid transparent',
            borderRadius: 8,
            background: selected === option.id 
              ? 'rgba(255,255,255,0.15)' 
              : 'rgba(255,255,255,0.05)',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'left'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 4
          }}>
            <span style={{ fontWeight: 600 }}>{option.name}</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: 4,
              background: LEVEL_COLORS[option.level as keyof typeof LEVEL_COLORS],
              color: '#000'
            }}>
              L{option.level}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {option.description}
          </div>
        </button>
      ))}
    </div>
  )
}

export default ShaderSelector
