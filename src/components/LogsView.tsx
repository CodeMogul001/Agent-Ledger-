import { useState } from 'react';
import { Check, Pencil, Search, X } from 'lucide-react';
import type { LlmCallLog } from '../types';
import { formatNumber, formatShortTime, formatUsd } from '../utils/format';

interface LogsViewProps {
  logs: LlmCallLog[];
  onUpdateLogTags: (
    id: string,
    updates: { sessionLabel: string; taskLabel: string },
  ) => Promise<void>;
}

export function LogsView({ logs, onUpdateLogTags }: LogsViewProps) {
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftSession, setDraftSession] = useState('');
  const [draftTask, setDraftTask] = useState('');
  const [saving, setSaving] = useState(false);

  const models = Array.from(new Set(logs.map((l) => l.model))).sort();

  const filtered = logs.filter((log) => {
    if (modelFilter !== 'all' && log.model !== modelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.promptPreview.toLowerCase().includes(q) ||
        log.sessionLabel.toLowerCase().includes(q) ||
        log.taskLabel.toLowerCase().includes(q) ||
        log.model.toLowerCase().includes(q) ||
        log.promptHash.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const startEditing = (log: LlmCallLog) => {
    setEditingId(log.id);
    setDraftSession(log.sessionLabel);
    setDraftTask(log.taskLabel);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await onUpdateLogTags(id, {
        sessionLabel: draftSession.trim() || 'unassigned',
        taskLabel: draftTask.trim() || 'unassigned',
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="Intercepted Request Logs"
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#0F172A]">
            All Intercepted Calls
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Prompt previews, SHA-256 hashes, token usage, and inline session/task tagging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompt, hash, tag..."
              className="h-9 pl-8 pr-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#64748B] focus:bg-white focus:border-[#4F46E5] focus:outline-none w-56"
            />
          </div>

          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            aria-label="Filter by model"
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="all">All models ({models.length})</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[#64748B] font-medium bg-[#F8FAFC]">
              <th className="py-2.5 px-4 whitespace-nowrap">Time</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Model</th>
              <th className="py-2.5 px-3">Prompt Preview &amp; Hash</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Session / Task</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Tokens (In/Out)</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Latency</th>
              <th className="py-2.5 px-4 text-right whitespace-nowrap">Est. Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748B]">
                  {logs.length === 0
                    ? 'No LLM calls have been logged yet. Inject a sample run or send a request to /v1/chat/completions.'
                    : 'No calls match the active search or model filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const isEditing = editingId === log.id;
                return (
                  <tr key={log.id} className="hover:bg-[#F8FAFC] align-top">
                    <td className="py-3 px-4 font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                      {formatShortTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono font-medium text-[#0F172A]">{log.model}</span>
                      <div className="font-mono text-[11px] text-[#64748B]">
                        {log.statusCode} · {log.isSimulated ? 'sample' : 'proxied'}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-md">
                      <p className="text-[#0F172A] leading-snug line-clamp-2">
                        {log.promptPreview}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[#64748B]">
                        sha256:{log.promptHash}
                      </p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5 min-w-44">
                          <input
                            type="text"
                            value={draftSession}
                            onChange={(e) => setDraftSession(e.target.value)}
                            placeholder="session"
                            aria-label="Session label"
                            className="h-7 px-2 text-xs font-mono border border-[#E2E8F0] rounded focus:border-[#4F46E5] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={draftTask}
                            onChange={(e) => setDraftTask(e.target.value)}
                            placeholder="task"
                            aria-label="Task label"
                            className="h-7 px-2 text-xs font-mono border border-[#E2E8F0] rounded focus:border-[#4F46E5] focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleSave(log.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#4F46E5] text-white rounded hover:bg-[#4338CA]"
                            >
                              <Check className="w-3 h-3" aria-hidden="true" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-[#64748B] hover:text-[#0F172A]"
                            >
                              <X className="w-3 h-3" aria-hidden="true" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2 group">
                          <div className="font-mono text-[11px]">
                            <div className="text-[#0F172A]">{log.sessionLabel}</div>
                            <div className="text-[#64748B]">{log.taskLabel}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditing(log)}
                            title="Edit session and task tags"
                            className="text-[#64748B] hover:text-[#4F46E5] p-1 rounded opacity-75 group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                      <span>{formatNumber(log.totalTokens)}</span>
                      <div className="text-[11px] text-[#64748B]/80">
                        {formatNumber(log.promptTokens)} / {formatNumber(log.completionTokens)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                      {log.latencyMs}ms
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F172A] whitespace-nowrap">
                      {formatUsd(log.estimatedCostUsd)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
