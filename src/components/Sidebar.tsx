import { useState } from 'react';
import { BarChart3, Check, Copy, ListOrdered, Terminal } from 'lucide-react';

export type ActiveNav = 'overview' | 'logs' | 'setup';

interface SidebarProps {
  activeNav: ActiveNav;
  onSelectNav: (nav: ActiveNav) => void;
  totalCalls: number;
  wasteCount: number;
  proxyBaseUrl: string;
}

export function Sidebar({
  activeNav,
  onSelectNav,
  totalCalls,
  wasteCount,
  proxyBaseUrl,
}: SidebarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(proxyBaseUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const navItems: Array<{
    id: ActiveNav;
    label: string;
    icon: typeof BarChart3;
    meta?: string;
  }> = [
    {
      id: 'overview',
      label: 'Cost & Waste',
      icon: BarChart3,
      meta: wasteCount > 0 ? `${wasteCount} flags` : undefined,
    },
    {
      id: 'logs',
      label: 'Request Logs',
      icon: ListOrdered,
      meta: `${totalCalls}`,
    },
    {
      id: 'setup',
      label: 'Proxy Setup',
      icon: Terminal,
    },
  ];

  return (
    <aside className="w-full lg:w-60 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-white flex flex-col justify-between">
      <div className="p-4 lg:p-5">
        <div className="pb-5 mb-4 border-b border-slate-100">
          <span className="font-display text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
            AgentLedger
          </span>
          <p className="text-xs text-[#64748B] mt-1">LLM proxy &amp; waste monitor</p>
        </div>

        <nav className="flex lg:flex-col gap-1 overflow-x-auto" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5] ${
                  isActive
                    ? 'bg-indigo-50 text-[#4F46E5]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.meta ? (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-[#4F46E5]' : 'text-slate-400'
                    }`}
                  >
                    {item.meta}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:block p-4 border-t border-slate-100">
        <p className="text-xs font-medium text-[#0F172A] mb-1.5">Proxy Base URL</p>
        <div className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-1.5">
          <code className="font-mono text-xs text-[#0F172A] truncate" title={proxyBaseUrl}>
            {proxyBaseUrl}
          </code>
          <button
            type="button"
            onClick={handleCopyUrl}
            aria-label="Copy proxy base URL"
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded focus-visible:outline-2 focus-visible:outline-[#4F46E5] shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
          Point OpenAI SDK <code className="font-mono text-[#0F172A]">baseURL</code> here and tag{' '}
          <code className="font-mono text-[#0F172A]">x-agent-task</code>.
        </p>
      </div>
    </aside>
  );
}
