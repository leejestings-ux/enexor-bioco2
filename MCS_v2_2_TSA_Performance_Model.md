# Enexor BioCO₂ – TSA Performance Model
# Model Computational Specification (MCS) – Version 2.2

---

## Revision History

| Version | Date       | Changes                                                                 |
| ------- | ---------- | ----------------------------------------------------------------------- |
| 2.1     | —          | Baseline MCS: oil loop thermal architecture                             |
| 2.2     | 2026-02-12 | Replaced hot oil loop with gas-to-gas HX using BioCHP exhaust;          |
|         |            | Added HX energy balance for Q̇_avail calculation with manual override;  |
|         |            | Added BioCHP thermal demand outputs;                                    |
|         |            | Added cooling model input variables (T_cool_in, Cp_cool);              |
|         |            | Resolved purge energy bootstrapping (iterative with Q_core);            |
|         |            | Added adsorption time derivation;                                       |
|         |            | Updated algorithm sequence and implementation notes                     |

---

## 1. Purpose

This document defines the computational logic, governing equations, constraints, assumptions, and algorithm sequence for the TSA CO₂ performance model.

This specification is the authoritative technical reference for implementation in the Python simulation engine.

**All internal calculations shall use SI units.**

---

## 2. System Boundary

### 2.1 Included

- Pre-treatment outlet to TSA inlet
- Adsorption phase
- Regeneration phase (gas-to-gas HX heated ambient air sweep)
- Cooling phase
- Gas-to-gas heat exchanger energy balance
- Packed bed pressure drop
- Blower power
- Thermal power constraint from Bio-CHP exhaust
- Cycle timing constraints
- Mass & energy balance closure

### 2.2 Excluded (Version 2.2)

- Membrane polishing (Stage 4)
- Downstream CO₂ compression
- Economic modeling
- HX detailed sizing (UA, NTU-effectiveness)

---

## 3. Input Variables

### 3.1 Bio-CHP Boundary Inputs

| Variable                        | Symbol            | Units | Description                                         |
| ------------------------------- | ----------------- | ----- | --------------------------------------------------- |
| Exhaust mass flow               | `m_dot_exh`       | kg/s  | Total exhaust mass flow rate                         |
| CO₂ volume fraction             | `y_CO2`           | –     | Mole/volume fraction of CO₂                         |
| BioCHP exhaust temperature      | `T_exh_biochp`    | K     | Raw exhaust temp from BioCHP (before HX)             |
| Exhaust pressure (absolute)     | `P_exh`           | Pa    | Absolute pressure at TSA inlet                       |
| Ambient air temperature         | `T_ambient`       | K     | Ambient air inlet to HX cold side                    |
| Minimum HX approach temperature | `DeltaT_approach` | K     | Minimum heat exchanger approach ΔT                   |
| Thermal power override          | `Q_dot_override`  | kW    | Manual override for Q̇_avail (optional; null = calc) |

**Thermal Architecture:**

The BioCHP exhaust (hot, CO₂-rich) passes through a gas-to-gas heat exchanger. On the hot side, exhaust is cooled from `T_exh_biochp` to `T_exh` (post-HX temperature at TSA bed inlet). On the cold side, ambient air is heated to produce the regeneration sweep gas.

```
BioCHP Exhaust ──→ [ Gas-to-Gas HX ] ──→ Cooled Exhaust ──→ TSA Beds (Adsorption)
                         ↕
Ambient Air    ──→ [ Gas-to-Gas HX ] ──→ Heated Air     ──→ TSA Beds (Regeneration)
```

**Constraint:**

```
T_reg <= T_exh_biochp - DeltaT_approach
```

### 3.2 TSA System Inputs

| Variable                       | Symbol        | Units  | Description                          |
| ------------------------------ | ------------- | ------ | ------------------------------------ |
| Number of beds                 | `N_bed`       | –      | Total number of adsorption beds      |
| Adsorbent mass per bed         | `m_ads`       | kg     | Mass of adsorbent per bed            |
| Adsorbent bulk density         | `rho_bulk`    | kg/m³  | Bulk density of packed adsorbent     |
| Pellet diameter                | `d_p`         | m      | Adsorbent pellet diameter            |
| Bed porosity                   | `epsilon`     | –      | Void fraction of packed bed          |
| Bed L/D ratio                  | `L_over_D`    | –      | Length-to-diameter ratio of bed      |
| Vessel wall thickness          | `t_wall`      | m      | Thickness of steel vessel wall       |
| Steel density                  | `rho_steel`   | kg/m³  | Density of vessel steel              |
| Adsorption temperature         | `T_ads`       | K      | Bed temperature during adsorption    |
| Regeneration temperature       | `T_reg`       | K      | Target bed temperature for regen     |
| Regeneration CO₂ mole fraction | `y_CO2_reg`   | –      | CO₂ mole fraction during regen      |
| Purge mass flow                | `m_dot_purge` | kg/s   | Mass flow rate of purge gas          |
| Cooling mass flow              | `m_dot_cool`  | kg/s   | Mass flow rate of cooling gas        |
| Cooling gas inlet temperature  | `T_cool_in`   | K      | Temperature of cooling gas at inlet  |
| Cooling gas heat capacity      | `Cp_cool`     | J/kg·K | Specific heat of cooling gas (air)   |
| Blower efficiency              | `eta_blower`  | –      | Isentropic efficiency of blower      |
| Zeolite heat capacity          | `Cp_ads`      | J/kg·K | Specific heat of adsorbent           |
| Steel heat capacity            | `Cp_steel`    | J/kg·K | Specific heat of vessel steel        |
| Heat loss factor               | `f_loss`      | –      | Fractional heat loss multiplier      |

