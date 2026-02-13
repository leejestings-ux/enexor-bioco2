import { R, M_CO2, M_N2 } from './constants';

const SHOMATE = {
  CO2: { A: 24.99735, B: 55.18696, C: -33.69137, D: 7.948387, E: -0.136638 },
  N2: { A: 28.98641, B: 1.853978, C: -9.647459, D: 16.63537, E: 0.000117 },
} as const;

type Species = keyof typeof SHOMATE;

export function shomateCp(T: number, species: Species): number {
  const c = SHOMATE[species];
  const t = T / 1000;
  return c.A + c.B * t + c.C * t * t + c.D * t * t * t + c.E / (t * t);
}

export function cpMix(T: number, y_CO2: number): number {
  return y_CO2 * shomateCp(T, 'CO2') + (1 - y_CO2) * shomateCp(T, 'N2');
}

export function cpMixAvg(T1: number, T2: number, y_CO2: number): number {
  return (cpMix(T1, y_CO2) + cpMix(T2, y_CO2)) / 2;
}

export function idealGasDensity(T: number, P: number, M: number): number {
  return (P * M) / (R * T);
}

export function mixtureMolarMass(y_CO2: number): number {
  return y_CO2 * M_CO2 + (1 - y_CO2) * M_N2;
}
