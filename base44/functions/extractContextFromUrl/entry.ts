import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const url = body.url || body.data?.url;

    if (!url) return Response.json({ error: 'URL requerida' }, { status: 400 });

    // Fetch the page content
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; STEN-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });

    if (!fetchRes.ok) {
      return Response.json({ error: `No se pudo acceder a la URL (${fetchRes.status})` }, { status: 400 });
    }

    const html = await fetchRes.text();

    // Use LLM to extract meaningful business context from the HTML
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extrae el contexto relevante del negocio de este contenido HTML. 
Incluye: nombre del negocio, descripción, productos/servicios, precios si los hay, horarios, ubicación, contacto y cualquier información útil para un chatbot de atención al cliente.
Sé conciso pero completo. Responde solo el texto del contexto sin títulos ni markdown.

HTML:
${html.slice(0, 15000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          context: { type: 'string', description: 'Contexto del negocio extraído' }
        }
      }
    });

    return Response.json({ context: result?.context || '' });
  } catch (error) {
    console.error('extractContextFromUrl error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});