---

## 4. Derived Geometry

### 4.1 Bed Volume

```python
V_bed = m_ads / rho_bulk
```

### 4.2 Bed Diameter and Length

From the cylindrical volume relation `V_bed = (pi * D^2 / 4) * L` and `L = D * L_over_D`:

```python
D = (4 * V_bed / (pi * L_over_D)) ** (1/3)
L = D * L_over_D
A_cross = pi * D**2 / 4
```

### 4.3 Steel Mass

Approximate cylindrical shell (thin-wall assumption):

```python
V_steel = pi * D * L * t_wall
m_steel = V_steel * rho_steel
```

---

## 5. Gas-to-Gas Heat Exchanger

### 5.1 Post-HX Exhaust Temperature

The exhaust exits the HX and enters the TSA beds at a reduced temperature. For this model version, the post-HX exhaust temperature is approximated as:

```python
T_exh = T_ads + 30   # K; post-HX exhaust entering TSA beds
```

**Note:** Future versions may derive `T_exh` from HX effectiveness or UA sizing. The +30 K offset ensures the exhaust entering beds is slightly above adsorption temperature, reflecting realistic HX outlet conditions.

### 5.2 Maximum Regeneration Air Temperature

```python
T_regen_air_max = T_exh_biochp - DeltaT_approach
```

### 5.3 Available Thermal Power (Calculated)

Exhaust-side energy balance across the HX:

```python
M_mix = y_CO2 * M_CO2 + (1 - y_CO2) * M_N2
Cp_exh_avg = cp_mix_avg(T_exh_biochp, T_exh, y_CO2) / M_mix   # J/(kg·K)
Q_dot_calc = m_dot_exh * Cp_exh_avg * (T_exh_biochp - T_exh) / 1000   # kW
```

Where `cp_mix_avg` evaluates the molar Cp of the exhaust mixture at the average of inlet and outlet temperatures.

### 5.4 Available Thermal Power (Effective)

```python
if Q_dot_override is not None:
    Q_dot_avail = Q_dot_override
else:
    Q_dot_avail = Q_dot_calc
```

The calculated value is always reported for reference regardless of override status.

---

## 6. CO₂ Mass Flow

Using ideal gas densities (or CoolProp in Python implementation):

```python
rho_CO2 = ideal_gas_density(T_exh, P_exh, M_CO2)
rho_N2 = ideal_gas_density(T_exh, P_exh, M_N2)
```

CO₂ mass flow:

```python
m_dot_CO2 = m_dot_exh * (y_CO2 * rho_CO2) / (y_CO2 * rho_CO2 + (1 - y_CO2) * rho_N2)
```

---

## 7. Adsorption Thermodynamics

### 7.1 Langmuir Isotherm

```python
q = (q_m * b_T * P_CO2) / (1 + b_T * P_CO2)
```

Temperature-dependent affinity parameter:

```python
b_T = b0 * exp(-DeltaH_ads / (R * T))
```

**Baseline parameters:**

| Parameter    | Baseline         | Sensitivity Range |
| ------------ | ---------------- | ----------------- |
| `q_m`        | 5.5 mmol/g       | ±15%              |
| `DeltaH_ads` | 38 kJ/mol        | ±10%              |
| `b0`         | literature-based | sensitivity       |

**Units note:** `q_m` in mmol/g is numerically equivalent to mol/kg. All internal calculations use mol/kg.

### 7.2 Working Capacity

Adsorption loading:

```python
P_CO2_ads = y_CO2 * P_exh
q_ads = q(T_ads, P_CO2_ads)
```

Regeneration residual:

```python
P_CO2_reg = y_CO2_reg * P_exh
q_reg = q(T_reg, P_CO2_reg)
```

Working capacity:

