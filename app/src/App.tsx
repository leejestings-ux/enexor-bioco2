import { useState, useCallback } from 'react';
import { useModel } from './hooks/useModel';
import type { ModelInputs, ModelOutputs } from './model/types';
import Header from './components/Header';
import SliderInput from './components/SliderInput';
import Accordion from './components/Accordion';
import MetricCard from './components/MetricCard';
import ConstraintBadge from './components/ConstraintBadge';
import ThermalDemand from './components/ThermalDemand';
import EnergyBreakdown from './components/Charts/EnergyBreakdown';
import CycleTiming from './components/Charts/CycleTiming';
import IsothermChart from './components/Charts/IsothermChart';

const C = {
  bg: '#0a0e17',
  panel: '#111827',
  panelBorder: '#1e293b',
  card: '#0f1729',
  cardBorder: '#1a2744',
  accent: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
  white: '#f8fafc',
  textDim: '#94a3b8',
  textMuted: '#64748b',
};

const DEFAULT_INPUTS: ModelInputs = {
  m_dot_exh: 0.85,
  y_CO2: 0.12,
  T_exh_biochp: 773,
  P_exh: 101325,
  T_ambient: 303,
  DeltaT_approach: 15,
  use_Q_override: false,
  Q_dot_manual: 120,
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
  q_m: 5.5,
  DeltaH_ads: 38,
  b0: 6.0e-7,
  f_moisture: 0.85,
  T_cool_in: 303,
  Cp_cool: 1010,
};

function isModelOutputs(r: ModelOutputs | { error: string }): r is ModelOutputs {
  return !('error' in r);
}

