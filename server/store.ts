import fs from 'node:fs';
import path from 'node:path';
import type { LlmCallLog, TrackerSettings } from '../src/types.ts';
import { createSeedLogs } from '../src/shared/seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let logsCache: LlmCallLog[] | null = null;
let settingsCache: TrackerSettings | null = null;

function persistLogs(logs: LlmCallLog[]): void {
  ensureDataDir();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
}

function persistSettings(settings: TrackerSettings): void {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

export function getLogs(): LlmCallLog[] {
  if (logsCache) return logsCache;
  ensureDataDir();
  if (!fs.existsSync(LOGS_FILE)) {
    const initial = createSeedLogs();
    logsCache = initial;
    persistLogs(initial);
    return logsCache;
  }
  try {
    const raw = fs.readFileSync(LOGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    logsCache = Array.isArray(parsed) ? (parsed as LlmCallLog[]) : [];
    return logsCache;
  } catch {
    logsCache = [];
    return logsCache;
  }
}

export function appendLog(entry: LlmCallLog): LlmCallLog {
  const logs = getLogs();
  logs.push(entry);
  persistLogs(logs);
  return entry;
}

export function updateLogLabels(
  id: string,
  updates: { sessionLabel?: string; taskLabel?: string },
): LlmCallLog | null {
  const logs = getLogs();
  const target = logs.find((l) => l.id === id);
  if (!target) return null;
  if (typeof updates.sessionLabel === 'string') {
    target.sessionLabel = updates.sessionLabel.trim() || 'unassigned';
  }
  if (typeof updates.taskLabel === 'string') {
    target.taskLabel = updates.taskLabel.trim() || 'unassigned';
  }
  persistLogs(logs);
  return target;
}

export function seedDemoLogs(mode: 'append' | 'replace' = 'append'): LlmCallLog[] {
  const fresh = createSeedLogs();
  const current = mode === 'replace' ? [] : getLogs();
  const next = [...current, ...fresh];
  logsCache = next;
  persistLogs(next);
  return next;
}

export function clearAllLogs(): void {
  logsCache = [];
  persistLogs([]);
}

export function getSettings(): TrackerSettings {
  if (settingsCache) return settingsCache;
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    settingsCache = { manualTaskCount: null, manualSessionCount: null };
    persistSettings(settingsCache);
    return settingsCache;
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TrackerSettings>;
    settingsCache = {
      manualTaskCount: typeof parsed.manualTaskCount === 'number' ? parsed.manualTaskCount : null,
      manualSessionCount:
        typeof parsed.manualSessionCount === 'number' ? parsed.manualSessionCount : null,
    };
    return settingsCache;
  } catch {
    settingsCache = { manualTaskCount: null, manualSessionCount: null };
    return settingsCache;
  }
}

export function updateSettings(updates: Partial<TrackerSettings>): TrackerSettings {
  const current = getSettings();
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
  settingsCache = next;
  persistSettings(next);
  return next;
}
