import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════
// MOTOR IA DESACOPLADO — STEN Bot Control
// Procesa mensajes usando Function Calling dinámico.
// Las herramientas se cargan desde la entidad Tool (por bot/cliente).
// El motor NO conoce la lógica del negocio; solo orquesta llamadas.
// ═══════════════════════════════════════════════════════════════

async function loadKnowledge(base44, clientId) {
  try {
    const items = await base44.asServiceRole.entities.KnowledgeItem.filter({ client_id: clientId, active: true });
    return items.map(i => `[${i.category}] ${i.title}: ${i.content}`).join('\n\n');
  } catch { return ''; }
}

async function buildConversationHistory(base44, conversationId) {
  try {
    const msgs = await base44.asServiceRole.entities.Message.filter({ conversation_id: conversationId }, 'created_date', 20);
    return msgs.map(m => ({
      role: m.sender_type === 'bot' ? 'assistant' : 'user',
      content: m.message_text,
    }));
  } catch { return []; }
}

async function loadTools(base44, botId, clientId) {
  try {
    const all = await base44.asServiceRole.entities.Tool.filter({ client_id: clientId, active: true });
    // Herramientas específicas del bot + herramientas compartidas (sin bot_id)
    return all.filter(t => !t.bot_id || t.bot_id === botId);
  } catch { return []; }
}

function toolsToOpenAIFormat(tools) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters_schema || { type: 'object', properties: {} },
    },
  }));
}

function extractPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

async function executeTool(tool, args) {
  try {
    const headers = { 'Content-Type': 'application/json', ...(tool.custom_headers || {}) };

    if (tool.auth_type === 'bearer' && tool.auth_token) {
      headers['Authorization'] = `Bearer ${tool.auth_token}`;
    } else if (tool.auth_type === 'api_key' && tool.auth_token) {
      headers['X-API-Key'] = tool.auth_token;
    }

    const method = tool.method || 'POST';
    let url = tool.endpoint_url;
    let body;

    if (method === 'GET') {
      const params = new URLSearchParams(args);
      url = `${url}${url.includes('?') ? '&' : '?'}${params}`;
    } else {
      body = JSON.stringify(args || {});
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    const extracted = extractPath(parsed, tool.response_path);

    return {
      success: res.ok,
      status: res.status,
      data: extracted !== undefined ? extracted : parsed,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function callOpenAI(openAiKey, messages, tools) {
  const payload = {
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 600,
    temperature: 0.7,
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }

  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const payload = body.data || body.args || body.params || body;

    const { conversation_id, bot_id, client_id, user_message } = payload;

    if (!user_message) {
      return Response.json({ error: 'user_message is required' }, { status: 400 });
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    // Cargar configuración del bot
    let bot = null;
    if (bot_id) {
      const bots = await base44.asServiceRole.entities.Bot.filter({ id: bot_id });
      bot = bots[0];
    }

    // Cargar knowledge, historial y herramientas en paralelo
    const [knowledgeItems, history, tools] = await Promise.all([
      client_id ? loadKnowledge(base44, client_id) : Promise.resolve(''),
      conversation_id ? buildConversationHistory(base44, conversation_id) : Promise.resolve([]),
      loadTools(base44, bot_id, client_id),
    ]);

    const systemPrompt = `Eres un asistente inteligente de atención al cliente${bot?.name ? ' llamado ' + bot.name : ''}.
${bot?.bot_personality ? 'Personalidad: ' + bot.bot_personality : ''}
${bot?.business_context ? 'Contexto del negocio: ' + bot.business_context : ''}
${knowledgeItems ? 'Información de la empresa:\n' + knowledgeItems : ''}

INSTRUCCIONES:
- Responde de forma natural, amigable y concisa (máximo 3 párrafos).
- Tienes HERRAMIENTAS disponibles para consultar información en TIEMPO REAL del negocio.
- ANTES de responder sobre disponibilidad, precios, paquetes, promociones, citas o FAQ, USA la herramienta correspondiente.
- NUNCA inventes información. Si no sabes algo y no tienes una herramienta para consultarlo, di que necesitas verificar.
- Si el cliente solicita explícitamente hablar con un humano o su solicitud requiere atención personal, comienza tu respuesta con "ESCALAR".
- Responde SIEMPRE en el mismo idioma en que el cliente escribió.` + (tools.length > 0 ? '\n\nHERRAMIENTAS DISPONIBLES: ' + tools.map(t => `- ${t.name}: ${t.description}`).join('\n') : '');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: user_message },
    ];

    const openaiTools = toolsToOpenAIFormat(tools);

    // Primera llamada a OpenAI
    let completion = await callOpenAI(openAiKey, messages, openaiTools);
    let choice = completion.choices?.[0];
    let toolCalls = choice?.message?.tool_calls;

    // Bucle de Function Calling (máx 3 iteraciones)
    let iterations = 0;
    const MAX_ITERATIONS = 3;

    while (toolCalls && toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
      // Agregar el mensaje del asistente con las tool_calls
      messages.push(choice.message);

      // Ejecutar cada herramienta solicitada
      for (const toolCall of toolCalls) {
        const tool = tools.find(t => t.name === toolCall.function.name);
        let toolResult;

        if (!tool) {
          toolResult = { error: `Herramienta '${toolCall.function.name}' no encontrada` };
        } else {
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}
          console.log(`Executing tool: ${tool.name} with args:`, args);
          toolResult = await executeTool(tool, args);
          console.log(`Tool ${tool.name} result:`, toolResult.success ? 'OK' : 'ERROR');
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.data || toolResult.error || toolResult),
        });
      }

      // Segunda llamada con los resultados de las herramientas
      completion = await callOpenAI(openAiKey, messages, openaiTools);
      choice = completion.choices?.[0];
      toolCalls = choice?.message?.tool_calls;
      iterations++;
    }

    let reply = choice?.message?.content?.trim() || '';

    const escalate = reply.startsWith('ESCALAR');
    if (escalate) reply = reply.replace(/^ESCALAR\s*/i, '').trim();

    return Response.json({
      text: reply,
      canHandle: !escalate,
      tool_calls_made: iterations > 0 ? iterations : 0,
    });
  } catch (error) {
    console.error('processMessage error:', error);
    return Response.json({
      text: 'Lo siento, tengo problemas para procesar tu mensaje. Un asesor te atenderá en breve.',
      canHandle: false,
      error: error.message,
    }, { status: 200 });
  }
});