```python
Delta_q = q_ads - q_reg                          # mol/kg
Delta_q_effective = Delta_q * f_moisture          # mol/kg (moisture-derated)
n_CO2 = m_ads * Delta_q_effective                 # mol per bed per cycle
m_CO2_bed = n_CO2 * M_CO2                         # kg per bed per cycle
```

Optional moisture derating:

```python
# f_moisture defaults to 1.0 if not specified
Delta_q_effective = Delta_q * f_moisture
```

---

## 8. Regeneration Energy

Total regeneration energy per bed per cycle:

```python
Q_total = Q_purge + Q_zeolite + Q_steel + Q_des + Q_losses
```

### 8.1 Zeolite Sensible Heat

```python
DeltaT_reg = T_reg - T_ads
Q_zeolite = m_ads * Cp_ads * DeltaT_reg
```

### 8.2 Steel Sensible Heat

```python
Q_steel = m_steel * Cp_steel * DeltaT_reg
```

### 8.3 Heat of Desorption

```python
n_CO2 = m_CO2_bed / M_CO2       # mol
Q_des = n_CO2 * DeltaH_ads      # DeltaH_ads in J/mol
```

### 8.4 Purge Sensible Heat (Bootstrapped)

The purge gas flows continuously during regeneration, so purge energy depends on regeneration time, which depends on total energy including purge. This is resolved by bootstrapping:

**Step 1:** Compute core energy without purge:

```python
Q_core = Q_zeolite + Q_steel + Q_des
Q_core_with_loss = Q_core * (1 + f_loss)
t_reg_initial = Q_core_with_loss / (Q_dot_avail * 1000)
```

**Step 2:** Compute purge energy using initial regen time:

```python
Cp_purge_avg = cp_mix_avg(T_ads, T_reg, y_CO2) / M_mix   # J/(kg·K)
Q_purge = m_dot_purge * Cp_purge_avg * DeltaT_reg * t_reg_initial
```

### 8.5 Heat Losses

```python
Q_subtotal = Q_zeolite + Q_steel + Q_des + Q_purge
Q_losses = f_loss * Q_subtotal
```

### 8.6 Thermal Constraint

Required regeneration time:

```python
t_reg_required = Q_total / (Q_dot_avail * 1000)   # Q_dot_avail in kW → convert to W
```

Feasibility condition:

```python
assert T_reg <= T_exh_biochp - DeltaT_approach
```

### 8.7 BioCHP Thermal Demand

These outputs characterize the thermal load placed on the BioCHP system:

```python
Q_thermal_per_cycle = Q_total                                    # J per bed per cycle
Q_dot_demand = Q_total / t_reg_required                          # W (peak during regen)
Q_thermal_hourly = (Q_total / 3.6e6) * cycles_per_hour           # kWh/hr = kW avg
thermal_utilization = Q_thermal_hourly / Q_dot_avail              # fraction of available
```

---

## 9. Cooling Model

Cooling energy (sensible heat to remove):

```python
Q_cool = (m_ads * Cp_ads + m_steel * Cp_steel) * DeltaT_reg
```

Cooling rate:

```python
T_bed_avg = (T_reg + T_ads) / 2
Q_dot_cool = m_dot_cool * Cp_cool * (T_bed_avg - T_cool_in)
```

Cooling time:

```python
t_cool_required = Q_cool / Q_dot_cool
```

**Constraint:**

```python
assert t_cool_required <= t_cycle_effective
```

---

## 10. Pressure Drop (Ergun Equation)

Superficial velocity:

```python
v = volumetric_flow / A_cross
```

Ergun equation (per unit length):

```python
dP_over_L = (
    150 * (1 - epsilon)**2 * mu * v / (epsilon**3 * d_p**2)
    + 1.75 * (1 - epsilon) * rho * v**2 / (epsilon**3 * d_p)
)
```

Total pressure drop:

```python
DeltaP = dP_over_L * L
```

---

## 11. Blower Power

```python
W_blower = (DeltaP * volumetric_flow) / eta_blower
```

---

## 12. Cycle Timing

### 12.1 Adsorption Time

Approximate time to saturate one bed based on inlet CO₂ flow distributed across all beds:

```python
t_ads = m_CO2_bed / (m_dot_CO2 / N_bed)
```

### 12.2 Effective Cycle Time

Binding constraint:

```python
t_cycle_effective = max(t_ads, t_reg_required, t_cool_required)
```

The binding constraint (adsorption, regeneration, or cooling) is reported as a diagnostic output.

---

## 13. CO₂ Capture Rate

```python
cycles_per_hour = 3600 / t_cycle_effective
CO2_per_hour = m_CO2_bed * N_bed * cycles_per_hour              # kg/hr
CO2_tpd = CO2_per_hour * 24 / 1000                              # metric tons/day
```

---

