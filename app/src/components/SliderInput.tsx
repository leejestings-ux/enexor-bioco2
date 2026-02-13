import { useState } from 'react';

const C = {
  bg: '#0a0e17',
  accent: '#22c55e',
  panelBorder: '#1e293b',
  white: '#f8fafc',
  textDim: '#94a3b8',
  textMuted: '#64748b',
};

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  decimals?: number;
}

export default function SliderInput({ label, value, onChange, min, max, step, unit, decimals = 2 }: SliderInputProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const handleClick = () => {
    setEditing(true);
    setEditVal(String(value));
  };

  const handleBlur = () => {
    setEditing(false);
    const v = parseFloat(editVal);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') setEditing(false);
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.textDim, letterSpacing: '0.02em' }}>{label}</span>
        {editing ? (
          <input
            autoFocus
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKey}
            style={{
              width: 70, background: C.bg, border: `1px solid ${C.accent}`,
              color: C.white, fontSize: 12, padding: '1px 4px', borderRadius: 3,
              textAlign: 'right', outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={handleClick}
            style={{
              fontSize: 12, color: C.white, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              borderBottom: `1px dashed ${C.textMuted}`,
            }}
          >
            {typeof value === 'number' ? value.toFixed(decimals) : value} {unit}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', height: 4,
          background: `linear-gradient(to right, ${C.accent} 0%, ${C.accent} ${pct}%, ${C.panelBorder} ${pct}%, ${C.panelBorder} 100%)`,
          borderRadius: 2, cursor: 'pointer',
        }}
      />
    </div>
  );
}
