import { useCallback, useEffect, useState } from 'react';
import { BreakdownPanels } from './components/BreakdownPanels';
import { KpiStrip } from './components/KpiStrip';
import { LogsView } from './components/LogsView';
import { ProxySetupView } from './components/ProxySetupView';
import { Sidebar, type ActiveNav } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WasteSection } from './components/WasteSection';
import type { DashboardSummary } from './types';

export default function App() {
  const [activeNav, setActiveNav] = useState<ActiveNav>('overview');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const proxyBaseUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/v1` : 'http://localhost:3000/v1';

  const fetchDashboard = useCallback(async (session: string) => {
    try {
      setErrorMsg(null);
      const query =
        session && session !== 'all' ? `?session=${encodeURIComponent(session)}` : '';
      const res = await fetch(`/api/dashboard${query}`);
      if (!res.ok) {
        throw new Error(`Dashboard API returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as DashboardSummary;
      setSummary(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(sessionFilter);
  }, [fetchDashboard, sessionFilter]);

  const handleInjectDemo = async () => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: summary && summary.totalCalls > 0 ? 'append' : 'replace' }),
      });
      if (!res.ok) throw new Error('Failed to inject sample agent run');
      setSessionFilter('all');
      await fetchDashboard('all');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to inject sample run');
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearLogs = async () => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/demo/clear', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to clear logs');
      setSessionFilter('all');
      await fetchDashboard('all');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to clear logs');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateCounts = async (updates: {
    manualTaskCount?: number | null;
    manualSessionCount?: number | null;
  }) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    await fetchDashboard(sessionFilter);
  };

  const handleUpdateLogTags = async (
    id: string,
    updates: { sessionLabel: string; taskLabel: string },
  ) => {
    const res = await fetch(`/api/logs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update log tags');
    await fetchDashboard(sessionFilter);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC] text-[#0F172A]">
      <Sidebar
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        totalCalls={summary?.totalCalls ?? 0}
        wasteCount={summary?.wasteItems.length ?? 0}
        proxyBaseUrl={proxyBaseUrl}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeNav={activeNav}
          sessionFilter={sessionFilter}
          availableSessions={summary?.availableSessions ?? []}
          onChangeSessionFilter={setSessionFilter}
          onInjectDemo={() => void handleInjectDemo()}
          onClearLogs={() => void handleClearLogs()}
          isBusy={isBusy}
          totalCalls={summary?.totalCalls ?? 0}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {errorMsg ? (
            <div className="bg-rose-50 border border-[#EF4444]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-xs text-rose-800">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => void fetchDashboard(sessionFilter)}
                className="font-medium underline hover:text-rose-950 whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          ) : null}

          {sessionFilter !== 'all' && activeNav !== 'setup' ? (
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-indigo-50 border border-[#4F46E5]/25 rounded-xl text-xs text-indigo-950">
              <span>
                Filtered to session <strong className="font-mono">{sessionFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSessionFilter('all')}
                className="font-medium text-[#4F46E5] hover:text-[#4338CA] underline whitespace-nowrap"
              >
                Show all sessions
              </button>
            </div>
          ) : null}

          {loading && !summary ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-[#E2E8F0] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8F0]">
                {[1, 2, 3, 4].map((slot) => (
                  <div key={slot} className="p-5 space-y-3">
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-7 w-28 bg-slate-200 rounded" />
                    <div className="h-3 w-36 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                <div className="h-4 w-44 bg-slate-200 rounded" />
                <div className="h-14 w-full bg-slate-100 rounded" />
                <div className="h-14 w-full bg-slate-100 rounded" />
              </div>
            </div>
          ) : summary ? (
            <>
              {activeNav === 'overview' ? (
                summary.totalCalls === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center max-w-2xl mx-auto">
                    <h2 className="font-display text-lg font-semibold text-[#0F172A]">
                      No LLM calls logged yet
                    </h2>
                    <p className="mt-2 text-sm text-[#64748B] leading-relaxed">
                      Point any OpenAI-compatible agent at{' '}
                      <code className="font-mono text-[#0F172A]">{proxyBaseUrl}</code>, or inject a
                      simulated multi-agent run to inspect repeated prompts, oversized models, and
                      cost-per-task metrics.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleInjectDemo()}
                        disabled={isBusy}
                        className="px-4 py-2 text-xs font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors"
                      >
                        Inject Sample Agent Run
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('setup')}
                        className="px-4 py-2 text-xs font-medium text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors"
                      >
                        Open Proxy Setup
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <KpiStrip
                      summary={summary}
                      onUpdateCounts={handleUpdateCounts}
                      isFilteredBySession={sessionFilter !== 'all'}
                    />
                    <WasteSection wasteItems={summary.wasteItems} />
                    <BreakdownPanels
                      sessions={summary.sessionBreakdowns}
                      tasks={summary.taskBreakdowns}
                      models={summary.modelBreakdowns}
                      activeSessionFilter={sessionFilter}
                      onSelectSession={setSessionFilter}
                    />
                  </>
                )
              ) : null}

              {activeNav === 'logs' ? (
                <LogsView logs={summary.logs} onUpdateLogTags={handleUpdateLogTags} />
              ) : null}

              {activeNav === 'setup' ? (
                <ProxySetupView
                  proxyBaseUrl={proxyBaseUrl}
                  pricingTable={summary.pricingTable}
                  onTestCompleted={() => fetchDashboard(sessionFilter)}
                />
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
