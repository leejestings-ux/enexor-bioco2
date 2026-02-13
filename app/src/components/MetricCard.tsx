const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  accent: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  textDim: '#94a3b8',
  textMuted: '#64748b',
  white: '#f8fafc',
};

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  status?: 'ok' | 'warn' | 'error';
  small?: boolean;
  diagnostic?: string | null;
}

export default function MetricCard({ label, value, unit, status, small, diagnostic }: MetricCardProps) {
  const statusColor = status === 'ok' ? C.accent : status === 'warn' ? C.amber : status === 'error' ? C.red : C.textDim;

  let displayValue: string;
  if (diagnostic) {
    displayValue = '';
  } else if (value === Infinity || value === -Infinity || isNaN(value)) {
    displayValue = '\u2014';
  } else {
    displayValue = value >= 1000 ? value.toFixed(0) : value >= 100 ? value.toFixed(1) : value.toFixed(2);
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${status ? statusColor + '44' : C.cardBorder}`,
      borderRadius: 8, padding: small ? '10px 12px' : '14px 16px',
      position: 'relative', overflow: 'hidden', textAlign: 'center',
    }}>
      {status && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: statusColor }} />}
      <div style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {diagnostic ? (
        <div style={{ fontSize: 11, color: C.red, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4, padding: '2px 0' }}>
          {diagnostic}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
          <span style={{
            fontSize: small ? 20 : 28, fontWeight: 700,
            color: status === 'error' ? C.red : C.white,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            {displayValue}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{unit}</span>
        </div>
      )}
    </div>
  );
}
