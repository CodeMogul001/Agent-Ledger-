import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import {
  buildDashboardSummary,
  buildPromptPreview,
  extractPromptTextFromPayload,
  hashPrompt,
  normalizePrompt,
} from './server/analysis.ts';
import { MODEL_PRICING_TABLE, estimateCallCostUsd } from './server/pricing.ts';
import {
  appendLog,
  clearAllLogs,
  getLogs,
  getSettings,
  seedDemoLogs,
  updateLogLabels,
  updateSettings,
} from './server/store.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function firstHeader(req: Request, names: string[]): string {
  for (const name of names) {
    const val = req.headers[name];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
    if (Array.isArray(val) && val[0]?.trim()) {
      return val[0].trim();
    }
  }
  return '';
}

function extractLabels(req: Request, body: Record<string, unknown>): {
  sessionLabel: string;
  taskLabel: string;
} {
  const meta =
    body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {};

  const sessionLabel =
    firstHeader(req, ['x-agent-session', 'x-session-id']) ||
    (typeof meta.session === 'string' && meta.session.trim()) ||
    (typeof meta.session_id === 'string' && meta.session_id.trim()) ||
    (typeof body.user === 'string' && body.user.trim()) ||
    'unassigned';

  const taskLabel =
    firstHeader(req, ['x-agent-task', 'x-task-id']) ||
    (typeof meta.task === 'string' && meta.task.trim()) ||
    (typeof meta.task_id === 'string' && meta.task_id.trim()) ||
    'unassigned';

  return { sessionLabel, taskLabel };
}

function resolveUpstreamTarget(
  req: Request,
  model: string,
): { baseUrl: string; authHeader: string } {
  const customUpstream = firstHeader(req, ['x-upstream-url']);
  const callerAuth = firstHeader(req, ['authorization']);

  const envUpstream = (process.env.UPSTREAM_BASE_URL || '').trim().replace(/\/+$/, '');
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

  let baseUrl = customUpstream ? customUpstream.replace(/\/+$/, '') : envUpstream || 'https://api.openai.com/v1';
  let authHeader = callerAuth;

  if (!authHeader) {
    const isGeminiModel = model.toLowerCase().startsWith('gemini');
    if ((isGeminiModel || !openAiKey) && geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      authHeader = `Bearer ${geminiKey}`;
      if (!customUpstream && (!envUpstream || envUpstream === 'https://api.openai.com/v1')) {
        baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
      }
    } else if (openAiKey) {
      authHeader = `Bearer ${openAiKey}`;
    }
  }

  return { baseUrl, authHeader };
}

function approximateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

