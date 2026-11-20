import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, Repeat, Search } from 'lucide-react';
import type { WasteCategory, WasteItem } from '../types';
import { formatRelativeTime, formatUsd } from '../utils/format';

interface WasteSectionProps {
  wasteItems: WasteItem[];
}

export function WasteSection({ wasteItems }: WasteSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | WasteCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (wasteItems[0]) initial[wasteItems[0].id] = true;
    return initial;
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = wasteItems.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.suggestion.toLowerCase().includes(q) ||
        item.tasksAffected.some((t) => t.toLowerCase().includes(q)) ||
        item.sessionsAffected.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const repeatedCount = wasteItems.filter((w) => w.category === 'repeated_prompt').length;
  const wrongModelCount = wasteItems.filter((w) => w.category === 'overprovisioned_model').length;

  return (
    <section
      aria-label="Detected Cost Waste"
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#0F172A]">
            Top Waste Opportunities
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Grouped near-identical prompts and frontier models running on short, simple tasks.
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter waste..."
              className="h-9 pl-8 pr-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#64748B] focus:bg-white focus:border-[#4F46E5] focus:outline-none w-44"
            />
          </div>

          <div
            role="tablist"
            aria-label="Waste category filter"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              All ({wasteItems.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'repeated_prompt'}
              onClick={() => setCategoryFilter('repeated_prompt')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === 'repeated_prompt'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Repeated ({repeatedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'overprovisioned_model'}
              onClick={() => setCategoryFilter('overprovisioned_model')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === 'overprovisioned_model'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Wrong Model ({wrongModelCount})
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-[#0F172A]">
            {wasteItems.length === 0
              ? 'No cost waste detected in the current logs.'
              : 'No waste items match your current filter.'}
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {wasteItems.length === 0
              ? 'Send requests through the proxy or inject a sample agent run to analyze repeated prompts and model sizing.'
              : 'Try clearing the search query or switching to All.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {filtered.map((item) => {
            const isExpanded = Boolean(expandedIds[item.id]);
            const isRepeat = item.category === 'repeated_prompt';

            return (
              <div key={item.id} className="bg-white">
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-5 py-4 hover:bg-[#F8FAFC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#4F46E5]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 text-[#64748B] shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            isRepeat ? 'text-[#EF4444]' : 'text-[#D97706]'
                          }`}
                        >
                          {isRepeat ? (
                            <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Cpu className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
                          )}
                          <span>
                            {isRepeat ? 'Repeated prompt' : 'Over-provisioned model'}
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[#64748B]">{item.model}</span>
                        {item.recommendedModel ? (
                          <>
                            <span className="text-slate-400" aria-hidden="true">
                              →
                            </span>
                            <span className="font-mono font-medium text-[#059669]">
                              {item.recommendedModel}
                            </span>
                          </>
                        ) : null}
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[#64748B] tabular-nums">
                          {item.occurrenceCount} calls
                        </span>
                        {item.avgSimilarity ? (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono text-[#64748B] tabular-nums">
                              {Math.round(item.avgSimilarity * 100)}% similarity
                            </span>
                          </>
                        ) : null}
                      </div>

                      <h3 className="mt-1 text-sm font-semibold text-[#0F172A] truncate">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#64748B] leading-relaxed max-w-3xl">
                        {item.suggestion}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center gap-1 pl-7 md:pl-0 shrink-0">
                    <span className="font-mono text-sm font-semibold text-[#10B981] tabular-nums whitespace-nowrap">
                      Save ~{formatUsd(item.estimatedSavingsUsd)} ({item.savingsPercent}%)
                    </span>
                    <span className="font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      of {formatUsd(item.totalSpendUsd)} spend
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="px-5 pb-4 pt-1 bg-[#F8FAFC] border-t border-slate-100">
                    <div className="pl-7">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-xs text-[#64748B]">
                        <span>
                          Avg tokens:{' '}
                          <strong className="font-mono font-medium text-[#0F172A] tabular-nums">
                            {item.avgPromptTokens} in / {item.avgCompletionTokens} out
                          </strong>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          Tasks:{' '}
                          <strong className="font-mono font-medium text-[#0F172A]">
                            {item.tasksAffected.join(', ') || 'unassigned'}
                          </strong>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          Sessions:{' '}
                          <strong className="font-mono font-medium text-[#0F172A]">
                            {item.sessionsAffected.join(', ') || 'unassigned'}
                          </strong>
                        </span>
                      </div>

                      <div className="mt-1 border border-[#E2E8F0] rounded-lg bg-white overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#E2E8F0] text-[#64748B] font-medium">
                              <th className="py-2 px-3">Prompt Preview</th>
                              <th className="py-2 px-3 whitespace-nowrap">Session / Task</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Tokens</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Cost</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">When</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.examples.map((ex) => (
                              <tr key={ex.logId} className="hover:bg-[#F8FAFC]">
                                <td className="py-2 px-3 text-[#0F172A] max-w-md truncate font-mono text-[11px]">
                                  {ex.promptPreview}
                                </td>
                                <td className="py-2 px-3 text-[#64748B] whitespace-nowrap font-mono text-[11px]">
                                  {ex.sessionLabel} / {ex.taskLabel}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                                  {ex.promptTokens} + {ex.completionTokens}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-[#0F172A] whitespace-nowrap">
                                  {formatUsd(ex.estimatedCostUsd)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                                  {formatRelativeTime(ex.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
