import type {
  DashboardSummary,
  LlmCallLog,
  ModelBreakdown,
  SessionBreakdown,
  TaskBreakdown,
  TrackerSettings,
  WasteExample,
  WasteItem,
} from '../types.ts';
import {
  MODEL_PRICING_TABLE,
  estimateAlternativeCostUsd,
  findModelPricing,
} from './pricing.ts';

export function extractPromptTextFromPayload(body: Record<string, unknown>): string {
  if (Array.isArray(body.messages)) {
    const parts: string[] = [];
    for (const msg of body.messages) {
      if (!msg || typeof msg !== 'object') continue;
      const role =
        typeof (msg as Record<string, unknown>).role === 'string'
          ? (msg as Record<string, unknown>).role
          : 'user';
      const content = (msg as Record<string, unknown>).content;
      if (typeof content === 'string') {
        if (role === 'system') continue;
        parts.push(content);
      } else if (Array.isArray(content)) {
        for (const item of content) {
          if (
            item &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).text === 'string'
          ) {
            parts.push((item as Record<string, unknown>).text as string);
          }
        }
      }
    }
    if (parts.length > 0) {
      return parts.join('\n').trim();
    }
    for (const msg of body.messages) {
      if (
        msg &&
        typeof msg === 'object' &&
        typeof (msg as Record<string, unknown>).content === 'string'
      ) {
        parts.push((msg as Record<string, unknown>).content as string);
      }
    }
    return parts.join('\n').trim();
  }

  if (typeof body.prompt === 'string') {
    return body.prompt.trim();
  }
  if (Array.isArray(body.prompt)) {
    return body.prompt.map((item) => String(item)).join('\n').trim();
  }
  return '';
}

