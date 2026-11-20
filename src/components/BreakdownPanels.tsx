import { useState } from 'react';
import type { ModelBreakdown, SessionBreakdown, TaskBreakdown } from '../types';
import { formatNumber, formatUsd } from '../utils/format';

interface BreakdownPanelsProps {
  sessions: SessionBreakdown[];
  tasks: TaskBreakdown[];
  models: ModelBreakdown[];
  activeSessionFilter: string;
  onSelectSession: (session: string) => void;
}

export function BreakdownPanels({
  sessions,
  tasks,
  models,
  activeSessionFilter,
  onSelectSession,
}: BreakdownPanelsProps) {
  const [tab, setTab] = useState<'sessions' | 'tasks'>('tasks');

  return (
    <section
      aria-label="Cost Breakdown"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
    >
      {/* Left 7 cols: Cost by Task / Session */}
      <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              Cost by {tab === 'tasks' ? 'Task' : 'Session'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {tab === 'tasks'
                ? 'Unit spend grouped by x-agent-task tag.'
                : 'Click any session row to isolate its calls and waste.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('tasks')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === 'tasks'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              By Task ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('sessions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === 'sessions'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              By Session ({sessions.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'tasks' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B] font-medium">
                  <th className="py-2.5 px-5">Task Label</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Calls</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Tokens</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Waste Est.</th>
                  <th className="py-2.5 px-5 text-right whitespace-nowrap">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No task spend recorded yet.
                    </td>
                  </tr>
                ) : (
                  tasks.map((row) => (
                    <tr key={row.taskLabel} className="hover:bg-[#F8FAFC] h-10">
                      <td className="py-2.5 px-5 font-mono font-medium text-[#0F172A]">
                        {row.taskLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748B]">
                        {row.callCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748B]">
                        {formatNumber(row.totalTokens)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {row.wasteSpendUsd > 0 ? (
                          <span className="text-[#D97706] font-medium">
                            {formatUsd(row.wasteSpendUsd)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-[#0F172A]">
                        {formatUsd(row.totalSpendUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B] font-medium">
                  <th className="py-2.5 px-5">Session Label</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Calls</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Tokens</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Waste Est.</th>
                  <th className="py-2.5 px-5 text-right whitespace-nowrap">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sessions.map((row) => {
                    const isSelected = activeSessionFilter === row.sessionLabel;
                    return (
                      <tr
                        key={row.sessionLabel}
                        onClick={() =>
                          onSelectSession(isSelected ? 'all' : row.sessionLabel)
                        }
                        className={`cursor-pointer transition-colors h-10 ${
                          isSelected ? 'bg-indigo-50/70' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="py-2.5 px-5">
                          <span className="font-mono font-medium text-[#0F172A]">
                            {row.sessionLabel}
                          </span>
                          <span className="ml-2 text-[#64748B] font-mono text-[11px]">
                            {row.taskLabels.slice(0, 2).join(', ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748B]">
                          {row.callCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748B]">
                          {formatNumber(row.totalTokens)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.wasteSpendUsd > 0 ? (
                            <span className="text-[#D97706] font-medium">
                              {formatUsd(row.wasteSpendUsd)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-[#0F172A]">
                          {formatUsd(row.totalSpendUsd)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right 5 cols: Spend by Model */}
      <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-display text-base font-semibold text-[#0F172A]">Spend by Model</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Distribution across frontier and lightweight tiers.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {models.length === 0 ? (
            <p className="text-xs text-[#64748B] text-center py-6">No model calls logged yet.</p>
          ) : (
            models.map((m) => (
              <div key={m.model}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <div className="min-w-0 truncate">
                    <span className="font-mono font-medium text-[#0F172A]">{m.model}</span>
                    <span className="text-slate-300 mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#64748B]">
                      {m.tier} · {m.callCount} {m.callCount === 1 ? 'call' : 'calls'}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums shrink-0">
                    <span className="font-semibold text-[#0F172A]">
                      {formatUsd(m.totalSpendUsd)}
                    </span>
                    <span className="text-[#64748B] ml-1.5">({m.sharePercent}%)</span>
                  </div>
                </div>
                <div className="mt-1.5 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      m.tier === 'lightweight'
                        ? 'bg-[#10B981]'
                        : m.tier === 'frontier'
                          ? 'bg-[#4F46E5]'
                          : 'bg-[#64748B]'
                    }`}
                    style={{ width: `${Math.max(3, m.sharePercent)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
