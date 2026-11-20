import { Plus, Trash2 } from 'lucide-react';
import type { ActiveNav } from './Sidebar';

interface TopBarProps {
  activeNav: ActiveNav;
  sessionFilter: string;
  availableSessions: string[];
  onChangeSessionFilter: (session: string) => void;
  onInjectDemo: () => void;
  onClearLogs: () => void;
  isBusy: boolean;
  totalCalls: number;
}

const VIEW_TITLES: Record<ActiveNav, string> = {
  overview: 'Cost & Waste Overview',
  logs: 'Intercepted Request Logs',
  setup: 'Proxy Setup & Live Test',
};

export function TopBar({
  activeNav,
  sessionFilter,
  availableSessions,
  onChangeSessionFilter,
  onInjectDemo,
  onClearLogs,
  isBusy,
  totalCalls,
}: TopBarProps) {
  return (
    <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 flex flex-wrap items-center justify-between gap-8">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm text-[#64748B] whitespace-nowrap">AgentLedger</span>
        <span className="text-slate-300" aria-hidden="true">
          /
        </span>
        <h1 className="font-display text-base font-semibold text-[#0F172A] truncate">
          {VIEW_TITLES[activeNav]}
        </h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {activeNav !== 'setup' && availableSessions.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="hidden sm:inline whitespace-nowrap">Session</span>
            <select
              value={sessionFilter}
              onChange={(e) => onChangeSessionFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
            >
              <option value="all">All sessions ({availableSessions.length})</option>
              {availableSessions.map((sess) => (
                <option key={sess} value={sess}>
                  {sess}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {totalCalls > 0 ? (
          <button
            type="button"
            onClick={onClearLogs}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] hover:text-[#EF4444] hover:bg-rose-50 border border-[#E2E8F0] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear Logs</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onInjectDemo}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Inject Sample Run</span>
        </button>
      </div>
    </header>
  );
}