## 14. Specific Energy

Total energy (thermal + electrical):

```python
Thermal_kWh_hr = (Q_total / 3.6e6) * cycles_per_hour           # kW (avg thermal)
Electrical_kW = W_blower / 1000                                  # kW (continuous)
E_total = Thermal_kWh_hr + Electrical_kW                         # kW total
```

Specific energy:

```python
CO2_tph = CO2_per_hour / 1000                                    # metric tons/hr
kWh_per_ton = E_total / CO2_tph
```

---

## 15. Closure Checks

Mass balance tolerance:

```python
mass_error = abs(m_in - m_out)
assert mass_error / m_in <= 0.01         # <= 1%
```

Energy balance tolerance:

```python
energy_error = abs(Q_in - Q_out)
assert energy_error / Q_in <= 0.05       # <= 5%
```

**If violated:** flag simulation as invalid. Do not report as feasible.

---

## 16. Algorithm Sequence

```
 1. Load inputs
 2. Compute gas-to-gas HX energy balance (Section 5)
 3. Determine Q_dot_avail (calculated or override) (Section 5.4)
 4. Derive bed geometry (Section 4)
 5. Compute inlet CO₂ mass flow (Section 6)
 6. Compute adsorption loading (Section 7.1, 7.2)
 7. Compute regeneration residual (Section 7.2)
 8. Compute working capacity (Section 7.2)
 9. Compute regeneration energy with purge bootstrapping (Section 8)
10. Compute required regeneration time (Section 8.6)
11. Compute BioCHP thermal demand (Section 8.7)
12. Compute cooling time (Section 9)
13. Compute adsorption time (Section 12.1)
14. Compute superficial velocity (Section 10)
15. Compute pressure drop (Section 10)
16. Compute blower power (Section 11)
17. Determine effective cycle time and binding constraint (Section 12.2)
18. Compute CO₂ capture rate (Section 13)
19. Compute specific energy (Section 14)
20. Perform closure checks (Section 15)
21. Return structured results
```

---

## Appendix A: Constants

| Constant                  | Symbol   | Value              | Units    |
| ------------------------- | -------- | ------------------ | -------- |
| Universal gas constant    | `R`      | 8.314              | J/mol·K  |
| Molar mass of CO₂        | `M_CO2`  | 0.04401            | kg/mol   |
| Molar mass of N₂         | `M_N2`   | 0.02802            | kg/mol   |
| Pi                        | `pi`     | 3.141592653589793  | –        |

---

## Appendix B: Gas Property Correlations

For browser-based implementations where CoolProp is unavailable, the following analytical correlations provide equivalent accuracy at near-atmospheric operating conditions (P < 200 kPa, T = 300–800 K):

### B.1 Ideal Gas Density

```python
rho = (P * M) / (R * T)
```

### B.2 Shomate Equation (NIST) for Heat Capacity

```python
Cp(T) = A + B*t + C*t² + D*t³ + E/t²     # J/(mol·K), where t = T/1000
```

| Species | A       | B        | C         | D        | E         | Valid Range |
| ------- | ------- | -------- | --------- | -------- | --------- | ----------- |
| CO₂     | 24.997  | 55.187   | -33.691   | 7.948    | -0.137    | 298–1200 K  |
| N₂      | 28.986  | 1.854    | -9.647    | 16.635   | 0.000117  | 298–1200 K  |

### B.3 Mixture Heat Capacity

```python
Cp_mix(T, y_CO2) = y_CO2 * Cp_CO2(T) + (1 - y_CO2) * Cp_N2(T)    # J/(mol·K)
Cp_mix_mass = Cp_mix / M_mix                                         # J/(kg·K)
```

---

## Appendix C: Implementation Notes

- **Python implementation** should use CoolProp `PropsSI` interface for gas properties where available; Appendix B correlations serve as fallback or for web-based implementations.
- Temperature-dependent `Cp` values for purge gas should be evaluated at both `T_ads` and `T_reg`, then averaged.
- The `f_moisture` derating factor is optional and defaults to 1.0 if not specified.
- The `y_CO2_reg` parameter controls the regeneration residual and is a key sensitivity variable.
- `volumetric_flow` in Sections 10–11 is derived from `m_dot_exh / rho_exhaust` at inlet conditions.
- The purge energy bootstrapping in Section 8.4 uses a single-pass approximation. For high purge-to-total energy ratios (>20%), an iterative solution should be considered.
- Dynamic viscosity `mu` for exhaust gas is approximated as 1.8×10⁻⁵ Pa·s (N₂-dominated, ~350 K). Temperature-dependent correlation may be added in future versions.
- The post-HX exhaust temperature approximation (Section 5.1) should be replaced with HX effectiveness modeling when detailed HX sizing data becomes available.
