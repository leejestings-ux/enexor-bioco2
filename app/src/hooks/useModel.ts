import { useMemo } from 'react';
import { runModel } from '../model/engine';
import type { ModelInputs, ModelOutputs } from '../model/types';

export function useModel(inputs: ModelInputs): ModelOutputs | { error: string } {
  return useMemo(() => {
    try {
      return runModel(inputs);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [inputs]);
}