export function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPromptPreview(text: string, maxLen = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '(empty prompt)';
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

// Pure-JS deterministic 12-char hex digest (works identically in Node and browser)
export function hashPrompt(normalizedPrompt: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalizedPrompt.length; i++) {
    const ch = normalizedPrompt.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`.slice(0, 12);
}

function getTokens(text: string): Set<string> {
  const tokens = text.split(' ').filter((w) => w.length > 1);
  return new Set(tokens);
}

function getBigrams(text: string): Set<string> {
  const compact = text.replace(/\s+/g, ' ');
  const bigrams = new Set<string>();
  if (compact.length < 2) {
    if (compact.length === 1) bigrams.add(compact);
    return bigrams;
  }
  for (let i = 0; i < compact.length - 1; i++) {
    bigrams.add(compact.slice(i, i + 2));
  }
  return bigrams;
}

export function computePromptSimilarity(normA: string, normB: string): number {
  if (!normA && !normB) return 1;
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const wordsA = getTokens(normA);
  const wordsB = getTokens(normB);
  let wordIntersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) wordIntersection++;
  }
  const wordUnion = wordsA.size + wordsB.size - wordIntersection;
  const jaccard = wordUnion > 0 ? wordIntersection / wordUnion : 0;

  const biA = getBigrams(normA);
  const biB = getBigrams(normB);
  let biIntersection = 0;
  for (const b of biA) {
    if (biB.has(b)) biIntersection++;
  }
  const dice = biA.size + biB.size > 0 ? (2 * biIntersection) / (biA.size + biB.size) : 0;

  return Number((0.6 * jaccard + 0.4 * dice).toFixed(3));
}

function isSimplePromptHeuristic(log: LlmCallLog): boolean {
  const totalSmall = log.promptTokens <= 180 && log.completionTokens <= 140;
  if (!totalSmall) return false;

  const simplePattern =
    /(classify|sentiment|extract|json|yes or no|true or false|summarize in one|categorize|intent|format|translate|is this|status|route|triage|hello|ping)/i;
  const wordCount = log.promptNormalized ? log.promptNormalized.split(' ').length : 0;
  return wordCount <= 55 || simplePattern.test(log.promptPreview);
}

export function detectRepeatedPromptWaste(logs: LlmCallLog[]): {
  items: WasteItem[];
  wasteByLogId: Map<string, number>;
} {
  const clusters: Array<{
    anchor: LlmCallLog;
    members: Array<{ log: LlmCallLog; similarity: number }>;
  }> = [];

  for (const log of logs) {
    if (!log.promptNormalized) continue;
    let matchedCluster: (typeof clusters)[number] | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = computePromptSimilarity(cluster.anchor.promptNormalized, log.promptNormalized);
      if (score >= 0.72 && score > bestScore) {
        bestScore = score;
        matchedCluster = cluster;
      }
    }

    if (matchedCluster) {
      matchedCluster.members.push({ log, similarity: bestScore });
    } else {
      clusters.push({
        anchor: log,
        members: [{ log, similarity: 1 }],
      });
    }
  }

  const items: WasteItem[] = [];
  const wasteByLogId = new Map<string, number>();

  for (const cluster of clusters) {
    if (cluster.members.length < 2) continue;

    const totalSpendUsd = cluster.members.reduce((sum, m) => sum + m.log.estimatedCostUsd, 0);
    const sortedByCost = [...cluster.members].sort(
      (a, b) => a.log.estimatedCostUsd - b.log.estimatedCostUsd,
    );
    const keepCost = sortedByCost[0].log.estimatedCostUsd;
    const estimatedSavingsUsd = Math.max(0, totalSpendUsd - keepCost);

    const avgSim =
      cluster.members.reduce((sum, m) => sum + m.similarity, 0) / cluster.members.length;
    const avgPromptTokens = Math.round(
      cluster.members.reduce((sum, m) => sum + m.log.promptTokens, 0) / cluster.members.length,
    );
    const avgCompletionTokens = Math.round(
      cluster.members.reduce((sum, m) => sum + m.log.completionTokens, 0) / cluster.members.length,
    );

    const sessionsAffected = Array.from(
      new Set(cluster.members.map((m) => m.log.sessionLabel).filter(Boolean)),
    );
    const tasksAffected = Array.from(
      new Set(cluster.members.map((m) => m.log.taskLabel).filter(Boolean)),
    );

    const primaryModel = cluster.anchor.model;
    const exactCount = cluster.members.filter((m) => m.similarity === 1).length;
    const similarityDescriptor =
      exactCount === cluster.members.length
        ? 'identical'
        : `${Math.round(avgSim * 100)}% similar`;

    const examples: WasteExample[] = cluster.members
      .slice()
      .sort((a, b) => b.log.timestamp.localeCompare(a.log.timestamp))
      .map((m) => ({
        logId: m.log.id,
        timestamp: m.log.timestamp,
        model: m.log.model,
        promptPreview: m.log.promptPreview,
        promptTokens: m.log.promptTokens,
        completionTokens: m.log.completionTokens,
        estimatedCostUsd: m.log.estimatedCostUsd,
        sessionLabel: m.log.sessionLabel,
        taskLabel: m.log.taskLabel,
        similarityScore: m.similarity,
      }));

    const chrono = [...cluster.members].sort((a, b) =>
      a.log.timestamp.localeCompare(b.log.timestamp),
    );
    for (let i = 1; i < chrono.length; i++) {
      const id = chrono[i].log.id;
      wasteByLogId.set(id, (wasteByLogId.get(id) ?? 0) + chrono[i].log.estimatedCostUsd);
    }

    const savingsPercent =
      totalSpendUsd > 0 ? Math.round((estimatedSavingsUsd / totalSpendUsd) * 100) : 0;

    items.push({
      id: `repeat-${cluster.anchor.promptHash}`,
      category: 'repeated_prompt',
      title: `Repeated prompt (${cluster.members.length}×): "${buildPromptPreview(cluster.anchor.promptPreview, 68)}"`,
      model: primaryModel,
      occurrenceCount: cluster.members.length,
      totalSpendUsd: Number(totalSpendUsd.toFixed(6)),
      estimatedSavingsUsd: Number(estimatedSavingsUsd.toFixed(6)),
      savingsPercent,
      suggestion: `Deduplicate or memoize this ${similarityDescriptor} lookup across ${sessionsAffected.length || 1} session${sessionsAffected.length === 1 ? '' : 's'}. Reusing the first result avoids ${cluster.members.length - 1} redundant LLM calls.`,
      avgSimilarity: Number(avgSim.toFixed(2)),
      avgPromptTokens,
      avgCompletionTokens,
      sessionsAffected,
      tasksAffected,
      examples,
    });
  }

  return { items, wasteByLogId };
}

export function detectWrongModelWaste(logs: LlmCallLog[]): {
  items: WasteItem[];
  wasteByLogId: Map<string, number>;
} {
  const groups = new Map<
    string,
    {
      model: string;
      recommendedModel: string;
      taskLabel: string;
      logs: LlmCallLog[];
    }
  >();

  for (const log of logs) {
    const pricing = findModelPricing(log.model);
    if (pricing.tier !== 'frontier') continue;
    if (!isSimplePromptHeuristic(log)) continue;

    const recommendedModel = pricing.recommendedDowngrade || 'gpt-4o-mini';
    const taskKey = log.taskLabel || 'untagged-task';
    const groupKey = `${log.model}::${taskKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        model: log.model,
        recommendedModel,
        taskLabel: taskKey,
        logs: [],
      });
    }
    groups.get(groupKey)!.logs.push(log);
  }

  const items: WasteItem[] = [];
  const wasteByLogId = new Map<string, number>();

  for (const [key, group] of groups.entries()) {
    const totalSpendUsd = group.logs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);
    let projectedAltSpend = 0;

    for (const l of group.logs) {
      const alt = estimateAlternativeCostUsd(
        group.recommendedModel,
        l.promptTokens,
        l.completionTokens,
      );
      projectedAltSpend += alt;
      const diff = Math.max(0, l.estimatedCostUsd - alt);
      wasteByLogId.set(l.id, (wasteByLogId.get(l.id) ?? 0) + diff);
    }

    const estimatedSavingsUsd = Math.max(0, totalSpendUsd - projectedAltSpend);
    if (estimatedSavingsUsd <= 0) continue;

    const avgPromptTokens = Math.round(
      group.logs.reduce((sum, l) => sum + l.promptTokens, 0) / group.logs.length,
    );
    const avgCompletionTokens = Math.round(
      group.logs.reduce((sum, l) => sum + l.completionTokens, 0) / group.logs.length,
    );
    const savingsPercent =
      totalSpendUsd > 0 ? Math.round((estimatedSavingsUsd / totalSpendUsd) * 100) : 0;

    const sessionsAffected = Array.from(
      new Set(group.logs.map((l) => l.sessionLabel).filter(Boolean)),
    );
    const tasksAffected = Array.from(
      new Set(group.logs.map((l) => l.taskLabel).filter(Boolean)),
    );

    const examples: WasteExample[] = group.logs
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((l) => ({
        logId: l.id,
        timestamp: l.timestamp,
        model: l.model,
        promptPreview: l.promptPreview,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        estimatedCostUsd: l.estimatedCostUsd,
        sessionLabel: l.sessionLabel,
        taskLabel: l.taskLabel,
      }));

    items.push({
      id: `model-${hashPrompt(key)}`,
      category: 'overprovisioned_model',
      title: `${group.model} on short "${group.taskLabel}" prompts (${group.logs.length}×)`,
      model: group.model,
      recommendedModel: group.recommendedModel,
      occurrenceCount: group.logs.length,
      totalSpendUsd: Number(totalSpendUsd.toFixed(6)),
      estimatedSavingsUsd: Number(estimatedSavingsUsd.toFixed(6)),
      savingsPercent,
      suggestion: `Switch "${group.taskLabel}" calls (avg ${avgPromptTokens} in / ${avgCompletionTokens} out tokens) from ${group.model} to ${group.recommendedModel} to cut cost by ~${savingsPercent}%.`,
      avgPromptTokens,
      avgCompletionTokens,
      sessionsAffected,
      tasksAffected,
      examples,
    });
  }

  return { items, wasteByLogId };
}

