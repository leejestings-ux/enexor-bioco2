import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  panel: '#111827',
  panelBorder: '#1e293b',
  textMuted: '#64748b',
};

const ENERGY_COLORS = ['#22c55e', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'];

interface EnergyBreakdownProps {
  Q_zeolite: number;
  Q_steel: number;
  Q_des: number;
  Q_purge: number;
  Q_losses: number;
}

export default function EnergyBreakdown({ Q_zeolite, Q_steel, Q_des, Q_purge, Q_losses }: EnergyBreakdownProps) {
  const data = [
    { name: 'Zeolite', value: Q_zeolite / 1e6, fill: ENERGY_COLORS[0] },
    { name: 'Steel', value: Q_steel / 1e6, fill: ENERGY_COLORS[1] },
    { name: 'Desorption', value: Q_des / 1e6, fill: ENERGY_COLORS[2] },
    { name: 'Purge', value: Q_purge / 1e6, fill: ENERGY_COLORS[3] },
    { name: 'Losses', value: Q_losses / 1e6, fill: ENERGY_COLORS[4] },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Regeneration Energy Breakdown (MJ)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 6, fontSize: 11 }}
            formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} MJ`]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
