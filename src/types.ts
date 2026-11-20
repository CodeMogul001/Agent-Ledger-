export type WasteCategory = 'repeated_prompt' | 'overprovisioned_model';

export interface ModelPricing {
  model: string;
  provider: string;
  tier: 'frontier' | 'standard' | 'lightweight';
  inputPer1M: number;
  outputPer1M: number;
  recommendedDowngrade?: string;
}

export interface LlmCallLog {
  id: string;
  timestamp: string;
  model: string;
  endpoint: '/v1/chat/completions' | '/v1/completions';
  promptPreview: string;
  promptNormalized: string;
  promptHash: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  sessionLabel: string;
  taskLabel: string;
  latencyMs: number;
  statusCode: number;
  isSimulated: boolean;
}

export interface WasteExample {
  logId: string;
  timestamp: string;
  model: string;
  promptPreview: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  sessionLabel: string;
  taskLabel: string;
  similarityScore?: number;
}

export interface WasteItem {
  id: string;
  category: WasteCategory;
  title: string;
  model: string;
  recommendedModel?: string;
  occurrenceCount: number;
  totalSpendUsd: number;
  estimatedSavingsUsd: number;
  savingsPercent: number;
  suggestion: string;
  avgSimilarity?: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  sessionsAffected: string[];
  tasksAffected: string[];
  examples: WasteExample[];
}

export interface SessionBreakdown {
  sessionLabel: string;
  taskLabels: string[];
  callCount: number;
  totalTokens: number;
  totalSpendUsd: number;
  avgCostPerCallUsd: number;
  wasteSpendUsd: number;
  lastSeen: string;
}

export interface TaskBreakdown {
  taskLabel: string;
  sessionCount: number;
  callCount: number;
  totalTokens: number;
  totalSpendUsd: number;
  avgCostPerCallUsd: number;
  wasteSpendUsd: number;
}

export interface ModelBreakdown {
  model: string;
  tier: 'frontier' | 'standard' | 'lightweight';
  callCount: number;
  totalTokens: number;
  totalSpendUsd: number;
  sharePercent: number;
}

export interface TrackerSettings {
  manualTaskCount: number | null;
  manualSessionCount: number | null;
}

export interface DashboardSummary {
  totalSpendUsd: number;
  totalCalls: number;
  totalTokens: number;
  detectedTasksCount: number;
  detectedSessionsCount: number;
  effectiveTasksCount: number;
  effectiveSessionsCount: number;
  costPerTaskUsd: number;
  costPerSessionUsd: number;
  totalEstimatedSavingsUsd: number;
  wasteSharePercent: number;
  wasteItems: WasteItem[];
  sessionBreakdowns: SessionBreakdown[];
  taskBreakdowns: TaskBreakdown[];
  modelBreakdowns: ModelBreakdown[];
  logs: LlmCallLog[];
  availableSessions: string[];
  settings: TrackerSettings;
  pricingTable: ModelPricing[];
}