export function buildDashboardSummary(
  allLogs: LlmCallLog[],
  settings: TrackerSettings,
  allSessionsSource?: LlmCallLog[],
): DashboardSummary {
  const sortedLogs = [...allLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const sessionSource = allSessionsSource ?? sortedLogs;
  const availableSessions = Array.from(
    new Set(sessionSource.map((l) => l.sessionLabel.trim()).filter(Boolean)),
  ).sort();

  const totalSpendUsd = sortedLogs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);
  const totalCalls = sortedLogs.length;
  const totalTokens = sortedLogs.reduce((sum, l) => sum + l.totalTokens, 0);

  const distinctSessions = new Set(
    sortedLogs.map((l) => l.sessionLabel.trim()).filter((s) => s && s !== 'unassigned'),
  );
  const distinctTasks = new Set(
    sortedLogs.map((l) => l.taskLabel.trim()).filter((t) => t && t !== 'unassigned'),
  );

  const detectedSessionsCount = distinctSessions.size || (totalCalls > 0 ? 1 : 0);
  const detectedTasksCount = distinctTasks.size || (totalCalls > 0 ? 1 : 0);

  const effectiveSessionsCount =
    settings.manualSessionCount && settings.manualSessionCount > 0
      ? settings.manualSessionCount
      : detectedSessionsCount;
  const effectiveTasksCount =
    settings.manualTaskCount && settings.manualTaskCount > 0
      ? settings.manualTaskCount
      : detectedTasksCount;

  const costPerTaskUsd = effectiveTasksCount > 0 ? totalSpendUsd / effectiveTasksCount : 0;
  const costPerSessionUsd = effectiveSessionsCount > 0 ? totalSpendUsd / effectiveSessionsCount : 0;

  const repeated = detectRepeatedPromptWaste(sortedLogs);
  const wrongModel = detectWrongModelWaste(sortedLogs);

  const wasteItems = [...repeated.items, ...wrongModel.items].sort(
    (a, b) => b.estimatedSavingsUsd - a.estimatedSavingsUsd,
  );

  const combinedWasteByLog = new Map<string, number>();
  for (const log of sortedLogs) {
    const rWaste = repeated.wasteByLogId.get(log.id) ?? 0;
    const mWaste = wrongModel.wasteByLogId.get(log.id) ?? 0;
    const capped = Math.min(log.estimatedCostUsd, Math.max(rWaste, mWaste));
    if (capped > 0) {
      combinedWasteByLog.set(log.id, capped);
    }
  }

  let totalEstimatedSavingsUsd = 0;
  for (const val of combinedWasteByLog.values()) {
    totalEstimatedSavingsUsd += val;
  }
  const wasteSharePercent =
    totalSpendUsd > 0 ? Math.min(100, Math.round((totalEstimatedSavingsUsd / totalSpendUsd) * 100)) : 0;

  const sessionMap = new Map<string, SessionBreakdown>();
  for (const log of sortedLogs) {
    const key = log.sessionLabel || 'unassigned';
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        sessionLabel: key,
        taskLabels: [],
        callCount: 0,
        totalTokens: 0,
        totalSpendUsd: 0,
        avgCostPerCallUsd: 0,
        wasteSpendUsd: 0,
        lastSeen: log.timestamp,
      });
    }
    const entry = sessionMap.get(key)!;
    entry.callCount += 1;
    entry.totalTokens += log.totalTokens;
    entry.totalSpendUsd += log.estimatedCostUsd;
    entry.wasteSpendUsd += combinedWasteByLog.get(log.id) ?? 0;
    if (log.taskLabel && !entry.taskLabels.includes(log.taskLabel)) {
      entry.taskLabels.push(log.taskLabel);
    }
    if (log.timestamp > entry.lastSeen) {
      entry.lastSeen = log.timestamp;
    }
  }
  const sessionBreakdowns = Array.from(sessionMap.values())
    .map((s) => ({
      ...s,
      totalSpendUsd: Number(s.totalSpendUsd.toFixed(6)),
      wasteSpendUsd: Number(s.wasteSpendUsd.toFixed(6)),
      avgCostPerCallUsd: Number((s.totalSpendUsd / Math.max(1, s.callCount)).toFixed(6)),
    }))
    .sort((a, b) => b.totalSpendUsd - a.totalSpendUsd);

  const taskMap = new Map<
    string,
    {
      taskLabel: string;
      sessions: Set<string>;
      callCount: number;
      totalTokens: number;
      totalSpendUsd: number;
      wasteSpendUsd: number;
    }
  >();
  for (const log of sortedLogs) {
    const key = log.taskLabel || 'unassigned';
    if (!taskMap.has(key)) {
      taskMap.set(key, {
        taskLabel: key,
        sessions: new Set(),
        callCount: 0,
        totalTokens: 0,
        totalSpendUsd: 0,
        wasteSpendUsd: 0,
      });
    }
    const entry = taskMap.get(key)!;
    if (log.sessionLabel) entry.sessions.add(log.sessionLabel);
    entry.callCount += 1;
    entry.totalTokens += log.totalTokens;
    entry.totalSpendUsd += log.estimatedCostUsd;
    entry.wasteSpendUsd += combinedWasteByLog.get(log.id) ?? 0;
  }
  const taskBreakdowns: TaskBreakdown[] = Array.from(taskMap.values())
    .map((t) => ({
      taskLabel: t.taskLabel,
      sessionCount: t.sessions.size || 1,
      callCount: t.callCount,
      totalTokens: t.totalTokens,
      totalSpendUsd: Number(t.totalSpendUsd.toFixed(6)),
      avgCostPerCallUsd: Number((t.totalSpendUsd / Math.max(1, t.callCount)).toFixed(6)),
      wasteSpendUsd: Number(t.wasteSpendUsd.toFixed(6)),
    }))
    .sort((a, b) => b.totalSpendUsd - a.totalSpendUsd);

  const modelMap = new Map<string, ModelBreakdown>();
  for (const log of sortedLogs) {
    const key = log.model || 'unknown';
    const pricing = findModelPricing(key);
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        model: key,
        tier: pricing.tier,
        callCount: 0,
        totalTokens: 0,
        totalSpendUsd: 0,
        sharePercent: 0,
      });
    }
    const entry = modelMap.get(key)!;
    entry.callCount += 1;
    entry.totalTokens += log.totalTokens;
    entry.totalSpendUsd += log.estimatedCostUsd;
  }
  const modelBreakdowns = Array.from(modelMap.values())
    .map((m) => ({
      ...m,
      totalSpendUsd: Number(m.totalSpendUsd.toFixed(6)),
      sharePercent:
        totalSpendUsd > 0 ? Number(((m.totalSpendUsd / totalSpendUsd) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalSpendUsd - a.totalSpendUsd);

  return {
    totalSpendUsd: Number(totalSpendUsd.toFixed(6)),
    totalCalls,
    totalTokens,
    detectedTasksCount,
    detectedSessionsCount,
    effectiveTasksCount,
    effectiveSessionsCount,
    costPerTaskUsd: Number(costPerTaskUsd.toFixed(6)),
    costPerSessionUsd: Number(costPerSessionUsd.toFixed(6)),
    totalEstimatedSavingsUsd: Number(totalEstimatedSavingsUsd.toFixed(6)),
    wasteSharePercent,
    wasteItems,
    sessionBreakdowns,
    taskBreakdowns,
    modelBreakdowns,
    logs: sortedLogs,
    availableSessions,
    settings,
    pricingTable: MODEL_PRICING_TABLE,
  };
}
