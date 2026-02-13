import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine, ReferenceDot, CartesianGrid, Legend, PieChart, Pie } from "recharts";

// ─── Gas Property Correlations (replacing CoolProp) ───
// Shomate equation coefficients (NIST) for 298-1200K
const SHOMATE = {
  CO2: { A: 24.99735, B: 55.18696, C: -33.69137, D: 7.948387, E: -0.136638 },
  N2:  { A: 28.98641, B: 1.853978, C: -9.647459, D: 16.63537, E: 0.000117 },
};

function shomate_cp(T, species) {
  const c = SHOMATE[species];
  const t = T / 1000;
  return c.A + c.B * t + c.C * t * t + c.D * t * t * t + c.E / (t * t);
}

function cp_mix(T, y_CO2) {
  return y_CO2 * shomate_cp(T, "CO2") + (1 - y_CO2) * shomate_cp(T, "N2");
}

const R = 8.314;
const M_CO2 = 0.04401;
const M_N2 = 0.02802;
const PI = Math.PI;

function idealGasDensity(T, P, M) {
  return (P * M) / (R * T);
}

// ─── Core TSA Model ───
function runModel(inputs) {
  const {
    m_dot_exh, y_CO2, T_exh_biochp, P_exh, T_ambient, DeltaT_approach,
    use_Q_override, Q_dot_manual,
    N_bed, m_ads, rho_bulk, d_p, epsilon, L_over_D, t_wall, rho_steel,
    T_ads, T_reg, y_CO2_reg, m_dot_purge, m_dot_cool, eta_blower,
    Cp_ads, Cp_steel, f_loss, q_m, DeltaH_ads, b0, f_moisture,
    T_cool_in, Cp_cool
  } = inputs;

  const warnings = [];
  const constraints = {};

  // ─── Gas-to-Gas HX Thermal Architecture ───
  // BioCHP exhaust (T_exh_biochp) → HX hot side → cooled exhaust (T_exh_post_HX) → TSA beds
  // Ambient air (T_ambient) → HX cold side → heated regen air (T_regen_air) → regen sweep
  
  const T_regen_air_max = T_exh_biochp - DeltaT_approach; // Max achievable regen air temp
  const T_exh = T_ads + 30; // Post-HX exhaust entering TSA beds ≈ slightly above T_ads
  
  // Exhaust-side Cp for HX energy balance
  const M_mix = y_CO2 * M_CO2 + (1 - y_CO2) * M_N2;
  const Cp_exh_avg_mol = cp_mix((T_exh_biochp + T_exh) / 2, y_CO2); // J/(mol·K)
  const Cp_exh_avg = Cp_exh_avg_mol / M_mix; // J/(kg·K)
  
  // Available thermal power from exhaust through HX
  const Q_dot_calc = m_dot_exh * Cp_exh_avg * (T_exh_biochp - T_exh) / 1000; // kW
  const Q_dot_avail = use_Q_override ? Q_dot_manual : Q_dot_calc;

  // §4 Geometry
  const V_bed = m_ads / rho_bulk;
  const D = Math.pow(4 * V_bed / (PI * L_over_D), 1 / 3);
  const L = D * L_over_D;
  const A_cross = PI * D * D / 4;
  const V_steel = PI * D * L * t_wall;
  const m_steel = V_steel * rho_steel;

  // §5 CO₂ Mass Flow
  const rho_CO2 = idealGasDensity(T_exh, P_exh, M_CO2);
  const rho_N2 = idealGasDensity(T_exh, P_exh, M_N2);
  const m_dot_CO2 = m_dot_exh * (y_CO2 * rho_CO2) / (y_CO2 * rho_CO2 + (1 - y_CO2) * rho_N2);

  // §6 Adsorption Thermodynamics — Langmuir
  const DeltaH_J = DeltaH_ads * 1000; // kJ/mol → J/mol
  const q_m_kg = q_m / 1000; // mmol/g → mol/g... actually q_m is in mmol/g

  function langmuir(T, P_CO2_pa) {
    const P_CO2_kpa = P_CO2_pa / 1000;
    const b_T = b0 * Math.exp(-DeltaH_J / (R * T));
    const q = (q_m * b_T * P_CO2_kpa) / (1 + b_T * P_CO2_kpa);
    return q; // mmol/g
  }

  const P_CO2_ads = y_CO2 * P_exh;
  const P_CO2_reg = y_CO2_reg * P_exh;
  const q_ads = langmuir(T_ads, P_CO2_ads);
  const q_reg = langmuir(T_reg, P_CO2_reg);
  const Delta_q_raw = q_ads - q_reg; // mmol/g
  const Delta_q = Delta_q_raw * f_moisture;
  const m_CO2_bed = m_ads * Delta_q * M_CO2; // kg — mmol/g * kg * kg/mol... need unit fix
  // Delta_q is mmol/g = mol/kg, so m_ads(kg) * Delta_q(mol/kg) = moles, * M_CO2 = kg
  const m_CO2_bed_kg = m_ads * (Delta_q / 1000) * M_CO2; // Delta_q mmol/g = mol/kg... 
  // Actually: mmol/g = 1e-3 mol / 1e-3 kg = mol/kg. So Delta_q in mol/kg already.
  const n_CO2_mol = m_ads * Delta_q; // mol (since Delta_q = mmol/g = mol/kg, * kg = mol)... 
  // Wait: q_m = 5.5 mmol/g. 1 mmol/g = 1 mol/kg. So q is in mol/kg.
  // n_CO2 = m_ads(kg) * Delta_q(mol/kg) = mol
  const n_CO2 = m_ads * Delta_q; // actually this gives mol since mmol/g = mol/kg
  // Hmm let me be precise: 5.5 mmol/g = 5.5e-3 mol / 1e-3 kg = 5.5 mol/kg. So yes, mol/kg.
  const m_CO2_bed_final = n_CO2 * M_CO2; // kg per bed per cycle

  // §7 Regeneration Energy
  const DeltaT_reg = T_reg - T_ads;
  const Cp_purge_ads = cp_mix(T_ads, y_CO2); // J/(mol·K)
  const Cp_purge_reg = cp_mix(T_reg, y_CO2);
  const Cp_purge_avg = ((Cp_purge_ads + Cp_purge_reg) / 2) / M_mix; // J/(kg·K)

  const Q_purge = m_dot_purge * Cp_purge_avg * DeltaT_reg; // W (J/s) — this is power not energy
  // MCS says Q_purge = m_dot_purge * Cp_avg * DeltaT_reg — this is a rate * temp = W
  // But then Q_total is summed with Q_zeolite which is J. There's a unit issue in the MCS.
  // Interpreting: Q_purge in the MCS is energy per cycle, meaning m_dot_purge flows for t_reg.
  // So we need to solve iteratively or treat Q_purge as the continuous heating load.
  // For the model: Q_zeolite, Q_steel, Q_des are energies (J). Q_purge should also be energy.
  // We'll compute Q_purge_rate and handle timing in the thermal constraint.
  
  // Let's follow MCS literally — Q_purge appears to be a rate contribution but let's 
  // compute everything as total energy for the cycle, with purge flowing during regen time.
  
  const Q_zeolite = m_ads * Cp_ads * DeltaT_reg; // J
  const Q_steel = m_steel * Cp_steel * DeltaT_reg; // J
  const Q_des = n_CO2 * DeltaH_J; // J
  
  // For Q_purge: need regen time, but regen time depends on Q_total. Bootstrap:
  // Compute Q_total_no_purge first, get initial t_reg, then add purge energy
  const Q_core = Q_zeolite + Q_steel + Q_des;
  const Q_core_with_loss = Q_core * (1 + f_loss);
  const t_reg_initial = Q_core_with_loss / (Q_dot_avail * 1000);
  
  const Q_purge_energy = m_dot_purge * Cp_purge_avg * DeltaT_reg * t_reg_initial;
  const Q_subtotal = Q_zeolite + Q_steel + Q_des + Q_purge_energy;
  const Q_losses = f_loss * Q_subtotal;
  const Q_total = Q_subtotal + Q_losses;

  // §7.6 Thermal Constraint
  const t_reg_required = Q_total / (Q_dot_avail * 1000);
  const thermal_feasible = T_reg <= T_regen_air_max;
  constraints.thermal = {
    ok: thermal_feasible,
    T_reg,
    T_max: T_regen_air_max,
    margin: T_regen_air_max - T_reg,
  };

  // §8 Cooling
  const Q_cool = (m_ads * Cp_ads + m_steel * Cp_steel) * DeltaT_reg;
  const T_bed_avg = (T_reg + T_ads) / 2;
  const Q_dot_cool = m_dot_cool * Cp_cool * (T_bed_avg - T_cool_in);
  const t_cool_required = Q_dot_cool > 0 ? Q_cool / Q_dot_cool : Infinity;

  // §9 Pressure Drop
  const rho_exh = idealGasDensity(T_exh, P_exh, M_mix);
  const volumetric_flow = m_dot_exh / rho_exh;
  const v_sup = volumetric_flow / A_cross;
  const mu = 1.8e-5; // dynamic viscosity of exhaust ~N2 at ~350K, Pa·s
  const dP_over_L =
    (150 * Math.pow(1 - epsilon, 2) * mu * v_sup) / (Math.pow(epsilon, 3) * d_p * d_p) +
    (1.75 * (1 - epsilon) * rho_exh * v_sup * v_sup) / (Math.pow(epsilon, 3) * d_p);
  const DeltaP = dP_over_L * L;

  // §10 Blower
  const W_blower = (DeltaP * volumetric_flow) / eta_blower;

  // §11 Cycle Timing
  // t_ads: time to saturate bed. Approximate: m_CO2_bed / m_dot_CO2 per bed
  const t_ads = m_CO2_bed_final / (m_dot_CO2 / N_bed);
  const t_cycle_effective = Math.max(t_ads, t_reg_required, t_cool_required);
  
  let binding_constraint = "adsorption";
  if (t_cycle_effective === t_reg_required) binding_constraint = "regeneration";
  if (t_cycle_effective === t_cool_required) binding_constraint = "cooling";

  // §12 Capture Rate
  const CO2_per_hour = m_CO2_bed_final * N_bed * (3600 / t_cycle_effective);
  const CO2_tpd = (CO2_per_hour * 24) / 1000;
  const CO2_tph = CO2_per_hour / 1000;

  // §13 Specific Energy
  const Thermal_kWh = Q_total / 3.6e6;
  const cycles_per_hour = 3600 / t_cycle_effective;
  const Thermal_kWh_hr = Thermal_kWh * cycles_per_hour;
  const Electrical_kW = W_blower / 1000;
  const E_total_kWh_hr = Thermal_kWh_hr + Electrical_kW;
  const kWh_per_ton = CO2_tph > 0 ? E_total_kWh_hr / CO2_tph : Infinity;

  // §14 Closure (simplified — check energy balance)
  const Q_in = Q_total;
  const Q_out = Q_des + Q_cool; // energy used for desorption + removed in cooling
  const energy_closure = Q_in > 0 ? Math.abs(Q_in - Q_out) / Q_in : 0;

  constraints.cooling = {
    ok: t_cool_required <= t_cycle_effective,
    t_cool: t_cool_required,
    t_available: t_cycle_effective,
  };

  return {
    // Geometry
    V_bed, D, L, A_cross, m_steel,
    // Thermodynamics  
    q_ads, q_reg, Delta_q, n_CO2, m_CO2_bed: m_CO2_bed_final,
    // Energy breakdown
    Q_zeolite, Q_steel, Q_des, Q_purge: Q_purge_energy, Q_losses, Q_total, Q_cool,
    // Timing
    t_ads, t_reg_required, t_cool_required, t_cycle_effective, binding_constraint,
    cycles_per_hour,
    // Performance
    CO2_per_hour, CO2_tpd, CO2_tph,
    Thermal_kWh, Electrical_kW, E_total_kWh_hr, kWh_per_ton,
    // Pressure drop & blower
    DeltaP, v_sup, W_blower,
    // Constraints
    constraints, thermal_feasible,
    // Flow
    m_dot_CO2, volumetric_flow, rho_exh,
    // Thermal architecture
    Q_dot_calc, Q_dot_avail, T_regen_air_max, T_exh,
    // BioCHP thermal demand
    Q_thermal_per_cycle: Q_total,
    Q_dot_demand: Q_total / t_reg_required / 1000, // kW demanded during regen
    Q_thermal_hourly_kW: Thermal_kWh_hr, // kWh/hr = kW average
    // Closure
    energy_closure,
    // Isotherm data for chart
    langmuir,
    P_CO2_ads, P_CO2_reg,
  };
}

