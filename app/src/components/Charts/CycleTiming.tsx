import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  panel: '#111827',
  panelBorder: '#1e293b',
  accent: '#22c55e',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  textMuted: '#64748b',
};

interface CycleTimingProps {
  t_ads: number;
  t_reg_required: number;
  t_cool_required: number;
}

export default function CycleTiming({ t_ads, t_reg_required, t_cool_required }: CycleTimingProps) {
  const data = [
    { name: 'Adsorption', time: t_ads, fill: C.accent },
    { name: 'Regeneration', time: t_reg_required, fill: C.amber },
    { name: 'Cooling', time: t_cool_required, fill: C.cyan },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Cycle Phase Timing (seconds)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" barSize={22}>
          <XAxis type="number" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} width={90} />
          <Tooltip
            contentStyle={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 6, fontSize: 11 }}
            formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)} s`]}
          />
          <Bar dataKey="time" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
