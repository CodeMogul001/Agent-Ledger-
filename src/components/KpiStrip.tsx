import { useState } from 'react';
import { Check, Pencil, RotateCcw } from 'lucide-react';
import type { DashboardSummary } from '../types';
import { formatNumber, formatUsd } from '../utils/format';

interface KpiStripProps {
  summary: DashboardSummary;
  onUpdateCounts: (updates: {
    manualTaskCount?: number | null;
    manualSessionCount?: number | null;
  }) => Promise<void>;
  isFilteredBySession: boolean;
}

export function KpiStrip({
  summary,
  onUpdateCounts,
  isFilteredBySession,
}: KpiStripProps) {
  const [editingField, setEditingField] = useState<'task' | 'session' | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (field: 'task' | 'session') => {
    setEditingField(field);
    const current =
      field === 'task' ? summary.effectiveTasksCount : summary.effectiveSessionsCount;
    setDraftValue(String(current || 1));
  };

  const commitEdit = async (field: 'task' | 'session') => {
    const parsed = Number.parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setEditingField(null);
      return;
    }
    setSaving(true);
    try {
      await onUpdateCounts(
        field === 'task'
          ? { manualTaskCount: parsed }
          : { manualSessionCount: parsed },
      );
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  };

  const resetAuto = async (field: 'task' | 'session') => {
    setSaving(true);
    try {
      await onUpdateCounts(
        field === 'task'
          ? { manualTaskCount: null }
          : { manualSessionCount: null },
      );
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  };

  const isManualTasks = !isFilteredBySession && summary.settings.manualTaskCount !== null;
  const isManualSessions = !isFilteredBySession && summary.settings.manualSessionCount !== null;

  return (
    <section
      aria-label="Key Cost Metrics"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-[#E2E8F0] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8F0] overflow-hidden"
    >
      {/* 1. Total AI Spend */}
      <div className="p-5">
        <p className="text-xs font-medium text-[#64748B]">Total AI Spend</p>
        <p className="mt-2 font-mono text-2xl font-semibold text-[#0F172A] tabular-nums">
          {formatUsd(summary.totalSpendUsd)}
        </p>
        <p className="mt-2 text-xs text-[#64748B] font-mono tabular-nums">
          {formatNumber(summary.totalCalls)} calls · {formatNumber(summary.totalTokens)} tokens
        </p>
      </div>

      {/* 2. AI Cost per Task */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#64748B]">AI Cost per Task</p>
          {!isFilteredBySession && editingField !== 'task' ? (
            <div className="flex items-center gap-1.5">
              {isManualTasks ? (
                <button
                  type="button"
                  onClick={() => void resetAuto('task')}
                  disabled={saving}
                  title="Revert to auto-detected task count"
                  className="text-xs text-[#64748B] hover:text-[#0F172A] p-0.5 rounded focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => startEdit('task')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5] hover:text-[#4338CA] rounded px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                <span>Set tasks</span>
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-2 font-mono text-2xl font-semibold text-[#0F172A] tabular-nums">
          {formatUsd(summary.costPerTaskUsd)}
        </p>

        {editingField === 'task' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void commitEdit('task');
            }}
            className="mt-2 flex items-center gap-1.5"
          >
            <input
              type="number"
              min={1}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              aria-label="Number of tasks"
              className="w-20 h-7 px-2 text-xs font-mono border border-[#E2E8F0] rounded focus:border-[#4F46E5] focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium bg-[#4F46E5] text-white rounded hover:bg-[#4338CA]"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingField(null)}
              className="h-7 px-2 text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-[#64748B] font-mono tabular-nums">
            {formatNumber(summary.effectiveTasksCount)}{' '}
            {summary.effectiveTasksCount === 1 ? 'task' : 'tasks'} ·{' '}
            {isManualTasks ? 'manual count' : 'auto-tagged'}
          </p>
        )}
      </div>

      {/* 3. AI Cost per Session */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#64748B]">AI Cost per Session</p>
          {!isFilteredBySession && editingField !== 'session' ? (
            <div className="flex items-center gap-1.5">
              {isManualSessions ? (
                <button
                  type="button"
                  onClick={() => void resetAuto('session')}
                  disabled={saving}
                  title="Revert to auto-detected session count"
                  className="text-xs text-[#64748B] hover:text-[#0F172A] p-0.5 rounded focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => startEdit('session')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5] hover:text-[#4338CA] rounded px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-[#4F46E5]"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                <span>Set sessions</span>
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-2 font-mono text-2xl font-semibold text-[#0F172A] tabular-nums">
          {formatUsd(summary.costPerSessionUsd)}
        </p>

        {editingField === 'session' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void commitEdit('session');
            }}
            className="mt-2 flex items-center gap-1.5"
          >
            <input
              type="number"
              min={1}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              aria-label="Number of sessions"
              className="w-20 h-7 px-2 text-xs font-mono border border-[#E2E8F0] rounded focus:border-[#4F46E5] focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium bg-[#4F46E5] text-white rounded hover:bg-[#4338CA]"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingField(null)}
              className="h-7 px-2 text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-[#64748B] font-mono tabular-nums">
            {formatNumber(summary.effectiveSessionsCount)}{' '}
            {summary.effectiveSessionsCount === 1 ? 'session' : 'sessions'} ·{' '}
            {isManualSessions ? 'manual count' : 'auto-tagged'}
          </p>
        )}
      </div>

      {/* 4. Recoverable Waste */}
      <div className="p-5">
        <p className="text-xs font-medium text-[#64748B]">Estimated Recoverable Waste</p>
        <p
          className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
            summary.totalEstimatedSavingsUsd > 0 ? 'text-[#10B981]' : 'text-[#0F172A]'
          }`}
        >
          {formatUsd(summary.totalEstimatedSavingsUsd)}
        </p>
        <p className="mt-2 text-xs text-[#64748B] font-mono tabular-nums">
          {summary.wasteSharePercent}% of spend · {summary.wasteItems.length}{' '}
          {summary.wasteItems.length === 1 ? 'opportunity' : 'opportunities'}
        </p>
      </div>
    </section>
  );
}
