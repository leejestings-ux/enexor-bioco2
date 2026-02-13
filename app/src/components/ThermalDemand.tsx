const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  panelBorder: '#1e293b',
  accent: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  white: '#f8fafc',
  textDim: '#94a3b8',
  textMuted: '#64748b',
};

interface ThermalDemandProps {
  Q_total: number;
  Q_thermal_hourly_kW: number;
  Q_dot_avail: number;
}

export default function ThermalDemand({ Q_total, Q_thermal_hourly_kW, Q_dot_avail }: ThermalDemandProps) {
  const utilPct = Q_dot_avail > 0 ? (Q_thermal_hourly_kW / Q_dot_avail) * 100 : 0;
  const utilColor = utilPct <= 75 ? C.accent : utilPct <= 95 ? C.amber : C.red;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, rgba(245,158,11,0.06) 100%)`,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 8, padding: '12px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 9, color: C.amber, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
          ⚡ BioCHP Thermal Demand
        </div>
        <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5 }}>
          Energy required from exhaust gas-to-gas HX to sustain regeneration cycles
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.white, fontFamily: "'JetBrains Mono', monospace" }}>
            {(Q_total / 1e6).toFixed(2)}
          </div>
          <div style={{ fontSize: 9, color: C.textMuted }}>MJ / cycle</div>
        </div>
        <div style={{ width: 1, height: 32, background: C.panelBorder }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.white, fontFamily: "'JetBrains Mono', monospace" }}>
            {Q_thermal_hourly_kW.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: C.textMuted }}>kW avg</div>
        </div>
        <div style={{ width: 1, height: 32, background: C.panelBorder }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: utilColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {utilPct.toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, color: C.textMuted }}>of Q̇ avail</div>
        </div>
      </div>
    </div>
  );
}
