import { R, M_CO2, PI } from './constants';
import { cpMix, idealGasDensity, mixtureMolarMass } from './gasProperties';
import type { ModelInputs, ModelOutputs } from './types';

export function runModel(inputs: ModelInputs): ModelOutputs {
  const {
    m_dot_exh, y_CO2, T_exh_biochp, P_exh, DeltaT_approach,
    use_Q_override, Q_dot_manual,
    N_bed, m_ads, rho_bulk, d_p, epsilon, L_over_D, t_wall, rho_steel,
    T_ads, T_reg, y_CO2_reg, m_dot_purge, m_dot_cool, eta_blower,
    Cp_ads, Cp_steel, f_loss, q_m, DeltaH_ads, b0, f_moisture,
    T_cool_in, Cp_cool,
  } = inputs;

  // §5 Gas-to-Gas HX
  const T_regen_air_max = T_exh_biochp - DeltaT_approach;
  const T_exh = T_ads + 30; // Post-HX exhaust at TSA beds

  const M_mix = mixtureMolarMass(y_CO2);
  const Cp_exh_avg_mol = cpMix((T_exh_biochp + T_exh) / 2, y_CO2);
  const Cp_exh_avg = Cp_exh_avg_mol / M_mix;

  const Q_dot_calc = m_dot_exh * Cp_exh_avg * (T_exh_biochp - T_exh) / 1000;
  const Q_dot_avail = use_Q_override ? Q_dot_manual : Q_dot_calc;

  // §4 Geometry
  const V_bed = m_ads / rho_bulk;
  const D = Math.pow(4 * V_bed / (PI * L_over_D), 1 / 3);
  const L = D * L_over_D;
  const A_cross = PI * D * D / 4;
  const V_steel = PI * D * L * t_wall;
  const m_steel = V_steel * rho_steel;

  // §6 CO₂ Mass Flow
  const rho_CO2 = idealGasDensity(T_exh, P_exh, M_CO2);
  const rho_N2_val = idealGasDensity(T_exh, P_exh, 0.02802);
  const m_dot_CO2 = m_dot_exh * (y_CO2 * rho_CO2) /
    (y_CO2 * rho_CO2 + (1 - y_CO2) * rho_N2_val);

  // §7 Langmuir Isotherm
  const DeltaH_J = DeltaH_ads * 1000;

  // CRITICAL: b₀ is in kPa⁻¹. P_CO₂ is converted to kPa before use.
  // Literature often reports b₀ in Pa⁻¹, bar⁻¹, or atm⁻¹ — unit mismatch = 1000x error.
  function langmuir(T: number, P_CO2_pa: number): number {
    const P_CO2_kpa = P_CO2_pa / 1000;
    // +DeltaH because DeltaH_ads is positive (exothermic): b must increase at lower T
    const b_T = b0 * Math.exp(DeltaH_J / (R * T));
    return (q_m * b_T * P_CO2_kpa) / (1 + b_T * P_CO2_kpa);
  }

  const P_CO2_ads = y_CO2 * P_exh;
  const P_CO2_reg = y_CO2_reg * P_exh;
  const q_ads = langmuir(T_ads, P_CO2_ads);
  const q_reg = langmuir(T_reg, P_CO2_reg);
  const Delta_q_raw = q_ads - q_reg;
  const Delta_q = Delta_q_raw * f_moisture;

  // q_m in mmol/g = mol/kg, so n_CO2 = m_ads(kg) * Delta_q(mol/kg) = mol
  const n_CO2 = m_ads * Delta_q;
  const m_CO2_bed = n_CO2 * M_CO2;

  // §8 Regeneration Energy
  const DeltaT_reg = T_reg - T_ads;

  const Q_zeolite = m_ads * Cp_ads * DeltaT_reg;
  const Q_steel_energy = m_steel * Cp_steel * DeltaT_reg;
  const Q_des = n_CO2 * DeltaH_J;

  // Purge bootstrapping (§8.4)
  const Q_core = Q_zeolite + Q_steel_energy + Q_des;
  const Q_core_with_loss = Q_core * (1 + f_loss);
  const t_reg_initial = Q_dot_avail > 0 ? Q_core_with_loss / (Q_dot_avail * 1000) : Infinity;

  const Cp_purge_ads = cpMix(T_ads, y_CO2);
  const Cp_purge_reg = cpMix(T_reg, y_CO2);
  const Cp_purge_avg = ((Cp_purge_ads + Cp_purge_reg) / 2) / M_mix;

  const Q_purge_energy = m_dot_purge * Cp_purge_avg * DeltaT_reg * t_reg_initial;

  // §8.5 Heat Losses
  const Q_subtotal = Q_zeolite + Q_steel_energy + Q_des + Q_purge_energy;
  const Q_losses = f_loss * Q_subtotal;
  const Q_total = Q_subtotal + Q_losses;

  // §8.6 Thermal Constraint
  const t_reg_required = Q_dot_avail > 0 ? Q_total / (Q_dot_avail * 1000) : Infinity;
  const thermal_feasible = T_reg <= T_regen_air_max;

  // §9 Cooling
  const Q_cool = (m_ads * Cp_ads + m_steel * Cp_steel) * DeltaT_reg;
  const T_bed_avg = (T_reg + T_ads) / 2;
  const Q_dot_cool = m_dot_cool * Cp_cool * (T_bed_avg - T_cool_in);
  const t_cool_required = Q_dot_cool > 0 ? Q_cool / Q_dot_cool : Infinity;

  // §10 Pressure Drop (Ergun)
  const rho_exh = idealGasDensity(T_exh, P_exh, M_mix);
  const volumetric_flow = m_dot_exh / rho_exh;
  const v_sup = volumetric_flow / A_cross;
  const mu = 1.8e-5;
  const dP_over_L =
    (150 * Math.pow(1 - epsilon, 2) * mu * v_sup) / (Math.pow(epsilon, 3) * d_p * d_p) +
    (1.75 * (1 - epsilon) * rho_exh * v_sup * v_sup) / (Math.pow(epsilon, 3) * d_p);
  const DeltaP = dP_over_L * L;

  // §11 Blower
  const W_blower = (DeltaP * volumetric_flow) / eta_blower;

  // §12 Cycle Timing
  const t_ads = m_CO2_bed > 0 && m_dot_CO2 > 0
    ? m_CO2_bed / (m_dot_CO2 / N_bed)
    : Infinity;
  const t_cycle_effective = Math.max(t_ads, t_reg_required, t_cool_required);

  let binding_constraint = 'adsorption';
  if (t_cycle_effective === t_reg_required) binding_constraint = 'regeneration';
  if (t_cycle_effective === t_cool_required) binding_constraint = 'cooling';

  // §13 Capture Rate
  const cycles_per_hour = isFinite(t_cycle_effective) && t_cycle_effective > 0
    ? 3600 / t_cycle_effective : 0;
  const CO2_per_hour = m_CO2_bed * N_bed * cycles_per_hour;
  const CO2_tpd = (CO2_per_hour * 24) / 1000;
  const CO2_tph = CO2_per_hour / 1000;

  // §14 Specific Energy
  const Thermal_kWh = Q_total / 3.6e6;
  const Thermal_kWh_hr = Thermal_kWh * cycles_per_hour;
  const Electrical_kW = W_blower / 1000;
  const E_total_kWh_hr = Thermal_kWh_hr + Electrical_kW;
  const kWh_per_ton = CO2_tph > 0 ? E_total_kWh_hr / CO2_tph : Infinity;

  // §15 Closure
  const Q_in = Q_total;
  const Q_out = Q_des + Q_cool;
  const energy_closure = Q_in > 0 ? Math.abs(Q_in - Q_out) / Q_in : 0;

  return {
    V_bed, D, L, A_cross, m_steel,
    q_ads, q_reg, Delta_q, n_CO2, m_CO2_bed,
    Q_zeolite, Q_steel: Q_steel_energy, Q_des, Q_purge: Q_purge_energy, Q_losses, Q_total, Q_cool,
    t_ads, t_reg_required, t_cool_required, t_cycle_effective, binding_constraint,
    cycles_per_hour,
    CO2_per_hour, CO2_tpd, CO2_tph,
    Thermal_kWh, Electrical_kW, E_total_kWh_hr, kWh_per_ton,
    DeltaP, v_sup, W_blower,
    constraints: {
      thermal: { ok: thermal_feasible, T_reg, T_max: T_regen_air_max, margin: T_regen_air_max - T_reg },
      cooling: { ok: t_cool_required <= t_cycle_effective, t_cool: t_cool_required, t_available: t_cycle_effective },
    },
    thermal_feasible,
    m_dot_CO2, volumetric_flow, rho_exh,
    Q_dot_calc, Q_dot_avail, T_regen_air_max, T_exh,
    Q_thermal_per_cycle: Q_total,
    Q_dot_demand: t_reg_required > 0 ? Q_total / t_reg_required / 1000 : 0,
    Q_thermal_hourly_kW: Thermal_kWh_hr,
    energy_closure,
    langmuir, P_CO2_ads, P_CO2_reg,
  };
}