// ─── UI Components ───

const COLORS = {
  bg: "#0a0e17",
  panel: "#111827",
  panelBorder: "#1e293b",
  card: "#0f1729",
  cardBorder: "#1a2744",
  accent: "#22c55e",
  accentDim: "#166534",
  accentGlow: "rgba(34,197,94,0.15)",
  amber: "#f59e0b",
  amberDim: "#92400e",
  red: "#ef4444",
  redDim: "#991b1b",
  cyan: "#06b6d4",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  white: "#f8fafc",
};

const ENERGY_COLORS = ["#22c55e", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"];

function SliderInput({ label, value, onChange, min, max, step, unit, decimals = 2 }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const handleClick = () => {
    setEditing(true);
    setEditVal(String(value));
  };

  const handleBlur = () => {
    setEditing(false);
    const v = parseFloat(editVal);
    if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") setEditing(false);
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: "0.02em" }}>{label}</span>
        {editing ? (
          <input
            autoFocus
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKey}
            style={{
              width: 70, background: COLORS.bg, border: `1px solid ${COLORS.accent}`,
              color: COLORS.white, fontSize: 12, padding: "1px 4px", borderRadius: 3,
              textAlign: "right", outline: "none",
            }}
          />
        ) : (
          <span
            onClick={handleClick}
            style={{
              fontSize: 12, color: COLORS.white, cursor: "pointer",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              borderBottom: `1px dashed ${COLORS.textMuted}`,
            }}
          >
            {typeof value === "number" ? value.toFixed(decimals) : value} {unit}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 4, appearance: "none", outline: "none",
          background: `linear-gradient(to right, ${COLORS.accent} 0%, ${COLORS.accent} ${pct}%, ${COLORS.panelBorder} ${pct}%, ${COLORS.panelBorder} 100%)`,
          borderRadius: 2, cursor: "pointer",
        }}
      />
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false, icon }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      marginBottom: 6,
      borderRadius: 6,
      border: `1px solid ${open ? COLORS.cardBorder : "transparent"}`,
      background: open ? COLORS.card : "transparent",
      transition: "all 0.2s",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", background: "none", border: "none", cursor: "pointer",
          color: open ? COLORS.accent : COLORS.textDim, fontSize: 12,
          fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        }}
      >
        <span>{icon} {title}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", fontSize: 10 }}>▼</span>
      </button>
      {open && <div style={{ padding: "2px 10px 10px" }}>{children}</div>}
    </div>
  );
}

