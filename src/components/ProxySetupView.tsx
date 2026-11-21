import { useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import { sendProxyTestCall } from '../lib/apiClient';
import type { ModelPricing } from '../types';

interface ProxySetupViewProps {
  proxyBaseUrl: string;
  pricingTable: ModelPricing[];
  onTestCompleted: () => Promise<void>;
}

export function ProxySetupView({
  proxyBaseUrl,
  pricingTable,
  onTestCompleted,
}: ProxySetupViewProps) {
  const [snippetTab, setSnippetTab] = useState<'node' | 'python' | 'curl'>('node');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Interactive test form state
  const [model, setModel] = useState('gpt-4o');
  const [sessionLabel, setSessionLabel] = useState('sess_live_demo');
  const [taskLabel, setTaskLabel] = useState('ticket-triage');
  const [prompt, setPrompt] = useState(
    'Classify ticket sentiment as positive, neutral, or negative and return JSON: "Login redirect hangs after SSO update."',
  );
  const [simulateUpstream, setSimulateUpstream] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    body: string;
  } | null>(null);

  const snippets: Record<'node' | 'python' | 'curl', string> = {
    node: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: '${proxyBaseUrl}',
  defaultHeaders: {
    'x-agent-session': 'sess_support_104',
    'x-agent-task': 'policy-lookup',
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is our enterprise refund policy?' }],
});`,
    python: `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_OPENAI_API_KEY",
    base_url="${proxyBaseUrl}",
    default_headers={
        "x-agent-session": "sess_support_104",
        "x-agent-task": "policy-lookup",
    },
)

res = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is our enterprise refund policy?"}],
)`,
    curl: `curl ${proxyBaseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "x-agent-session: sess_support_104" \\
  -H "x-agent-task: policy-lookup" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Classify sentiment as JSON: Fast support!"}]
  }'`,
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippets[snippetTab]);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningTest(true);
    setTestResult(null);
    try {
      const result = await sendProxyTestCall({
        model,
        prompt,
        sessionLabel,
        taskLabel,
        simulateUpstream,
        apiKey,
      });
      setTestResult(result);
      await onTestCompleted();
    } catch (err) {
      setTestResult({
        status: 500,
        body: err instanceof Error ? err.message : 'Request failed',
      });
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: SDK / Proxy integration */}
        <section className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A]">
                Point Your Agent at the Proxy
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Drop-in OpenAI-compatible endpoint. Responses are returned unchanged.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['node', 'python', 'curl'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSnippetTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    snippetTab === tab
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {tab === 'node' ? 'Node SDK' : tab === 'python' ? 'Python SDK' : 'cURL'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="relative bg-[#0F172A] rounded-lg p-4 overflow-x-auto">
              <button
                type="button"
                onClick={handleCopySnippet}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <pre className="font-mono text-xs text-slate-100 leading-relaxed pr-16">
                <code>{snippets[snippetTab]}</code>
              </pre>
            </div>

            <div className="mt-4 space-y-2 text-xs text-[#64748B]">
              <p>
                <strong className="font-semibold text-[#0F172A]">Optional Tagging Headers:</strong>{' '}
                Send <code className="font-mono text-[#0F172A]">x-agent-session</code> and{' '}
                <code className="font-mono text-[#0F172A]">x-agent-task</code> (or{' '}
                <code className="font-mono text-[#0F172A]">metadata.session</code> /{' '}
                <code className="font-mono text-[#0F172A]">metadata.task</code>) to power
                cost-per-task and cost-per-session attribution.
              </p>
              <p>
                <strong className="font-semibold text-[#0F172A]">Custom Upstream:</strong>{' '}
                Override the target provider per request with{' '}
                <code className="font-mono text-[#0F172A]">x-upstream-url</code> (defaults to{' '}
                <code className="font-mono text-[#0F172A]">UPSTREAM_BASE_URL</code> or OpenAI).
              </p>
            </div>
          </div>
        </section>

        {/* Right: Interactive Live Proxy Tester */}
        <section className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              Send a Test Call Through /v1/chat/completions
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Exercises the live proxy endpoint and logs cost, tokens, and waste flags immediately.
            </p>
          </div>

          <form onSubmit={handleSendTest} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-xs">
                <span className="font-medium text-[#0F172A]">Model</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-mono text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
                >
                  {pricingTable.map((p) => (
                    <option key={p.model} value={p.model}>
                      {p.model}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs">
                <span className="font-medium text-[#0F172A]">Session Tag</span>
                <input
                  type="text"
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg border border-[#E2E8F0] px-2.5 text-xs font-mono text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-[#0F172A]">Task Tag</span>
                <input
                  type="text"
                  value={taskLabel}
                  onChange={(e) => setTaskLabel(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg border border-[#E2E8F0] px-2.5 text-xs font-mono text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="font-medium text-[#0F172A]">User Prompt</span>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2.5 text-xs font-mono text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateUpstream}
                  onChange={(e) => setSimulateUpstream(e.target.checked)}
                  className="rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                />
                <span>Simulate upstream response (no API key needed)</span>
              </label>

              <button
                type="submit"
                disabled={runningTest}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{runningTest ? 'Sending...' : 'Send Proxy Request'}</span>
              </button>
            </div>

            {!simulateUpstream ? (
              <label className="block text-xs">
                <span className="font-medium text-[#0F172A]">
                  Bearer Token (optional if server env key is set)
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="mt-1 w-full h-9 rounded-lg border border-[#E2E8F0] px-2.5 text-xs font-mono text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
                />
              </label>
            ) : null}

            {testResult ? (
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#64748B]">Proxy Response</span>
                  <span
                    className={
                      testResult.status >= 200 && testResult.status < 300
                        ? 'text-[#059669] font-medium'
                        : 'text-[#EF4444] font-medium'
                    }
                  >
                    HTTP {testResult.status}
                  </span>
                </div>
                <pre className="p-3 text-[11px] font-mono text-[#0F172A] bg-white overflow-x-auto max-h-56">
                  <code>{testResult.body}</code>
                </pre>
              </div>
            ) : null}
          </form>
        </section>
      </div>

      {/* Pricing reference table */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-display text-base font-semibold text-[#0F172A]">
            Reference Model Pricing Table (USD per 1M tokens)
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Used to estimate per-call spend and compute downgrade savings.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] font-medium">
                <th className="py-2.5 px-5">Model</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3 text-right">Input / 1M</th>
                <th className="py-2.5 px-3 text-right">Output / 1M</th>
                <th className="py-2.5 px-5">Suggested Lightweight Alternative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pricingTable.map((row) => (
                <tr key={row.model} className="hover:bg-[#F8FAFC] h-9">
                  <td className="py-2 px-5 font-mono font-medium text-[#0F172A]">{row.model}</td>
                  <td className="py-2 px-3 text-[#64748B]">{row.provider}</td>
                  <td className="py-2 px-3 text-[#64748B]">{row.tier}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0F172A]">
                    ${row.inputPer1M.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0F172A]">
                    ${row.outputPer1M.toFixed(2)}
                  </td>
                  <td className="py-2 px-5 font-mono text-[#64748B]">
                    {row.recommendedDowngrade || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
