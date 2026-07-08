import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const payload = body.data || body.args || body.params || body;
    const { api_id } = payload;
    if (!api_id) return Response.json({ error: 'api_id is required' }, { status: 400 });

    const user = await base44.auth.me().catch(() => null);
    const sdk = user ? base44 : base44.asServiceRole;

    const api = await sdk.entities.Api.get(api_id);
    if (!api) return Response.json({ error: 'API not found' }, { status: 404 });

    const url = api.health_check_path
      ? `${api.base_url}${api.version ? '/' + api.version : ''}${api.health_check_path}`
      : api.base_url;

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(api.custom_headers || {})) headers[k] = String(v);

    if (api.auth_type !== 'none') {
      let token: string | undefined;
      if (api.auth_source === 'env_var' && api.auth_env_var_name) {
        token = Deno.env.get(api.auth_env_var_name);
      } else {
        token = api.auth_token;
      }
      if (token) {
        const headerName = api.auth_header_name || 'Authorization';
        const prefix = api.auth_header_prefix || '';
        headers[headerName] = prefix ? `${prefix} ${token}` : token;
      }
    }

    try {
      const start = Date.now();
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(api.timeout_ms || 10000),
      });
      const duration = Date.now() - start;
      const status = res.ok ? 'healthy' : 'unhealthy';
      await sdk.entities.Api.update(api_id, {
        last_health_status: status,
        last_health_check: new Date().toISOString(),
      });
      return Response.json({ status, http_status: res.status, duration_ms: duration });
    } catch (err: any) {
      await sdk.entities.Api.update(api_id, {
        last_health_status: 'unhealthy',
        last_health_check: new Date().toISOString(),
      });
      return Response.json({ status: 'unhealthy', error: err.message });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});