export default function App() {
  const [inputs, setInputs] = useState<ModelInputs>(DEFAULT_INPUTS);
  const set = useCallback(
    <K extends keyof ModelInputs>(key: K) => (val: ModelInputs[K]) =>
      setInputs((prev) => ({ ...prev, [key]: val })),
    [],
  );

  const results = useModel(inputs);

  if (!isModelOutputs(results)) {
    return (
      <div style={{ padding: 40, color: C.red, background: C.bg, minHeight: '100vh' }}>
        <h2>Model Error</h2>
        <p>{results.error}</p>
      </div>
    );
  }

  const r = results;

  return (
    <div style={{ background: C.bg, color: '#e2e8f0', minHeight: '100vh', fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <Header bindingConstraint={r.binding_constraint} />

      <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
        {/* ─── Left Panel: Inputs ─── */}
        <div style={{
          width: 280, minWidth: 280, borderRight: `1px solid ${C.panelBorder}`,
          background: C.panel, overflowY: 'auto', padding: '8px 10px',
        }}>
          {/* Enexor Wordmark */}
          <div style={{ padding: '8px 4px 6px', marginBottom: 4, borderBottom: `1px solid ${C.panelBorder}` }}>
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
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 0 4px', fontWeight: 600 }}>
            SYSTEM INPUTS
          </div>

          <Accordion title="Bio-CHP Exhaust" icon="⚡" defaultOpen={true}>
            <SliderInput label={`BioCHP Exhaust Temp (${(inputs.T_exh_biochp - 273.15).toFixed(0)}°C)`} value={inputs.T_exh_biochp} onChange={set('T_exh_biochp')} min={473} max={773} step={5} unit="K" decimals={0} />
            <SliderInput label="Exhaust Mass Flow" value={inputs.m_dot_exh} onChange={set('m_dot_exh')} min={0.1} max={3.0} step={0.01} unit="kg/s" />
            <SliderInput label="CO₂ Fraction" value={inputs.y_CO2} onChange={set('y_CO2')} min={0.04} max={0.20} step={0.01} unit="vol" />
            <SliderInput label="Exhaust Pressure" value={inputs.P_exh} onChange={set('P_exh')} min={95000} max={110000} step={100} unit="Pa" decimals={0} />
            <SliderInput label={`Ambient Air Temp (${(inputs.T_ambient - 273.15).toFixed(0)}°C)`} value={inputs.T_ambient} onChange={set('T_ambient')} min={273} max={323} step={1} unit="K" decimals={0} />
            <SliderInput label="HX Approach ΔT" value={inputs.DeltaT_approach} onChange={set('DeltaT_approach')} min={5} max={50} step={1} unit="K" decimals={0} />

            {/* Q_dot override toggle */}
            <div style={{ marginTop: 8, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <button
                  onClick={() => set('use_Q_override')(!inputs.use_Q_override)}
                  style={{
                    width: 36, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: inputs.use_Q_override ? C.accent : C.panelBorder,
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', background: C.white,
                    position: 'absolute', top: 2,
                    left: inputs.use_Q_override ? 20 : 2,
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: 10, color: inputs.use_Q_override ? C.accent : C.textMuted }}>
                  Override Q̇ thermal
                </span>
              </div>
              {inputs.use_Q_override && (
                <SliderInput label="Q̇ Override" value={inputs.Q_dot_manual} onChange={set('Q_dot_manual')} min={10} max={500} step={5} unit="kW" decimals={0} />
              )}
              <div style={{
                fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace",
                background: C.bg, borderRadius: 4, padding: '4px 8px', marginTop: 4,
                border: `1px solid ${C.cardBorder}`,
              }}>
                Q̇ avail: <span style={{ color: C.accent }}>{r.Q_dot_avail?.toFixed(1) ?? '\u2014'} kW</span>
                {!inputs.use_Q_override && <span style={{ color: C.textMuted }}> (calc)</span>}
                {inputs.use_Q_override && <span style={{ color: C.amber }}> (override)</span>}
              </div>
            </div>
          </Accordion>

          <Accordion title="Bed Design" icon="◉">
            <SliderInput label="Number of Beds" value={inputs.N_bed} onChange={set('N_bed')} min={1} max={8} step={1} unit="" decimals={0} />
            <SliderInput label="Adsorbent Mass / Bed" value={inputs.m_ads} onChange={set('m_ads')} min={50} max={2000} step={10} unit="kg" decimals={0} />
            <SliderInput label="Bulk Density" value={inputs.rho_bulk} onChange={set('rho_bulk')} min={500} max={800} step={10} unit="kg/m³" decimals={0} />
            <SliderInput label="Pellet Diameter" value={inputs.d_p} onChange={set('d_p')} min={0.001} max={0.010} step={0.0005} unit="m" decimals={4} />
            <SliderInput label="Bed Porosity" value={inputs.epsilon} onChange={set('epsilon')} min={0.30} max={0.45} step={0.01} unit="" />
            <SliderInput label="Bed L/D Ratio" value={inputs.L_over_D} onChange={set('L_over_D')} min={1.0} max={5.0} step={0.1} unit="" decimals={1} />
            <SliderInput label="Wall Thickness" value={inputs.t_wall} onChange={set('t_wall')} min={0.003} max={0.012} step={0.001} unit="m" decimals={3} />
          </Accordion>

          <Accordion title="Operating Conditions" icon="◆">
            <SliderInput label={`Adsorption Temp (${(inputs.T_ads - 273.15).toFixed(0)}°C)`} value={inputs.T_ads} onChange={set('T_ads')} min={293} max={373} step={1} unit="K" decimals={0} />
            <SliderInput label={`Regeneration Temp (${(inputs.T_reg - 273.15).toFixed(0)}°C)`} value={inputs.T_reg} onChange={set('T_reg')} min={393} max={573} step={1} unit="K" decimals={0} />
            <SliderInput label="Regen CO₂ Fraction" value={inputs.y_CO2_reg} onChange={set('y_CO2_reg')} min={0.5} max={1.0} step={0.01} unit="" />
            <SliderInput label="Purge Mass Flow" value={inputs.m_dot_purge} onChange={set('m_dot_purge')} min={0.01} max={0.20} step={0.005} unit="kg/s" decimals={3} />
            <SliderInput label="Cooling Mass Flow" value={inputs.m_dot_cool} onChange={set('m_dot_cool')} min={0.05} max={0.50} step={0.01} unit="kg/s" />
            <SliderInput label={`Cooling Inlet Temp (${(inputs.T_cool_in - 273.15).toFixed(0)}°C)`} value={inputs.T_cool_in} onChange={set('T_cool_in')} min={288} max={323} step={1} unit="K" decimals={0} />
            <SliderInput label="Blower Efficiency" value={inputs.eta_blower} onChange={set('eta_blower')} min={0.50} max={0.90} step={0.01} unit="" />
          </Accordion>

          <Accordion title="Adsorbent Properties" icon="◈">
            <SliderInput label="Max Capacity (q_m)" value={inputs.q_m} onChange={set('q_m')} min={3.0} max={8.0} step={0.1} unit="mmol/g" decimals={1} />
            <SliderInput label="ΔH Adsorption" value={inputs.DeltaH_ads} onChange={set('DeltaH_ads')} min={30} max={50} step={0.5} unit="kJ/mol" decimals={1} />
            <SliderInput label="b₀ (×10⁻⁷)" value={inputs.b0 * 1e7} onChange={(v: number) => set('b0')(v * 1e-7)} min={0.5} max={20} step={0.5} unit="" decimals={1} />
            <SliderInput label="Moisture Derating" value={inputs.f_moisture} onChange={set('f_moisture')} min={0.50} max={1.00} step={0.01} unit="" />
            <SliderInput label="Zeolite Cp" value={inputs.Cp_ads} onChange={set('Cp_ads')} min={700} max={1100} step={10} unit="J/kg·K" decimals={0} />
            <SliderInput label="Heat Loss Factor" value={inputs.f_loss} onChange={set('f_loss')} min={0.0} max={0.25} step={0.01} unit="" />
          </Accordion>
        </div>

        {/* ─── Main Canvas ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Top KPIs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 0', minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="CO₂ Capture Rate" value={r.CO2_tpd} unit="t/day"
                status={r.CO2_tpd > 0.1 ? 'ok' : 'error'}
                diagnostic={r.Delta_q <= 0 ? 'No working capacity \u2014 check isotherm params or T_reg' : r.CO2_tpd <= 0 ? 'Under-designed bed' : null}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="Specific Energy" value={r.kWh_per_ton} unit="kWh/t"
                status={r.kWh_per_ton < 2000 ? 'ok' : r.kWh_per_ton < 3000 ? 'warn' : 'error'}
                diagnostic={!isFinite(r.kWh_per_ton) ? 'No CO₂ captured \u2014 cannot compute' : null}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="Cycle Time" value={r.t_cycle_effective} unit="sec" />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 160, maxWidth: 280 }}>
              <MetricCard label="Working Capacity" value={r.Delta_q} unit="mol/kg"
                status={r.Delta_q > 0.5 ? 'ok' : r.Delta_q > 0 ? 'warn' : 'error'}
                diagnostic={r.Delta_q <= 0 ? 'No swing \u2014 adjust isotherm' : null}
              />
            </div>
          </div>

          {/* BioCHP Thermal Demand Banner */}
          <ThermalDemand Q_total={r.Q_total} Q_thermal_hourly_kW={r.Q_thermal_hourly_kW} Q_dot_avail={r.Q_dot_avail} />

          {/* Secondary KPIs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Cycles / Hour" value={r.cycles_per_hour} unit="" /></div>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Q̇ Available" value={r.Q_dot_avail} unit="kW" status={inputs.use_Q_override ? 'warn' : undefined} /></div>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Blower Power" value={r.W_blower} unit="W" /></div>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed ΔP" value={r.DeltaP} unit="Pa" /></div>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed Diameter" value={r.D} unit="m" /></div>
            <div style={{ flex: '1 1 0', minWidth: 130, maxWidth: 200 }}><MetricCard small label="Bed Length" value={r.L} unit="m" /></div>
          </div>

          {/* Constraints */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 0', minWidth: 200, maxWidth: 340 }}>
              <ConstraintBadge
                label="Thermal Feasibility"
                ok={r.constraints.thermal.ok}
                detail={`T_reg ${r.constraints.thermal.T_reg}K \u2264 T_exh\u2212\u0394T ${r.constraints.thermal.T_max.toFixed(0)}K (margin: ${r.constraints.thermal.margin.toFixed(0)}K)`}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 200, maxWidth: 340 }}>
              <ConstraintBadge
                label="Cooling Constraint"
                ok={r.constraints.cooling.ok}
                detail={`t_cool ${r.t_cool_required.toFixed(0)}s \u2264 t_cycle ${r.t_cycle_effective.toFixed(0)}s`}
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 200, maxWidth: 340 }}>
              <ConstraintBadge
                label="Energy Closure"
                ok={r.energy_closure < 0.05}
                detail={`${(r.energy_closure * 100).toFixed(1)}% gap \u00b7 Q_in ${(r.Q_total / 1e6).toFixed(1)} MJ vs Q_out ${((r.Q_des + r.Q_cool) / 1e6).toFixed(1)} MJ (\u0394 ${((r.Q_total - r.Q_des - r.Q_cool) / 1e6).toFixed(1)} MJ)`}
              />
            </div>
          </div>

          {/* Contextual Hints */}
          {r.binding_constraint === 'cooling' && r.t_cool_required > r.t_reg_required * 1.2 && (
            <div style={{
              background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>💡</span>
              <span style={{ fontSize: 11, color: C.cyan }}>
                Cooling is the bottleneck ({r.t_cool_required.toFixed(0)}s vs regen {r.t_reg_required.toFixed(0)}s).
                Try increasing cooling flow to ≥{Math.min(0.5, (inputs.m_dot_cool * r.t_cool_required / r.t_reg_required)).toFixed(2)} kg/s.
              </span>
            </div>
          )}
          {r.binding_constraint === 'regeneration' && !r.constraints.thermal.ok && (
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 11, color: C.red }}>
                T_reg ({inputs.T_reg}K) exceeds thermal limit ({r.constraints.thermal.T_max.toFixed(0)}K).
                Reduce regeneration temp or increase BioCHP exhaust temp.
              </span>
            </div>
          )}
          {r.binding_constraint === 'adsorption' && r.Delta_q > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 11, color: C.amber }}>
                Adsorption-limited — actual capture rate may be 10–30% lower due to mass transfer zone breakthrough. Apply 0.75–0.85 utilization factor until bench data is available.
              </span>
            </div>
          )}
          {r.Delta_q <= 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 11, color: C.red }}>
                Working capacity ≤ 0. Check: b₀ parameter (verify kPa⁻¹ units), T_reg vs T_ads differential, or CO₂ partial pressures.
              </span>
            </div>
          )}

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <EnergyBreakdown Q_zeolite={r.Q_zeolite} Q_steel={r.Q_steel} Q_des={r.Q_des} Q_purge={r.Q_purge} Q_losses={r.Q_losses} />
            <CycleTiming t_ads={r.t_ads} t_reg_required={r.t_reg_required} t_cool_required={r.t_cool_required} />
          </div>

          {/* Isotherm Chart */}
          <IsothermChart
            langmuir={r.langmuir}
            T_ads={inputs.T_ads}
            T_reg={inputs.T_reg}
            q_ads={r.q_ads}
            q_reg={r.q_reg}
            P_CO2_ads={r.P_CO2_ads}
            P_CO2_reg={r.P_CO2_reg}
          />
        </div>
      </div>
    </div>
  );
}
