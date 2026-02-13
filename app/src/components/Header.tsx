interface HeaderProps {
  bindingConstraint: string;
}

const C = {
  panelBorder: '#1e293b',
  accent: '#22c55e',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  card: '#0f1729',
  cardBorder: '#1a2744',
  white: '#f8fafc',
  textMuted: '#64748b',
};

export default function Header({ bindingConstraint }: HeaderProps) {
  const constraintColor =
    bindingConstraint === 'regeneration' ? C.amber :
    bindingConstraint === 'cooling' ? C.cyan : C.accent;

  return (
    <div style={{
      borderBottom: `1px solid ${C.panelBorder}`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(10,14,23,1) 100%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg viewBox="0 0 600 600" style={{ width: 28, height: 28, flexShrink: 0 }}>
          <path fill={C.accent} d="M21.6,63.5h100.4c21.4,0,41.9,9,56.4,24.8l179.1,200.7-139.5,152.2c-14.5,15.8-35,24.9-56.5,24.9H60.2s162.8-177,162.8-177L21.6,63.5Z"/>
          <path fill={C.accent} d="M375.2,269.6l145.1-158.3h-100.4c-21.4,0-41.9,9-56.4,24.8l-55,59.8,66.8,73.7Z"/>
          <path fill={C.accent} d="M374.5,309.9l-67.7,73.9,113.7,127.9c14.5,15.8,35,24.9,56.5,24.9h101.4l-203.8-226.6Z"/>
        </svg>
        <div style={{
          borderLeft: `1px solid ${C.panelBorder}`, paddingLeft: 14,
          height: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white, letterSpacing: '0.03em', lineHeight: 1.1 }}>
            BioCO₂ TSA Performance Model
          </div>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
            MCS v2.2 · Enexor BioEnergy
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace",
        background: C.card, padding: '4px 10px', borderRadius: 4,
        border: `1px solid ${C.cardBorder}`,
      }}>
        BINDING: <span style={{ color: constraintColor, fontWeight: 700 }}>
          {bindingConstraint?.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
