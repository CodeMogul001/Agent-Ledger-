import {
  buildDashboardSummary,
  buildPromptPreview,
  hashPrompt,
  normalizePrompt,
} from '../shared/analysis.ts';
import { estimateCallCostUsd } from '../shared/pricing.ts';
import { createSeedLogs, generateCallId } from '../shared/seedData.ts';
import type { DashboardSummary, LlmCallLog, TrackerSettings } from '../types.ts';

const LOGS_STORAGE_KEY = 'agentledger_logs_v1';
const SETTINGS_STORAGE_KEY = 'agentledger_settings_v1';
const INITIALIZED_STORAGE_KEY = 'agentledger_initialized_v1';

let backendUnavailable = false;

function readLocalLogs(): LlmCallLog[] {
  try {
    const initialized = localStorage.getItem(INITIALIZED_STORAGE_KEY);
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!initialized && raw === null) {
      const seeded = createSeedLogs();
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(INITIALIZED_STORAGE_KEY, '1');
      return seeded;
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LlmCallLog[]) : [];
  } catch {
    return [];
  }
}

function writeLocalLogs(logs: LlmCallLog[]): void {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    localStorage.setItem(INITIALIZED_STORAGE_KEY, '1');
  } catch {
    // Ignore storage quota issues
  }
}

function readLocalSettings(): TrackerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { manualTaskCount: null, manualSessionCount: null };
    const parsed = JSON.parse(raw) as Partial<TrackerSettings>;
    return {
      manualTaskCount: typeof parsed.manualTaskCount === 'number' ? parsed.manualTaskCount : null,
      manualSessionCount:
        typeof parsed.manualSessionCount === 'number' ? parsed.manualSessionCount : null,
    };
  } catch {
    return { manualTaskCount: null, manualSessionCount: null };
  }
}

function writeLocalSettings(settings: TrackerSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues
  }
}

function buildLocalSummary(sessionFilter: string): DashboardSummary {
  const allLogs = readLocalLogs();
  const settings = readLocalSettings();
  const filtered =
    sessionFilter && sessionFilter !== 'all'
      ? allLogs.filter((l) => l.sessionLabel === sessionFilter)
      : allLogs;
  return buildDashboardSummary(filtered, settings, allLogs);
}

function isMissingBackendResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  if (res.status === 404 || res.status === 405) return true;
  if (res.ok && !contentType.includes('application/json')) return true;
  return false;
}

