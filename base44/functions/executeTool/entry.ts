import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════
// MOTOR UNIVERSAL DE EJECUCIÓN DE HERRAMIENTAS — STEN Bot Control
// Ejecuta cualquier Tool registrada contra su API configurada.
// Incluye: retry, caché, rate limiting, variables globales, logs.
// ═══════════════════════════════════════════════════════════════

// Caché en memoria (per-isolate) con TTL
const cache = new Map<string, { data: any; expires: number }>();
// Rate limiter en memoria (per-isolate)
const rateLimitMap = new Map<string, number[]>();

function extractPath(obj: any, path?: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function substituteVars(str: string, vars: Record<string, string>): string {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function substituteDeep(value: any, vars: Record<string, string>): Promise<any> {
  if (typeof value === 'string') return substituteVars(value, vars);
  if (Array.isArray(value)) return Promise.all(value.map(v => substituteDeep(v, vars)));
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) result[k] = await substituteDeep(v, vars);
    return result;
  }
  return value;
}

async function logExecution(sdk: any, tool: any, api: any, params: any, data: any, status: number, duration: number, cached: boolean, retries: number, source: string, conversationId: string, error: string) {
  try {
    await sdk.entities.ToolLog.create({
      tool_id: tool.id,
      tool_name: tool.name,
      api_id: api?.id,
      api_name: api?.name,
      client_id: tool.client_id,
      client_email: tool.client_email || '',
      conversation_id: conversationId || '',
      request_url: `${api?.base_url || ''}${api?.version ? '/' + api.version : ''}${tool.path || ''}`,
      request_method: tool.method || 'POST',
      request_params: params,
      response_status: status,
      response_body: typeof data === 'string' ? data.substring(0, 2000) : JSON.stringify(data).substring(0, 2000),
      duration_ms: duration,
      cached,
      retry_attempts: retries,
      source: source || 'planner',
      error: error || '',
    });
  } catch { /* logging is best-effort */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const payload = body.data || body.args || body.params || body;
    const { tool_id, tool_name, client_id, params, source, conversation_id } = payload;

    if (!client_id && !tool_id) return Response.json({ error: 'client_id or tool_id is required' }, { status: 400 });

    // Auth: usar user-scoped si hay sesión, sino service role (webhook → processMessage → aquí)
    const user = await base44.auth.me().catch(() => null);
    const sdk = user ? base44 : base44.asServiceRole;

    // Cargar herramienta
    let tool;
    if (tool_id) {
      tool = await sdk.entities.Tool.get(tool_id);
    } else if (tool_name && client_id) {
      const tools = await sdk.entities.Tool.filter({ client_id, name: tool_name, active: true });
      tool = tools[0];
    }
    if (!tool) return Response.json({ error: 'Tool not found' }, { status: 404 });
    if (!tool.active) return Response.json({ error: 'Tool is inactive' }, { status: 403 });

    // Cargar API
    if (!tool.api_id) return Response.json({ error: 'Tool has no API assigned' }, { status: 400 });
    const api = await sdk.entities.Api.get(tool.api_id);
    if (!api) return Response.json({ error: 'API not found' }, { status: 404 });
    if (!api.active) return Response.json({ error: 'API is inactive' }, { status: 403 });

    // Cargar variables globales del cliente
    const vars: Record<string, string> = {};
    try {
      const varList = await sdk.entities.GlobalVariable.filter({ client_id: tool.client_id, active: true });
      for (const v of varList) vars[v.key] = v.value;
    } catch { /* vars are optional */ }

    // ── Rate limiting ──
    if (api.rate_limit_per_minute > 0) {
      const now = Date.now();
      const key = `api_${api.id}`;
      const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < 60000);
      if (timestamps.length >= api.rate_limit_per_minute) {
        return Response.json({ error: 'Rate limit exceeded', retry_after_ms: 60000 - (now - timestamps[0]) }, { status: 429 });
      }
      timestamps.push(now);
      rateLimitMap.set(key, timestamps);
    }

    // ── Caché ──
    const cacheKey = tool.cache_ttl_seconds > 0 ? `${tool.id}_${JSON.stringify(params || {})}` : null;
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        await logExecution(sdk, tool, api, params, cached.data, 200, 0, true, 0, source, conversation_id, '');
        return Response.json({ success: true, data: cached.data, cached: true });
      } else if (cached) {
        cache.delete(cacheKey);
      }
    }

    // ── Construir URL ──
    const versionSegment = api.version ? `/${api.version}` : '';
    const path = substituteVars(tool.path || '', vars);
    const url = `${api.base_url}${versionSegment}${path}`;

    // ── Headers ──
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    for (const [k, v] of Object.entries(api.custom_headers || {})) {
      headers[k] = substituteVars(String(v), vars);
    }

    // ── Auth ──
    if (api.auth_type !== 'none') {
      let token: string | undefined;
      if (api.auth_source === 'env_var' && api.auth_env_var_name) {
        token = Deno.env.get(api.auth_env_var_name);
        if (!token) {
          await logExecution(sdk, tool, api, params, null, 0, 0, false, 0, source, conversation_id, `Env var ${api.auth_env_var_name} not set`);
          return Response.json({ error: `Env var ${api.auth_env_var_name} not set` }, { status: 500 });
        }
      } else {
        token = api.auth_token;
      }
      if (token) {
        const headerName = api.auth_header_name || 'Authorization';
        const prefix = api.auth_header_prefix || '';
        headers[headerName] = prefix ? `${prefix} ${token}` : token;
      }
    }

    // ── Sustituir variables en parámetros ──
    const finalParams = await substituteDeep(params || {}, vars);

    // ── Ejecutar con retry ──
    const timeoutMs = api.timeout_ms || 15000;
    const maxRetries = tool.retry_count || 0;
    const retryDelay = tool.retry_delay_ms || 1000;
    let lastError: any;
    let response: Response | null = null;
    let attempt = 0;
    const startTime = Date.now();

    for (attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const method = tool.method || 'POST';
        let fetchUrl = url;
        let fetchBody: string | undefined;
        if (method === 'GET') {
          const qs = new URLSearchParams(finalParams);
          fetchUrl = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
        } else {
          fetchBody = JSON.stringify(finalParams);
        }

        response = await fetch(fetchUrl, {
          method,
          headers,
          body: fetchBody,
          signal: AbortSignal.timeout(timeoutMs),
        });

        // No reintentar en errores 4xx (cliente); sí en 5xx y errores de red
        if (response.ok || response.status < 500) break;
        const errText = await response.text().catch(() => '');
        lastError = new Error(`HTTP ${response!.status}: ${errText.substring(0, 200)}`);
        response = null;
      } catch (err) {
        lastError = err;
      }
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }

    const durationMs = Date.now() - startTime;

    if (!response) {
      await logExecution(sdk, tool, api, params, null, 0, durationMs, false, attempt, source, conversation_id, lastError?.message || 'Request failed');
      return Response.json({ success: false, error: lastError?.message || 'Request failed' }, { status: 502 });
    }

    const text = await response.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    const extracted = extractPath(parsed, tool.response_path);
    const result = extracted !== undefined ? extracted : parsed;

    // ── Guardar en caché si fue exitoso ──
    if (cacheKey && response.ok) {
      cache.set(cacheKey, { data: result, expires: Date.now() + tool.cache_ttl_seconds * 1000 });
    }

    // ── Log ──
    const errMsg = response.ok ? '' : `HTTP ${response.status}`;
    await logExecution(sdk, tool, api, params, result, response.status, durationMs, false, attempt, source, conversation_id, errMsg);

    return Response.json({ success: response.ok, status: response.status, data: result, duration_ms: durationMs });
  } catch (error) {
    console.error('executeTool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});