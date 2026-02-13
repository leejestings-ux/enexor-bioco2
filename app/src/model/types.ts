export interface ModelInputs {
  // Bio-CHP Boundary
  m_dot_exh: number;
  y_CO2: number;
  T_exh_biochp: number;
  P_exh: number;
  T_ambient: number;
  DeltaT_approach: number;
  use_Q_override: boolean;
  Q_dot_manual: number;

  // TSA System
  N_bed: number;
  m_ads: number;
  rho_bulk: number;
  d_p: number;
  epsilon: number;
  L_over_D: number;
  t_wall: number;
  rho_steel: number;
  T_ads: number;
  T_reg: number;
  y_CO2_reg: number;
  m_dot_purge: number;
  m_dot_cool: number;
  eta_blower: number;
  Cp_ads: number;
  Cp_steel: number;
  f_loss: number;

  // Isotherm
  q_m: number;
  DeltaH_ads: number;
  b0: number;
  f_moisture: number;

  // Cooling
  T_cool_in: number;
  Cp_cool: number;
}

export interface ThermalConstraint {
  ok: boolean;
  T_reg: number;
  T_max: number;
  margin: number;
}

export interface CoolingConstraint {
  ok: boolean;
  t_cool: number;
  t_available: number;
}

export interface ModelOutputs {
  V_bed: number;
  D: number;
  L: number;
  A_cross: number;
  m_steel: number;

  q_ads: number;
  q_reg: number;
  Delta_q: number;
  n_CO2: number;
  m_CO2_bed: number;

  Q_zeolite: number;
  Q_steel: number;
  Q_des: number;
  Q_purge: number;
  Q_losses: number;
  Q_total: number;
  Q_cool: number;

  t_ads: number;
  t_reg_required: number;
  t_cool_required: number;
  t_cycle_effective: number;
  binding_constraint: string;
  cycles_per_hour: number;

  CO2_per_hour: number;
  CO2_tpd: number;
  CO2_tph: number;
  Thermal_kWh: number;
  Electrical_kW: number;
  E_total_kWh_hr: number;
  kWh_per_ton: number;

  DeltaP: number;
  v_sup: number;
  W_blower: number;

  constraints: {
    thermal: ThermalConstraint;
    cooling: CoolingConstraint;
  };
  thermal_feasible: boolean;

  m_dot_CO2: number;
  volumetric_flow: number;
  rho_exh: number;

  Q_dot_calc: number;
  Q_dot_avail: number;
  T_regen_air_max: number;
  T_exh: number;

  Q_thermal_per_cycle: number;
  Q_dot_demand: number;
  Q_thermal_hourly_kW: number;

  energy_closure: number;

  langmuir: (T: number, P_CO2_pa: number) => number;
  P_CO2_ads: number;
  P_CO2_reg: number;
}