export async function fetchDashboardSummary(sessionFilter: string): Promise<DashboardSummary> {
  if (!backendUnavailable) {
    try {
      const query =
        sessionFilter && sessionFilter !== 'all'
          ? `?session=${encodeURIComponent(sessionFilter)}`
          : '';
      const res = await fetch(`/api/dashboard${query}`);
      if (!isMissingBackendResponse(res)) {
        if (!res.ok) {
          throw new Error(`Dashboard API returned HTTP ${res.status}`);
        }
        return (await res.json()) as DashboardSummary;
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }
  return buildLocalSummary(sessionFilter);
}

export async function injectSampleAgentRun(mode: 'append' | 'replace'): Promise<DashboardSummary> {
  if (!backendUnavailable) {
    try {
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!isMissingBackendResponse(res)) {
        if (!res.ok) {
          throw new Error('Failed to inject sample agent run');
        }
        return (await res.json()) as DashboardSummary;
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  const fresh = createSeedLogs();
  const current = mode === 'replace' ? [] : readLocalLogs();
  writeLocalLogs([...current, ...fresh]);
  return buildLocalSummary('all');
}

export async function clearDemoLogs(): Promise<DashboardSummary> {
  if (!backendUnavailable) {
    try {
      const res = await fetch('/api/demo/clear', { method: 'POST' });
      if (!isMissingBackendResponse(res)) {
        if (!res.ok) {
          throw new Error('Failed to clear logs');
        }
        return (await res.json()) as DashboardSummary;
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  writeLocalLogs([]);
  return buildLocalSummary('all');
}

export async function updateTrackerSettings(updates: {
  manualTaskCount?: number | null;
  manualSessionCount?: number | null;
}): Promise<TrackerSettings> {
  if (!backendUnavailable) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!isMissingBackendResponse(res)) {
        if (!res.ok) {
          throw new Error('Failed to update settings');
        }
        return (await res.json()) as TrackerSettings;
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  const current = readLocalSettings();
  const next: TrackerSettings = {
    manualTaskCount:
      updates.manualTaskCount === null
        ? null
        : typeof updates.manualTaskCount === 'number' && updates.manualTaskCount > 0
          ? Math.floor(updates.manualTaskCount)
          : current.manualTaskCount,
    manualSessionCount:
      updates.manualSessionCount === null
        ? null
        : typeof updates.manualSessionCount === 'number' && updates.manualSessionCount > 0
          ? Math.floor(updates.manualSessionCount)
          : current.manualSessionCount,
  };
  writeLocalSettings(next);
  return next;
}

export async function updateLogTags(
  id: string,
  updates: { sessionLabel: string; taskLabel: string },
): Promise<void> {
  if (!backendUnavailable) {
    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!isMissingBackendResponse(res)) {
        if (!res.ok) {
          throw new Error('Failed to update log tags');
        }
        return;
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  const logs = readLocalLogs();
  const target = logs.find((l) => l.id === id);
  if (target) {
    target.sessionLabel = updates.sessionLabel.trim() || 'unassigned';
    target.taskLabel = updates.taskLabel.trim() || 'unassigned';
    writeLocalLogs(logs);
  }
}

export async function sendProxyTestCall(params: {
  model: string;
  prompt: string;
  sessionLabel: string;
  taskLabel: string;
  simulateUpstream: boolean;
  apiKey: string;
}): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-agent-session': params.sessionLabel.trim() || 'unassigned',
    'x-agent-task': params.taskLabel.trim() || 'unassigned',
  };
  if (params.simulateUpstream) {
    headers['x-proxy-simulate'] = 'true';
  } else if (params.apiKey.trim()) {
    headers.Authorization = `Bearer ${params.apiKey.trim()}`;
  }

  if (!backendUnavailable) {
    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: params.model,
          messages: [{ role: 'user', content: params.prompt }],
        }),
      });
      if (!isMissingBackendResponse(res)) {
        const text = await res.text();
        let formatted = text;
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          // Keep raw text
        }
        return { status: res.status, body: formatted };
      }
      backendUnavailable = true;
    } catch (err) {
      if (err instanceof TypeError) {
        backendUnavailable = true;
      } else {
        throw err;
      }
    }
  }

  if (!params.simulateUpstream) {
    return {
      status: 503,
      body: JSON.stringify(
        {
          error: {
            message:
              'Live upstream proxy forwarding requires the Express backend server (npm run dev or npm run start). Enable "Simulate upstream response" to test locally in static preview mode.',
            type: 'proxy_unavailable',
          },
        },
        null,
        2,
      ),
    };
  }

  const promptTokens = Math.max(12, Math.ceil(params.prompt.length / 4));
  const completionText =
    params.prompt.length < 160
      ? '{"status":"ok","summary":"Simulated proxy response for lightweight task verification."}'
      : 'Simulated OpenAI-compatible proxy response logged for cost and waste inspection.';
  const completionTokens = Math.max(14, Math.ceil(completionText.length / 4));
  const totalTokens = promptTokens + completionTokens;
  const promptNormalized = normalizePrompt(params.prompt);

  const logs = readLocalLogs();
  logs.push({
    id: generateCallId(),
    timestamp: new Date().toISOString(),
    model: params.model,
    endpoint: '/v1/chat/completions',
    promptPreview: buildPromptPreview(params.prompt),
    promptNormalized,
    promptHash: hashPrompt(promptNormalized),
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateCallCostUsd(params.model, promptTokens, completionTokens),
    sessionLabel: params.sessionLabel.trim() || 'unassigned',
    taskLabel: params.taskLabel.trim() || 'unassigned',
    latencyMs: 140 + Math.floor(Math.random() * 180),
    statusCode: 200,
    isSimulated: true,
  });
  writeLocalLogs(logs);

  const payload = {
    id: `chatcmpl-${generateCallId().slice(5)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: completionText },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  };
  return { status: 200, body: JSON.stringify(payload, null, 2) };
}
