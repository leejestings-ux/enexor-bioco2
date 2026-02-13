const C = {
  accent: '#22c55e',
  accentDim: '#166534',
  red: '#ef4444',
  redDim: '#991b1b',
  textMuted: '#64748b',
};

interface ConstraintBadgeProps {
  label: string;
  ok: boolean;
  detail: string;
}

export default function ConstraintBadge({ label, ok, detail }: ConstraintBadgeProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
      background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? C.accentDim : C.redDim}`,
      borderRadius: 6, marginBottom: 4,
    }}>
      <span style={{ fontSize: 14 }}>{ok ? '\u2713' : '\u2715'}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: ok ? C.accent : C.red }}>{label}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{detail}</div>
      </div>
    </div>
  );
}