async function handleProxyRequest(
  req: Request,
  res: Response,
  endpoint: '/v1/chat/completions' | '/v1/completions',
): Promise<void> {
  const startTime = Date.now();
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'gpt-4o-mini';

  const rawPrompt = extractPromptTextFromPayload(body);
  const promptNormalized = normalizePrompt(rawPrompt);
  const promptPreview = buildPromptPreview(rawPrompt);
  const promptHash = hashPrompt(promptNormalized);
  const { sessionLabel, taskLabel } = extractLabels(req, body);

  const simulateMode = firstHeader(req, ['x-proxy-simulate']) === 'true';

  if (simulateMode) {
    const promptTokens = Math.max(12, approximateTokens(rawPrompt));
    const completionText =
      rawPrompt.length < 160
        ? '{"status":"ok","summary":"Simulated proxy response for lightweight task verification."}'
        : 'Simulated OpenAI-compatible proxy response logged for cost and waste inspection.';
    const completionTokens = Math.max(14, approximateTokens(completionText));
    const totalTokens = promptTokens + completionTokens;
    const latencyMs = 140 + Math.floor(Math.random() * 180);

    const responsePayload =
      endpoint === '/v1/chat/completions'
        ? {
            id: `chatcmpl-${crypto.randomBytes(6).toString('hex')}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: completionText,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
            },
          }
        : {
            id: `cmpl-${crypto.randomBytes(6).toString('hex')}`,
            object: 'text_completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                text: completionText,
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
            },
          };

    appendLog({
      id: `call_${crypto.randomBytes(5).toString('hex')}`,
      timestamp: new Date().toISOString(),
      model,
      endpoint,
      promptPreview,
      promptNormalized,
      promptHash,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateCallCostUsd(model, promptTokens, completionTokens),
      sessionLabel,
      taskLabel,
      latencyMs,
      statusCode: 200,
      isSimulated: true,
    });

    res.status(200).json(responsePayload);
    return;
  }

  const { baseUrl, authHeader } = resolveUpstreamTarget(req, model);
  if (!authHeader) {
    res.status(401).json({
      error: {
        message:
          'No Authorization header provided and no OPENAI_API_KEY or GEMINI_API_KEY configured on the proxy server.',
        type: 'authentication_error',
        code: 'missing_api_key',
      },
    });
    return;
  }

  const upstreamPath = endpoint.replace(/^\/v1/, '');
  const targetUrl = `${baseUrl}${upstreamPath}`;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';

    // Handle SSE streaming passthrough while logging tokens
    if (body.stream === true && contentType.includes('text/event-stream') && upstreamResponse.body) {
      res.status(upstreamResponse.status);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let usagePromptTokens = 0;
      let usageCompletionTokens = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(value);
        const chunkStr = decoder.decode(value, { stream: true });
        for (const line of chunkStr.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr) as Record<string, unknown>;
            if (Array.isArray(parsed.choices)) {
              const delta = (parsed.choices[0] as Record<string, unknown> | undefined)?.delta as
                | Record<string, unknown>
                | undefined;
              if (delta && typeof delta.content === 'string') {
                accumulatedText += delta.content;
              }
            }
            if (parsed.usage && typeof parsed.usage === 'object') {
              const u = parsed.usage as Record<string, unknown>;
              if (typeof u.prompt_tokens === 'number') usagePromptTokens = u.prompt_tokens;
              if (typeof u.completion_tokens === 'number') usageCompletionTokens = u.completion_tokens;
            }
          } catch {
            // Ignore partial JSON frames across chunk boundaries
          }
        }
      }
      res.end();

      const promptTokens = usagePromptTokens || approximateTokens(rawPrompt);
      const completionTokens = usageCompletionTokens || approximateTokens(accumulatedText);
      const totalTokens = promptTokens + completionTokens;

      appendLog({
        id: `call_${crypto.randomBytes(5).toString('hex')}`,
        timestamp: new Date().toISOString(),
        model,
        endpoint,
        promptPreview,
        promptNormalized,
        promptHash,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: estimateCallCostUsd(model, promptTokens, completionTokens),
        sessionLabel,
        taskLabel,
        latencyMs: Date.now() - startTime,
        statusCode: upstreamResponse.status,
        isSimulated: false,
      });
      return;
    }

    // Standard JSON response passthrough
    const rawResponseText = await upstreamResponse.text();
    let parsedJson: Record<string, unknown> | null = null;
    try {
      parsedJson = JSON.parse(rawResponseText) as Record<string, unknown>;
    } catch {
      parsedJson = null;
    }

    const usage =
      parsedJson && parsedJson.usage && typeof parsedJson.usage === 'object'
        ? (parsedJson.usage as Record<string, unknown>)
        : null;

    let promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
    let completionTokens =
      typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0;

    if (!promptTokens && upstreamResponse.ok) {
      promptTokens = approximateTokens(rawPrompt);
    }
    if (!completionTokens && upstreamResponse.ok && parsedJson && Array.isArray(parsedJson.choices)) {
      const firstChoice = parsedJson.choices[0] as Record<string, unknown> | undefined;
      const msg = firstChoice?.message as Record<string, unknown> | undefined;
      const outputText =
        (typeof msg?.content === 'string' && msg.content) ||
        (typeof firstChoice?.text === 'string' && firstChoice.text) ||
        '';
      completionTokens = approximateTokens(outputText);
    }

    const totalTokens =
      typeof usage?.total_tokens === 'number' ? usage.total_tokens : promptTokens + completionTokens;
    const responseModel =
      typeof parsedJson?.model === 'string' && parsedJson.model.trim() ? parsedJson.model.trim() : model;

    appendLog({
      id: `call_${crypto.randomBytes(5).toString('hex')}`,
      timestamp: new Date().toISOString(),
      model: responseModel,
      endpoint,
      promptPreview,
      promptNormalized,
      promptHash,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: upstreamResponse.ok
        ? estimateCallCostUsd(responseModel, promptTokens, completionTokens)
        : 0,
      sessionLabel,
      taskLabel,
      latencyMs: Date.now() - startTime,
      statusCode: upstreamResponse.status,
      isSimulated: false,
    });

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.status(upstreamResponse.status).send(rawResponseText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream proxy request failed';
    res.status(502).json({
      error: {
        message: `Proxy upstream error: ${message}`,
        type: 'proxy_error',
      },
    });
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // OpenAI-compatible proxy routes
  app.post('/v1/chat/completions', (req, res) => {
    void handleProxyRequest(req, res, '/v1/chat/completions');
  });

  app.post('/v1/completions', (req, res) => {
    void handleProxyRequest(req, res, '/v1/completions');
  });

  app.get('/v1/models', (_req, res) => {
    res.json({
      object: 'list',
      data: MODEL_PRICING_TABLE.map((entry) => ({
        id: entry.model,
        object: 'model',
        created: 1735689600,
        owned_by: entry.provider.toLowerCase(),
      })),
    });
  });

  // Dashboard & analysis API routes
  app.get('/api/dashboard', (req, res) => {
    const allLogs = getLogs();
    const settings = getSettings();
    const sessionParam =
      typeof req.query.session === 'string' ? req.query.session.trim() : '';
    const filteredLogs =
      sessionParam && sessionParam !== 'all'
        ? allLogs.filter((l) => l.sessionLabel === sessionParam)
        : allLogs;
    const summary = buildDashboardSummary(filteredLogs, settings, allLogs);
    res.json(summary);
  });

  app.patch('/api/logs/:id', (req, res) => {
    const { id } = req.params;
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      sessionLabel?: string;
      taskLabel?: string;
    };
    const updated = updateLogLabels(id, body);
    if (!updated) {
      res.status(404).json({ error: 'Log entry not found' });
      return;
    }
    res.json(updated);
  });

  app.post('/api/settings', (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      manualTaskCount?: number | null;
      manualSessionCount?: number | null;
    };
    const updated = updateSettings(body);
    res.json(updated);
  });

  app.post('/api/demo/seed', (req, res) => {
    const mode = req.body?.mode === 'replace' ? 'replace' : 'append';
    seedDemoLogs(mode);
    const summary = buildDashboardSummary(getLogs(), getSettings());
    res.json(summary);
  });

  app.post('/api/demo/clear', (_req, res) => {
    clearAllLogs();
    const summary = buildDashboardSummary(getLogs(), getSettings());
    res.json(summary);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AgentLedger proxy & dashboard listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
