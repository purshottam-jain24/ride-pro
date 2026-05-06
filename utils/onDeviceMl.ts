import { mlModel, RFTree } from './mlModel';

/**
 * Pure-JS Random Forest evaluator. Walks each decision tree using the same
 * feature ordering produced by sklearn's training script (train_export.py).
 *
 * Trees are stored as parallel flat arrays — index 0 is the root, leaf nodes
 * are identified by `l[i] === -1`. This keeps the bundle ~80 KB rather than
 * megabytes of nested JSON.
 */

const FEATURE_INDEX = {
  distanceKm: 0,
  timeOfDayHour: 1,
  weather: 2,
  demandLevel: 3,
} as const;

export interface OnDeviceFactors {
  distanceKm: number;
  timeOfDayHour: number;
  weather: 'Clear' | 'Rain' | 'Storm' | 'Fog';
  demandLevel: 'Low' | 'Normal' | 'High' | 'Surge';
}

function evalTree(tree: RFTree, x: number[]): number {
  let i = 0;
  while (tree.l[i] !== -1) {
    if (x[tree.f[i]] <= tree.th[i]) i = tree.l[i];
    else i = tree.r[i];
  }
  return tree.v[i];
}

export function predictOnDevice(factors: OnDeviceFactors): number {
  const w = mlModel.weatherMap[factors.weather] ?? 0;
  const d = mlModel.demandMap[factors.demandLevel] ?? 1;
  const x = [factors.distanceKm, factors.timeOfDayHour, w, d];

  let total = 0;
  const trees = mlModel.trees;
  for (let i = 0; i < trees.length; i++) {
    total += evalTree(trees[i], x);
  }
  return total / trees.length;
}

export const onDeviceModelInfo = {
  trees: mlModel.trees.length,
  trainedAt: mlModel.trainedAt,
};