function MetricCard({ label, value, unit, status, small, diagnostic }) {
  const statusColor = status === "ok" ? COLORS.accent : status === "warn" ? COLORS.amber : status === "error" ? COLORS.red : COLORS.textDim;
  
  // Format value with validation
  let displayValue;
  if (diagnostic) {
    displayValue = null; // will show diagnostic instead
  } else if (value === Infinity || value === -Infinity) {
    displayValue = "—";
  } else if (isNaN(value)) {
    displayValue = "—";
  } else if (typeof value === "number") {
    displayValue = value >= 1000 ? value.toFixed(0) : value >= 100 ? value.toFixed(1) : value.toFixed(2);
  } else {
    displayValue = value;
  }

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${status ? statusColor + "44" : COLORS.cardBorder}`,
      borderRadius: 8, padding: small ? "10px 12px" : "14px 16px",
      position: "relative", overflow: "hidden", textAlign: "center",
    }}>
      {status && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: statusColor }} />}
      <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {diagnostic ? (
        <div style={{ fontSize: 11, color: COLORS.red, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4, padding: "2px 0" }}>
          {diagnostic}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
          <span style={{
            fontSize: small ? 20 : 28, fontWeight: 700, color: status === "error" ? COLORS.red : COLORS.white,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            {displayValue}
          </span>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{unit}</span>
        </div>
      )}
    </div>
  );
}

function ConstraintBadge({ label, ok, detail }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
      background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
      border: `1px solid ${ok ? COLORS.accentDim : COLORS.redDim}`,
      borderRadius: 6, marginBottom: 4,
    }}>
      <span style={{ fontSize: 14 }}>{ok ? "✓" : "✕"}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: ok ? COLORS.accent : COLORS.red }}>{label}</div>
        <div style={{ fontSize: 10, color: COLORS.textMuted }}>{detail}</div>
      </div>
    </div>
  );
}

// ─── Main App ───
export default function BioCO2App() {
  const [inputs, setInputs] = useState({
    // Bio-CHP Boundary
    m_dot_exh: 0.85,
    y_CO2: 0.12,
    T_exh_biochp: 773,       // Raw BioCHP exhaust temp (K) — before HX
    P_exh: 101325,
    T_ambient: 303,           // Ambient air inlet to HX cold side (K)
    DeltaT_approach: 15,      // HX minimum approach ΔT (K)
    Q_dot_override: null,     // null = calculate from HX energy balance; number = manual kW
    Q_dot_manual: 120,        // manual override value (kW)
    use_Q_override: false,    // toggle
    // TSA System
    N_bed: 4,
    m_ads: 500,
    rho_bulk: 650,
    d_p: 0.003,
    epsilon: 0.37,
    L_over_D: 2.5,
    t_wall: 0.006,
    rho_steel: 7850,
    T_ads: 323,
    T_reg: 473,
    y_CO2_reg: 0.90,
    m_dot_purge: 0.05,
    m_dot_cool: 0.15,
    eta_blower: 0.72,
    Cp_ads: 920,
    Cp_steel: 500,
    f_loss: 0.10,
    // Isotherm
    q_m: 5.5,
    DeltaH_ads: 38,
    b0: 6.0e-7,
    f_moisture: 0.85,
    // Cooling
    T_cool_in: 303,
    Cp_cool: 1010,
  });

  const set = useCallback((key) => (val) => setInputs((prev) => ({ ...prev, [key]: val })), []);

  const results = useMemo(() => {
    try {
      return runModel(inputs);
    } catch (e) {
      return { error: e.message };
    }
  }, [inputs]);

  // Chart data
  const energyData = results.error ? [] : [
    { name: "Zeolite", value: results.Q_zeolite / 1e6, fill: ENERGY_COLORS[0] },
    { name: "Steel", value: results.Q_steel / 1e6, fill: ENERGY_COLORS[1] },
    { name: "Desorption", value: results.Q_des / 1e6, fill: ENERGY_COLORS[2] },
    { name: "Purge", value: results.Q_purge / 1e6, fill: ENERGY_COLORS[3] },
    { name: "Losses", value: results.Q_losses / 1e6, fill: ENERGY_COLORS[4] },
  ];

  const cycleData = results.error ? [] : [
    { name: "Adsorption", time: results.t_ads, fill: COLORS.accent },
    { name: "Regeneration", time: results.t_reg_required, fill: COLORS.amber },
    { name: "Cooling", time: results.t_cool_required, fill: COLORS.cyan },
  ];

  // Isotherm curve data
  const isothermData = useMemo(() => {
    if (results.error || !results.langmuir) return [];
    const data = [];
    for (let p = 0; p <= 30; p += 0.5) {
      const P_pa = p * 1000;
      data.push({
        P_kPa: p,
        q_ads_T: results.langmuir(inputs.T_ads, P_pa),
        q_reg_T: results.langmuir(inputs.T_reg, P_pa),
      });
    }
    return data;
  }, [results.langmuir, inputs.T_ads, inputs.T_reg]);

  if (results.error) {
    return <div style={{ padding: 40, color: COLORS.red, background: COLORS.bg, minHeight: "100vh" }}>
      <h2>Model Error</h2><p>{results.error}</p>
    </div>;
  }

  return (
    <div style={{
      background: COLORS.bg, color: COLORS.text, minHeight: "100vh",
      fontFamily: "'IBM Plex Sans', 'SF Pro Display', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${COLORS.panelBorder}`,
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(180deg, rgba(17,24,39,0.95) 0%, rgba(10,14,23,1) 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Enexor Lettermark */}
          <svg viewBox="0 0 600 600" style={{ width: 28, height: 28, flexShrink: 0 }}>
            <path fill={COLORS.accent} d="M21.6,63.5h100.4c21.4,0,41.9,9,56.4,24.8l179.1,200.7-139.5,152.2c-14.5,15.8-35,24.9-56.5,24.9H60.2s162.8-177,162.8-177L21.6,63.5Z"/>
            <path fill={COLORS.accent} d="M375.2,269.6l145.1-158.3h-100.4c-21.4,0-41.9,9-56.4,24.8l-55,59.8,66.8,73.7Z"/>
            <path fill={COLORS.accent} d="M374.5,309.9l-67.7,73.9,113.7,127.9c14.5,15.8,35,24.9,56.5,24.9h101.4l-203.8-226.6Z"/>
          </svg>
          <div style={{ borderLeft: `1px solid ${COLORS.panelBorder}`, paddingLeft: 14, height: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, letterSpacing: "0.03em", lineHeight: 1.1 }}>
              BioCO₂ TSA Performance Model
            </div>
            <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
              MCS v2.1 · Enexor BioEnergy
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace",
          background: COLORS.card, padding: "4px 10px", borderRadius: 4,
          border: `1px solid ${COLORS.cardBorder}`,
        }}>
          BINDING: <span style={{ color: results.binding_constraint === "regeneration" ? COLORS.amber : results.binding_constraint === "cooling" ? COLORS.cyan : COLORS.accent, fontWeight: 700 }}>
            {results.binding_constraint?.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* ─── Left Panel: Inputs ─── */}
        <div style={{
          width: 280, minWidth: 280, borderRight: `1px solid ${COLORS.panelBorder}`,
          background: COLORS.panel, overflowY: "auto", padding: "8px 10px",
        }}>
          {/* Enexor Wordmark */}
          <div style={{ padding: "8px 4px 6px", marginBottom: 4, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
            <svg viewBox="0 0 1000 200" style={{ width: 100, height: 20, opacity: 0.35 }}>
              <g>
                <g>
                  <path fill="#fff" d="M172.3,47v24.1h-84.6v18.1h79v21h-79v18.7h84.6v24H55.9V47h116.4Z"/>
                  <path fill="#fff" d="M288.2,153l-62.8-79.6v79.6h-29.9V47h50.6l62.9,79.4V47h29.9v106h-50.6Z"/>
                  <path fill="#fff" d="M482.5,47v24.1h-84.6v18.1h79v21h-79v18.7h84.6v24h-116.4V47h116.4Z"/>
                  <path fill="#fff" d="M716.5,45.9l25.3.2c18.6,0,31.3,3.1,38.1,9.4,6.8,6.2,10.2,18.7,10.2,37.5v5.1c0,22-2.7,36.8-8.1,44.2-5.4,7.5-19.1,11.2-41.1,11.2l-23.9.5-10,.2-21.6-.8c-12.1,0-21.4-2.8-28-8.3-6.6-5.6-9.9-14.5-9.9-26.9l-.3-19.5c0-21.5,2.7-35.6,8.1-42.2,5.4-6.6,18.3-9.9,38.6-9.9l22.5-.5ZM699.3,127.7l17.1.3,16.3-.2c9,0,15.4-1,19.3-2.9,3.9-2,5.9-6.8,5.9-14.6l.3-14.3c0-4.9-.3-9.1-.9-12.5-.6-3.5-1.7-6-3.5-7.6-1.8-1.6-4.4-2.7-7.9-3.3-3.5-.5-7.2-.8-11.2-.8l-31.6.2c-7.2,0-12.7.7-16.4,2.2-3.8,1.5-5.9,4.6-6.5,9.5-.6,4.8-.9,8.8-.9,12v7.2c0,9.8,1.1,16.4,3.4,19.8,2.2,3.4,7.8,5.1,16.7,5.1Z"/>
                </g>
                <path fill="#fff" d="M940.2,101.6c1.6-2.5,2.6-5.4,3.1-8.8.5-3.4.8-7.5.8-12.2,0-12.5-2.7-21.2-8.1-26.1-5.4-4.9-14.3-7.4-26.8-7.4h-97.2v106h31.8v-80.2h52.9c1.9,0,3.5,0,4.9.2,1.4.1,3.1.5,5.2,1.1,2.1.6,3.5,1.8,4.2,3.5.7,1.7,1,4.3,1,7.8,0,6.2-.9,10.3-2.7,12.1-1.8,1.8-6.3,2.7-13.5,2.7h-31.7v25.7h32.6c7.4,0,11.5,1.5,12.4,4.6.9,3.1,1.3,7.2,1.3,12.4v10.2h32.2v-20.3c0-7-1.7-11.9-5.2-14.7-3.4-2.8-8.8-4.7-16.1-5.6,6.7-2.2,11.1-3.9,13.1-5.2,2.1-1.2,3.9-3.1,5.5-5.6Z"/>
              </g>
              <g>
                <path fill="#fff" d="M482.8,25.6h31.6c6.7,0,13.2,2.8,17.7,7.8l56.3,63.1-43.8,47.8c-4.6,5-11,7.8-17.8,7.8h-31.9s51.2-55.7,51.2-55.7l-63.3-70.9Z"/>
                <path fill="#fff" d="M594,90.5l45.6-49.8h-31.6c-6.7,0-13.2,2.8-17.7,7.8l-17.3,18.8,21,23.2Z"/>
                <path fill="#fff" d="M593.8,103.1l-21.3,23.2,35.7,40.2c4.6,5,11,7.8,17.8,7.8h31.9l-64.1-71.3Z"/>
              </g>
            </svg>
          </div>
          <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 0 4px", fontWeight: 600 }}>
            SYSTEM INPUTS
          </div>

          <Accordion title="Bio-CHP Exhaust" icon="⚡" defaultOpen={true}>
            <SliderInput label={`BioCHP Exhaust Temp (${(inputs.T_exh_biochp - 273.15).toFixed(0)}°C)`} value={inputs.T_exh_biochp} onChange={set("T_exh_biochp")} min={473} max={773} step={5} unit="K" decimals={0} />
            <SliderInput label="Exhaust Mass Flow" value={inputs.m_dot_exh} onChange={set("m_dot_exh")} min={0.1} max={3.0} step={0.01} unit="kg/s" />
            <SliderInput label="CO₂ Fraction" value={inputs.y_CO2} onChange={set("y_CO2")} min={0.04} max={0.20} step={0.01} unit="vol" />
            <SliderInput label="Exhaust Pressure" value={inputs.P_exh} onChange={set("P_exh")} min={95000} max={110000} step={100} unit="Pa" decimals={0} />
            <SliderInput label={`Ambient Air Temp (${(inputs.T_ambient - 273.15).toFixed(0)}°C)`} value={inputs.T_ambient} onChange={set("T_ambient")} min={273} max={323} step={1} unit="K" decimals={0} />
            <SliderInput label="HX Approach ΔT" value={inputs.DeltaT_approach} onChange={set("DeltaT_approach")} min={5} max={50} step={1} unit="K" decimals={0} />
            
            {/* Q_dot override toggle */}
            <div style={{ marginTop: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <button
                  onClick={() => set("use_Q_override")(!inputs.use_Q_override)}
                  style={{
                    width: 36, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                    background: inputs.use_Q_override ? COLORS.accent : COLORS.panelBorder,
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: COLORS.white,
                    position: "absolute", top: 2,
                    left: inputs.use_Q_override ? 20 : 2,
                    transition: "left 0.2s",
                  }} />
                </button>
                <span style={{ fontSize: 10, color: inputs.use_Q_override ? COLORS.accent : COLORS.textMuted }}>
                  Override Q̇ thermal
                </span>
              </div>
              {inputs.use_Q_override && (
                <SliderInput label="Q̇ Override" value={inputs.Q_dot_manual} onChange={set("Q_dot_manual")} min={10} max={500} step={5} unit="kW" decimals={0} />

              )}
              <div style={{
                fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace",
                background: COLORS.bg, borderRadius: 4, padding: "4px 8px", marginTop: 4,
                border: `1px solid ${COLORS.cardBorder}`,
              }}>
                Q̇ avail: <span style={{ color: COLORS.accent }}>{results.Q_dot_avail?.toFixed(1) ?? "—"} kW</span>
                {!inputs.use_Q_override && <span style={{ color: COLORS.textMuted }}> (calc)</span>}
                {inputs.use_Q_override && <span style={{ color: COLORS.amber }}> (override)</span>}
              </div>
            </div>
          </Accordion>

          <Accordion title="Bed Design" icon="◉">
            <SliderInput label="Number of Beds" value={inputs.N_bed} onChange={set("N_bed")} min={1} max={8} step={1} unit="" decimals={0} />
            <SliderInput label="Adsorbent Mass / Bed" value={inputs.m_ads} onChange={set("m_ads")} min={50} max={2000} step={10} unit="kg" decimals={0} />
            <SliderInput label="Bulk Density" value={inputs.rho_bulk} onChange={set("rho_bulk")} min={500} max={800} step={10} unit="kg/m³" decimals={0} />
            <SliderInput label="Pellet Diameter" value={inputs.d_p} onChange={set("d_p")} min={0.001} max={0.010} step={0.0005} unit="m" decimals={4} />
            <SliderInput label="Bed Porosity" value={inputs.epsilon} onChange={set("epsilon")} min={0.30} max={0.45} step={0.01} unit="" />
            <SliderInput label="Bed L/D Ratio" value={inputs.L_over_D} onChange={set("L_over_D")} min={1.0} max={5.0} step={0.1} unit="" decimals={1} />
            <SliderInput label="Wall Thickness" value={inputs.t_wall} onChange={set("t_wall")} min={0.003} max={0.012} step={0.001} unit="m" decimals={3} />
          </Accordion>

          <Accordion title="Operating Conditions" icon="◆">
            <SliderInput label={`Adsorption Temp (${(inputs.T_ads - 273.15).toFixed(0)}°C)`} value={inputs.T_ads} onChange={set("T_ads")} min={293} max={373} step={1} unit="K" decimals={0} />
            <SliderInput label={`Regeneration Temp (${(inputs.T_reg - 273.15).toFixed(0)}°C)`} value={inputs.T_reg} onChange={set("T_reg")} min={393} max={573} step={1} unit="K" decimals={0} />
            <SliderInput label="Regen CO₂ Fraction" value={inputs.y_CO2_reg} onChange={set("y_CO2_reg")} min={0.5} max={1.0} step={0.01} unit="" />
            <SliderInput label="Purge Mass Flow" value={inputs.m_dot_purge} onChange={set("m_dot_purge")} min={0.01} max={0.20} step={0.005} unit="kg/s" decimals={3} />
            <SliderInput label="Cooling Mass Flow" value={inputs.m_dot_cool} onChange={set("m_dot_cool")} min={0.05} max={0.50} step={0.01} unit="kg/s" />
            <SliderInput label={`Cooling Inlet Temp (${(inputs.T_cool_in - 273.15).toFixed(0)}°C)`} value={inputs.T_cool_in} onChange={set("T_cool_in")} min={288} max={323} step={1} unit="K" decimals={0} />
            <SliderInput label="Blower Efficiency" value={inputs.eta_blower} onChange={set("eta_blower")} min={0.50} max={0.90} step={0.01} unit="" />
          </Accordion>

          <Accordion title="Adsorbent Properties" icon="◈">
            <SliderInput label="Max Capacity (q_m)" value={inputs.q_m} onChange={set("q_m")} min={3.0} max={8.0} step={0.1} unit="mmol/g" decimals={1} />
            <SliderInput label="ΔH Adsorption" value={inputs.DeltaH_ads} onChange={set("DeltaH_ads")} min={30} max={50} step={0.5} unit="kJ/mol" decimals={1} />
            <SliderInput label="b₀ (×10⁻⁷)" value={inputs.b0 * 1e7} onChange={(v) => set("b0")(v * 1e-7)} min={0.5} max={20} step={0.5} unit="" decimals={1} />
            <SliderInput label="Moisture Derating" value={inputs.f_moisture} onChange={set("f_moisture")} min={0.50} max={1.00} step={0.01} unit="" />
            <SliderInput label="Zeolite Cp" value={inputs.Cp_ads} onChange={set("Cp_ads")} min={700} max={1100} step={10} unit="J/kg·K" decimals={0} />
            <SliderInput label="Heat Loss Factor" value={inputs.f_loss} onChange={set("f_loss")} min={0.0} max={0.25} step={0.01} unit="" />
          </Accordion>
        </div>

        {/* ─── Main Canvas ─── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {/* Top KPIs */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 0", minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="CO₂ Capture Rate" value={results.CO2_tpd} unit="t/day"
                status={results.CO2_tpd > 0.1 ? "ok" : "error"}
                diagnostic={results.Delta_q <= 0 ? "No working capacity — check isotherm params or T_reg" : results.CO2_tpd <= 0 ? "Under-designed bed" : null}
              />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="Specific Energy" value={results.kWh_per_ton} unit="kWh/t"
                status={results.kWh_per_ton < 2000 ? "ok" : results.kWh_per_ton < 3000 ? "warn" : "error"}
                diagnostic={!isFinite(results.kWh_per_ton) ? "No CO₂ captured — cannot compute" : null}
              />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 160, maxWidth: 280 }}><MetricCard label="Cycle Time" value={results.t_cycle_effective} unit="sec" /></div>
            <div style={{ flex: "1 1 0", minWidth: 160, maxWidth: 280 }}><MetricCard label="Working Capacity" value={results.Delta_q} unit="mol/kg" status={results.Delta_q > 0.5 ? "ok" : results.Delta_q > 0 ? "warn" : "error"} diagnostic={results.Delta_q <= 0 ? "No swing — adjust isotherm" : null} /></div>
          </div>

          {/* BioCHP Thermal Demand Banner */}
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.card} 0%, rgba(245,158,11,0.06) 100%)`,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 9, color: COLORS.amber, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                ⚡ BioCHP Thermal Demand
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim, lineHeight: 1.5 }}>
                Energy required from exhaust gas-to-gas HX to sustain regeneration cycles
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                  {(results.Q_total / 1e6).toFixed(2)}
                </div>
                <div style={{ fontSize: 9, color: COLORS.textMuted }}>MJ / cycle</div>
              </div>
              <div style={{ width: 1, height: 32, background: COLORS.panelBorder }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                  {results.Q_thermal_hourly_kW.toFixed(1)}
                </div>
                <div style={{ fontSize: 9, color: COLORS.textMuted }}>kW avg</div>
              </div>
              <div style={{ width: 1, height: 32, background: COLORS.panelBorder }} />
              <div style={{ textAlign: "center" }}>
                {(() => {
                  const utilPct = results.Q_dot_avail > 0 ? (results.Q_thermal_hourly_kW / results.Q_dot_avail) * 100 : 0;
                  const utilColor = utilPct <= 75 ? COLORS.accent : utilPct <= 95 ? COLORS.amber : COLORS.red;
                  return (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, color: utilColor, fontFamily: "'JetBrains Mono', monospace" }}>
                        {utilPct.toFixed(0)}%
                      </div>
                      <div style={{ fontSize: 9, color: COLORS.textMuted }}>of Q̇ avail</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Cycles / Hour" value={results.cycles_per_hour} unit="" /></div>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Q̇ Available" value={results.Q_dot_avail} unit="kW" status={inputs.use_Q_override ? "warn" : undefined} /></div>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Blower Power" value={results.W_blower} unit="W" /></div>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed ΔP" value={results.DeltaP} unit="Pa" /></div>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed Diameter" value={results.D} unit="m" /></div>
            <div style={{ flex: "1 1 0", minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed Length" value={results.L} unit="m" /></div>
          </div>

          {/* Constraints */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 0", minWidth: 200, maxWidth: 340 }}>
            <ConstraintBadge
              label="Thermal Feasibility"
              ok={results.constraints.thermal.ok}
              detail={`T_reg ${results.constraints.thermal.T_reg}K ≤ T_exh−ΔT ${results.constraints.thermal.T_max.toFixed(0)}K (margin: ${results.constraints.thermal.margin.toFixed(0)}K)`}
            />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 200, maxWidth: 340 }}>
            <ConstraintBadge
              label="Cooling Constraint"
              ok={results.constraints.cooling.ok}
              detail={`t_cool ${results.t_cool_required.toFixed(0)}s ≤ t_cycle ${results.t_cycle_effective.toFixed(0)}s`}
            />
            </div>
            <div style={{ flex: "1 1 0", minWidth: 200, maxWidth: 340 }}>
            <ConstraintBadge
              label="Energy Closure"
              ok={results.energy_closure < 0.05}
              detail={`${(results.energy_closure * 100).toFixed(1)}% gap · Q_in ${(results.Q_total / 1e6).toFixed(1)} MJ vs Q_out ${((results.Q_des + results.Q_cool) / 1e6).toFixed(1)} MJ (Δ ${((results.Q_total - results.Q_des - results.Q_cool) / 1e6).toFixed(1)} MJ)`}
            />
            </div>
          </div>

          {/* Binding Constraint Hint */}
          {results.binding_constraint === "cooling" && results.t_cool_required > results.t_reg_required * 1.2 && (
            <div style={{
              background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.2)`,
              borderRadius: 6, padding: "8px 12px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>💡</span>
              <span style={{ fontSize: 11, color: COLORS.cyan }}>
                Cooling is the bottleneck ({results.t_cool_required.toFixed(0)}s vs regen {results.t_reg_required.toFixed(0)}s).
                Try increasing cooling flow to ≥{Math.min(0.5, (inputs.m_dot_cool * results.t_cool_required / results.t_reg_required)).toFixed(2)} kg/s
                to bring cycle time down to regen-limited.
              </span>
            </div>
          )}
          {results.binding_constraint === "regeneration" && !results.constraints.thermal.ok && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 6, padding: "8px 12px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 11, color: COLORS.red }}>
                T_reg ({inputs.T_reg}K) exceeds thermal limit ({results.constraints.thermal.T_max.toFixed(0)}K).
                Reduce regeneration temp or increase BioCHP exhaust temp.
              </span>
            </div>
          )}
          {results.Delta_q <= 0 && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 6, padding: "8px 12px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 11, color: COLORS.red }}>
                Working capacity ≤ 0. The regeneration conditions do not release enough CO₂ relative to adsorption loading.
                Check: b₀ parameter, T_reg vs T_ads differential, or CO₂ partial pressures.
              </span>
            </div>
          )}

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Energy Breakdown */}
            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Regeneration Energy Breakdown (MJ)
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={energyData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${v.toFixed(2)} MJ`]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {energyData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cycle Timing */}
            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Cycle Phase Timing (seconds)
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cycleData} layout="vertical" barSize={22}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${v.toFixed(1)} s`]}
                  />
                  <Bar dataKey="time" radius={[0, 4, 4, 0]}>
                    {cycleData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Isotherm Chart */}
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 8, padding: 14,
          }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Langmuir Isotherm · Working Capacity Window
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={isothermData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.panelBorder} />
                <XAxis
                  dataKey="P_kPa" tick={{ fontSize: 10, fill: COLORS.textMuted }}
                  axisLine={false} tickLine={false}
                  label={{ value: "P_CO₂ (kPa)", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: COLORS.textMuted } }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: COLORS.textMuted }}
                  axisLine={false} tickLine={false}
                  label={{ value: "q (mol/kg)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: COLORS.textMuted } }}
                />
                <Tooltip
                  contentStyle={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, fontSize: 11 }}
                  formatter={(v, name) => [`${v.toFixed(2)} mol/kg`, name === "q_ads_T" ? `T_ads = ${inputs.T_ads}K` : `T_reg = ${inputs.T_reg}K`]}
                />
                <Line type="monotone" dataKey="q_ads_T" stroke={COLORS.accent} strokeWidth={2} dot={false} name={`T_ads`} />
                <Line type="monotone" dataKey="q_reg_T" stroke={COLORS.amber} strokeWidth={2} dot={false} name={`T_reg`} />
                <ReferenceLine x={results.P_CO2_ads / 1000} stroke={COLORS.accent} strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine x={results.P_CO2_reg / 1000} stroke={COLORS.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceDot x={results.P_CO2_ads / 1000} y={results.q_ads} r={5} fill={COLORS.accent} stroke={COLORS.white} strokeWidth={1} />
                <ReferenceDot x={results.P_CO2_reg / 1000} y={results.q_reg} r={5} fill={COLORS.amber} stroke={COLORS.white} strokeWidth={1} />
                <Legend wrapperStyle={{ fontSize: 10, color: COLORS.textMuted }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
