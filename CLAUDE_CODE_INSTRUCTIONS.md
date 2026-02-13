# BioCO₂ TSA Performance Model — Build Instructions for Claude Code

## Project Overview

Build an interactive React web app implementing the Enexor BioCO₂ TSA Performance Model. This is an engineering parametric design tool with live-updating calculations, charts, and constraint indicators.

## Stack

- **React** (Vite + TypeScript)
- **Tailwind CSS** (dark theme)
- **Recharts** for data visualization
- **Netlify** for deployment
- **GitHub** for version control
- **Supabase** — not needed yet, but structure for future integration (saving design cases)

## Source Files

Two files define the app completely:

1. **MCS_v2_2_TSA_Performance_Model.md** — The computational specification. This defines ALL equations, constraints, algorithm sequence, gas property correlations, and input/output variables. Implement every section exactly as specified. This is the authoritative reference.

2. **bioco2-app.jsx** — A working React prototype artifact. Use this as the UI/UX reference for layout, component structure, interaction patterns, and visual design. The calculation engine in this file already implements MCS v2.2 with the gas-to-gas HX architecture.

## Architecture

```
src/
  components/
    Header.tsx          — Enexor lettermark + title + binding constraint badge
    SliderInput.tsx     — Slider with click-to-edit numeric value
    Accordion.tsx       — Collapsible input group sections
    MetricCard.tsx      — KPI display card (center-aligned, status colors)
    ConstraintBadge.tsx — Green/red constraint status indicators
    ThermalDemand.tsx   — BioCHP thermal demand banner (MJ/cycle, kW avg, % utilization)
    Charts/
      EnergyBreakdown.tsx   — Bar chart of regen energy components
      CycleTiming.tsx       — Horizontal bar chart of phase durations
      IsothermChart.tsx     — Langmuir isotherm with operating point markers
  model/
    engine.ts           — Core TSA model (all MCS v2.2 calculations)
    gasProperties.ts    — Shomate correlations, ideal gas density (Appendix B of MCS)
    constants.ts        — R, M_CO2, M_N2, PI
    types.ts            — Input/output type definitions
  hooks/
    useModel.ts         — useMemo wrapper around engine for live recalculation
  App.tsx               — Main layout: left panel (inputs) + main canvas (results)
```

## Key Design Decisions

### Thermal Architecture (CRITICAL)
- NO hot oil loop. The system uses direct BioCHP exhaust through a gas-to-gas heat exchanger to heat ambient air for regeneration.
- BioCHP exhaust temp is adjustable (200–500°C / 473–773K)
- Q̇_avail is CALCULATED from exhaust energy balance by default, with a toggle to override manually (up to 500 kW)
- Thermal constraint: T_reg ≤ T_exh_biochp − ΔT_approach

### Gas Properties
- Use Shomate equation correlations (Appendix B of MCS) — no CoolProp dependency
- Ideal gas law for densities
- These are accurate to ~1-2% at our operating conditions (near-atmospheric, 300-800K)

### UI Requirements
- Dark theme (bg: #0a0e17, panels: #111827, cards: #0f1729)
- Enexor green (#22c55e) as primary accent
- Amber (#f59e0b) for warnings, Red (#ef4444) for constraint violations
- All metric cards: CENTER-ALIGNED text
- All temperature sliders show °C conversion in label: e.g. "Regeneration Temp (200°C)"
- Sliders support click-on-value to type exact numbers
- Left panel: collapsible accordion sections (Bio-CHP Exhaust, Bed Design, Operating Conditions, Adsorbent Properties)
- Main canvas: KPIs → Thermal Demand banner → Secondary metrics → Constraints → Charts
- Everything recalculates live on slider change

### Enexor Branding
- Lettermark SVG (the "X" icon) in header — render in accent green
- Wordmark SVG in left panel at reduced opacity
- Both are inline SVGs (see bioco2-app.jsx for the path data)

## What to Build First

1. Scaffold the Vite + React + Tailwind project
2. Implement the calculation engine (model/engine.ts) from MCS v2.2
3. Implement gas property correlations (model/gasProperties.ts)
4. Build the UI components following bioco2-app.jsx as reference
5. Wire up live recalculation with useMemo
6. Verify: adjusting BioCHP exhaust temp slider should change Q̇_avail, thermal constraint margin, and capture rate in real time
7. Deploy to Netlify

## Known Calibration Issue

The Langmuir b₀ parameter default (6×10⁻⁷) may produce near-zero working capacity at some operating points. This is expected — it's a sensitivity parameter that needs tuning against zeolite 13X characterization data. The app should handle this gracefully (show 0 or negative values, flag constraints as violated) rather than crashing.

## Validation & Diagnostics

The app must never show raw "Infinity", "-0.00", or "NaN" to the user. Instead:

- **CO₂ Capture Rate ≤ 0** → Show diagnostic: "No working capacity — check isotherm params or T_reg"
- **Specific Energy = Infinity** → Show diagnostic: "No CO₂ captured — cannot compute"  
- **Working Capacity ≤ 0** → Show diagnostic: "No swing — adjust isotherm"
- **Any NaN/Infinity in MetricCard** → Display "—" instead of the raw value

### Constraint Badges
- **Energy Closure**: Show actual MJ delta, not just percentage (e.g., "12.3% gap · Q_in 105.8 MJ vs Q_out 93.5 MJ (Δ 12.3 MJ)")
- **Thermal Feasibility**: Show T_reg vs T_max with margin in K
- **Cooling Constraint**: Show t_cool vs t_cycle

### Contextual Hints (appear below constraints when relevant)
- **Cooling is binding + t_cool >> t_reg**: Suggest minimum cooling flow to match regen time
- **Thermal constraint violated**: Tell user to reduce T_reg or increase BioCHP exhaust temp
- **Working capacity ≤ 0**: Point to b₀, T_reg/T_ads differential, or CO₂ partial pressures
