import type { ModelPricing } from '../src/types.ts';

export const MODEL_PRICING_TABLE: ModelPricing[] = [
  {
    model: 'gpt-4o',
    provider: 'OpenAI',
    tier: 'frontier',
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    recommendedDowngrade: 'gpt-4o-mini',
  },
  {
    model: 'gpt-4.1',
    provider: 'OpenAI',
    tier: 'frontier',
    inputPer1M: 2.0,
    outputPer1M: 8.0,
    recommendedDowngrade: 'gpt-4.1-mini',
  },
  {
    model: 'gpt-4-turbo',
    provider: 'OpenAI',
    tier: 'frontier',
    inputPer1M: 10.0,
    outputPer1M: 30.0,
    recommendedDowngrade: 'gpt-4o-mini',
  },
  {
    model: 'o1',
    provider: 'OpenAI',
    tier: 'frontier',
    inputPer1M: 15.0,
    outputPer1M: 60.0,
    recommendedDowngrade: 'o3-mini',
  },
  {
    model: 'o3-mini',
    provider: 'OpenAI',
    tier: 'standard',
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    recommendedDowngrade: 'gpt-4o-mini',
  },
  {
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    tier: 'lightweight',
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  {
    model: 'gpt-4.1-mini',
    provider: 'OpenAI',
    tier: 'lightweight',
    inputPer1M: 0.4,
    outputPer1M: 1.6,
  },
  {
    model: 'gpt-4.1-nano',
    provider: 'OpenAI',
    tier: 'lightweight',
    inputPer1M: 0.1,
    outputPer1M: 0.4,
  },
  {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'Anthropic',
    tier: 'frontier',
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    recommendedDowngrade: 'claude-3-5-haiku-20241022',
  },
  {
    model: 'claude-3-opus-20240229',
    provider: 'Anthropic',
    tier: 'frontier',
    inputPer1M: 15.0,
    outputPer1M: 75.0,
    recommendedDowngrade: 'claude-3-5-haiku-20241022',
  },
  {
    model: 'claude-3-5-haiku-20241022',
    provider: 'Anthropic',
    tier: 'lightweight',
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },
  {
    model: 'gemini-2.5-pro',
    provider: 'Google',
    tier: 'frontier',
    inputPer1M: 1.25,
    outputPer1M: 10.0,
    recommendedDowngrade: 'gemini-2.5-flash',
  },
  {
    model: 'gemini-2.5-flash',
    provider: 'Google',
    tier: 'lightweight',
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  {
    model: 'gemini-2.0-flash',
    provider: 'Google',
    tier: 'lightweight',
    inputPer1M: 0.1,
    outputPer1M: 0.4,
  },
];

const FALLBACK_PRICING: ModelPricing = {
  model: 'unknown',
  provider: 'Custom',
  tier: 'standard',
  inputPer1M: 1.0,
  outputPer1M: 3.0,
  recommendedDowngrade: 'gpt-4o-mini',
};

export function findModelPricing(modelName: string): ModelPricing {
  const normalized = (modelName || '').trim().toLowerCase();
  if (!normalized) {
    return FALLBACK_PRICING;
  }

  const exact = MODEL_PRICING_TABLE.find((entry) => entry.model.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }

  const prefixMatch = MODEL_PRICING_TABLE.find(
    (entry) => normalized.startsWith(entry.model.toLowerCase()) || entry.model.toLowerCase().startsWith(normalized),
  );
  if (prefixMatch) {
    return prefixMatch;
  }

  if (normalized.includes('mini') || normalized.includes('flash') || normalized.includes('haiku') || normalized.includes('nano')) {
    return {
      model: modelName,
      provider: 'Detected Lightweight',
      tier: 'lightweight',
      inputPer1M: 0.15,
      outputPer1M: 0.6,
    };
  }

  if (normalized.includes('opus') || normalized.includes('o1') || normalized.includes('pro') || normalized.includes('sonnet') || normalized.includes('gpt-4')) {
    return {
      model: modelName,
      provider: 'Detected Frontier',
      tier: 'frontier',
      inputPer1M: 3.0,
      outputPer1M: 12.0,
      recommendedDowngrade: 'gpt-4o-mini',
    };
  }

  return {
    ...FALLBACK_PRICING,
    model: modelName,
  };
}

export function estimateCallCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = findModelPricing(model);
  const inputCost = (Math.max(0, promptTokens) / 1_000_000) * pricing.inputPer1M;
  const outputCost = (Math.max(0, completionTokens) / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

export function estimateAlternativeCostUsd(
  targetModel: string,
  promptTokens: number,
  completionTokens: number,
): number {
  return estimateCallCostUsd(targetModel, promptTokens, completionTokens);
}
