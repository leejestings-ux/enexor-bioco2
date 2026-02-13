import { useState, type ReactNode } from 'react';

const C = {
  card: '#0f1729',
  cardBorder: '#1a2744',
  accent: '#22c55e',
  textDim: '#94a3b8',
};

interface AccordionProps {
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function Accordion({ title, icon, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      marginBottom: 6, borderRadius: 6,
      border: `1px solid ${open ? C.cardBorder : 'transparent'}`,
      background: open ? C.card : 'transparent',
      transition: 'all 0.2s',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer',
          color: open ? C.accent : C.textDim, fontSize: 12,
          fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        <span>{icon} {title}</span>
        <span style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', fontSize: 10,
        }}>▼</span>
      </button>
      {open && <div style={{ padding: '2px 10px 10px' }}>{children}</div>}
    </div>
  );
}
