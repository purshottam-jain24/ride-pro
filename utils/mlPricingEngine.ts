import { predictOnDevice, onDeviceModelInfo } from './onDeviceMl';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface PricingFactors {
  distanceKm: number;
  timeOfDayHour: number;
  weather: 'Clear' | 'Rain' | 'Storm' | 'Fog';
  demandLevel: 'Low' | 'Normal' | 'High' | 'Surge';
}

function buildExplanation(f: PricingFactors): string {
  const parts: string[] = [`Base rate for ${f.distanceKm.toFixed(1)} km.`];
  const adj: string[] = [];
  if ((f.timeOfDayHour >= 8 && f.timeOfDayHour <= 10) || (f.timeOfDayHour >= 17 && f.timeOfDayHour <= 20)) adj.push('Rush Hour');
  else if (f.timeOfDayHour >= 23 || f.timeOfDayHour <= 4) adj.push('Late Night');
  if (f.weather !== 'Clear') adj.push(`${f.weather} weather`);
  if (f.demandLevel !== 'Normal') adj.push(`${f.demandLevel} Demand`);
  if (adj.length) parts.push(`AI adjusted for: ${adj.join(', ')}.`);
  else parts.push('Standard conditions.');
  return parts.join(' ');
}

/**
 * Predict the ride price using a Random Forest trained on synthetic ride data
 * and exported to a TypeScript module. Runs entirely on-device — no network,
 * no Python server, works offline.
 */
export async function predictRidePrice(factors: PricingFactors): Promise<{ price: number; explanation: string; basePrice: number }> {
  const basePrice = Math.round(50 + factors.distanceKm * 15 + factors.distanceKm * 3 * 2);

  try {
    const predicted = predictOnDevice(factors);
    const price = Math.max(50, Math.round(predicted));
    return {
      price,
      basePrice,
      explanation: `${buildExplanation(factors)} (On-device ML · ${onDeviceModelInfo.trees}-tree forest)`,
    };
  } catch (e) {
    // Fall through to heuristic if the model bundle ever fails to evaluate
    console.warn('On-device ML failed, using heuristic fallback', e);
  }

  // Pure-JS heuristic fallback (matches the training-data formula)
  let p = basePrice;
  if ((factors.timeOfDayHour >= 8 && factors.timeOfDayHour <= 10) || (factors.timeOfDayHour >= 17 && factors.timeOfDayHour <= 20)) p *= 1.4;
  else if (factors.timeOfDayHour >= 23 || factors.timeOfDayHour <= 4) p *= 1.25;

  switch (factors.weather) {
    case 'Rain': p *= 1.3; break;
    case 'Storm': p *= 1.8; break;
    case 'Fog': p *= 1.2; break;
  }

  switch (factors.demandLevel) {
    case 'Low': p *= 0.85; break;
    case 'High': p *= 1.2; break;
    case 'Surge': p *= 1.6; break;
  }

  return {
    price: Math.max(50, Math.round(p)),
    basePrice,
    explanation: `${buildExplanation(factors)} (Heuristic fallback)`,
  };
}
