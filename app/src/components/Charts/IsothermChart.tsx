import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, ReferenceDot,
} from 'recharts';

const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  panel: '#111827',
  panelBorder: '#1e293b',
  accent: '#22c55e',
  amber: '#f59e0b',
  white: '#f8fafc',
  textMuted: '#64748b',
};

interface IsothermChartProps {
  langmuir: (T: number, P_CO2_pa: number) => number;
  T_ads: number;
  T_reg: number;
  q_ads: number;
  q_reg: number;
  P_CO2_ads: number;
  P_CO2_reg: number;
}

export default function IsothermChart({ langmuir, T_ads, T_reg, q_ads, q_reg, P_CO2_ads, P_CO2_reg }: IsothermChartProps) {
  const data = useMemo(() => {
    const pts = [];
    for (let p = 0; p <= 30; p += 0.5) {
      const P_pa = p * 1000;
      pts.push({
        P_kPa: p,
        q_ads_T: langmuir(T_ads, P_pa),
        q_reg_T: langmuir(T_reg, P_pa),
      });
    }
    return pts;
  }, [langmuir, T_ads, T_reg]);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Langmuir Isotherm · Working Capacity Window
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.panelBorder} />
          <XAxis
            dataKey="P_kPa"
            tick={{ fontSize: 10, fill: C.textMuted }}
            axisLine={false} tickLine={false}
            label={{ value: 'P_CO₂ (kPa)', position: 'insideBottom', offset: -2, style: { fontSize: 10, fill: C.textMuted } }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: C.textMuted }}
            axisLine={false} tickLine={false}
            label={{ value: 'q (mol/kg)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: C.textMuted } }}
          />
          <Tooltip
            contentStyle={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 6, fontSize: 11 }}
            formatter={(v: number | undefined, name?: string) => [
              `${(v ?? 0).toFixed(2)} mol/kg`,
              name === 'q_ads_T' ? `T_ads = ${T_ads}K` : `T_reg = ${T_reg}K`,
            ]}
          />
          <Line type="monotone" dataKey="q_ads_T" stroke={C.accent} strokeWidth={2} dot={false} name="T_ads" />
          <Line type="monotone" dataKey="q_reg_T" stroke={C.amber} strokeWidth={2} dot={false} name="T_reg" />
          <ReferenceLine x={P_CO2_ads / 1000} stroke={C.accent} strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine x={P_CO2_reg / 1000} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceDot x={P_CO2_ads / 1000} y={q_ads} r={5} fill={C.accent} stroke={C.white} strokeWidth={1} />
          <ReferenceDot x={P_CO2_reg / 1000} y={q_reg} r={5} fill={C.amber} stroke={C.white} strokeWidth={1} />
          <Legend wrapperStyle={{ fontSize: 10, color: C.textMuted }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
