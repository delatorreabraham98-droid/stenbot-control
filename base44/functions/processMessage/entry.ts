import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════
// PLANNER IA — STEN Bot Control
// Motor de planificación que decide qué herramientas ejecutar
// y en qué orden, usando Function Calling de OpenAI.
// Ejecuta múltiples herramientas secuencialmente antes de responder.
// Toda la lógica del negocio vive en las APIs externas del cliente.
// ═══════════════════════════════════════════════════════════════

async function loadKnowledge(base44: any, clientId: string) {
  try {
    const items = await base44.asServiceRole.entities.KnowledgeItem.filter({ client_id: clientId, active: true });
    return items.map(i => `[${i.category}] ${i.title}: ${i.content}`).join('\n\n');
  } catch { return ''; }
}

async function buildConversationHistory(base44: any, conversationId: string) {
  try {
    const msgs = await base44.asServiceRole.entities.Message.filter({ conversation_id: conversationId }, 'created_date', 20);
    return msgs.map(m => ({
      role: m.sender_type === 'bot' ? 'assistant' : 'user',
      content: m.message_text,
    }));
  } catch { return []; }
}

async function loadTools(base44: any, botId: string, clientId: string) {
  try {
    const all = await base44.asServiceRole.entities.Tool.filter({ client_id: clientId, active: true });
    return all.filter(t => !t.bot_id || t.bot_id === botId);
  } catch { return []; }
}

function toolsToOpenAIFormat(tools: any[]) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.prompt_hint
        ? `${t.description}\n\nCuándo usarla: ${t.prompt_hint}`
        : t.description,
      parameters: t.parameters_schema || { type: 'object', properties: {} },
    },
  }));
}

async function callOpenAI(openAiKey: string, messages: any[], tools?: any[]) {
  const payload: any = {
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 800,
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

    if (!user_message) return Response.json({ error: 'user_message is required' }, { status: 400 });

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    // Cargar bot, knowledge, historial y herramientas en paralelo
    let bot = null;
    if (bot_id) {
      const bots = await base44.asServiceRole.entities.Bot.filter({ id: bot_id });
      bot = bots[0];
    }

    const [knowledgeItems, history, tools] = await Promise.all([
      client_id ? loadKnowledge(base44, client_id) : Promise.resolve(''),
      conversation_id ? buildConversationHistory(base44, conversation_id) : Promise.resolve([]),
      loadTools(base44, bot_id, client_id),
    ]);

    const toolNames = tools.length > 0
      ? '\n\nHERRAMIENTAS DISPONIBLES:\n' + tools.map(t =>
          `- ${t.name}: ${t.description}${t.prompt_hint ? ' (Uso: ' + t.prompt_hint + ')' : ''}`
        ).join('\n')
      : '';

    const systemPrompt = `Eres un asistente inteligente de atención al cliente${bot?.name ? ' llamado ' + bot.name : ''}.
${bot?.bot_personality ? 'Personalidad: ' + bot.bot_personality : ''}
${bot?.business_context ? 'Contexto del negocio: ' + bot.business_context : ''}
${knowledgeItems ? 'Información de la empresa:\n' + knowledgeItems : ''}

INSTRUCCIONES DE PLANIFICACIÓN:
- Eres un PLANificador. Analiza la solicitud del cliente y decide qué herramientas necesitas ejecutar.
- Puedes ejecutar MÚLTIPLES herramientas en secuencia antes de responder.
- Ejemplo: si el cliente pide reservar un evento, primero consulta disponibilidad, luego paquetes, luego promociones, y finalmente crea el lead o cita.
- ANTES de responder sobre disponibilidad, precios, paquetes, promociones, citas o cualquier dato en tiempo real, USA la herramienta correspondiente.
- NUNCA inventes información. Si no tienes una herramienta para consultarlo, di que necesitas verificar con el equipo.
- Una vez que tengas toda la información necesaria, responde de forma natural, amigable y concisa (máximo 3 párrafos).
- Si el cliente solicita explícitamente hablar con un humano o su solicitud requiere atención personal, comienza tu respuesta con "ESCALAR".
- Responde SIEMPRE en el mismo idioma en que el cliente escribió.` + toolNames;

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

    // Bucle de Function Calling (hasta 10 iteraciones para multi-step planning)
    const MAX_ITERATIONS = 10;
    let iterations = 0;
    const executedTools: string[] = [];

    while (toolCalls && toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
      messages.push(choice.message);

      for (const toolCall of toolCalls) {
        const tool = tools.find(t => t.name === toolCall.function.name);
        let toolResult: any;

        if (!tool) {
          toolResult = { error: `Herramienta '${toolCall.function.name}' no encontrada` };
        } else {
          let args: any = {};
          try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}
          console.log(`[Planner] Ejecutando: ${tool.name} con args:`, args);
          // Delegar al motor universal executeTool
          try {
            const res = await base44.asServiceRole.functions.invoke('executeTool', {
              tool_id: tool.id,
              client_id: tool.client_id,
              params: args,
              source: 'planner',
              conversation_id: conversation_id || '',
            });
            toolResult = res.data || res;
          } catch (err) {
            toolResult = { error: err.message };
          }
          executedTools.push(tool.name);
          console.log(`[Planner] ${tool.name} → ${toolResult.success ? 'OK' : 'ERROR'}`);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.data ?? toolResult.error ?? toolResult),
        });
      }

      // Siguiente llamada con los resultados
      completion = await callOpenAI(openAiKey, messages, openaiTools);
      choice = completion.choices?.[0];
      toolCalls = choice?.message?.tool_calls;
      iterations++;
    }

    let reply = choice?.message?.content?.trim() || '';
    const escalate = reply.startsWith('ESCALAR');
    if (escalate) reply = reply.replace(/^ESCALAR\s*/i, '').trim();

    // Incrementar contador de mensajes usados del cliente
    if (client_id) {
      try {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
        const client = clients[0];
        if (client) {
          const used = (client.messages_used || 0) + 1;
          const limit = client.message_limit || 1000;
          await base44.asServiceRole.entities.Client.update(client.id, { messages_used: used });
          // Si excede el límite, pausar el bot
          if (used >= limit && client.status === 'active') {
            await base44.asServiceRole.entities.Client.update(client.id, { status: 'paused', billing_status: 'past_due' });
          }
        }
      } catch { /* best-effort tracking */ }
    }

    return Response.json({
      text: reply,
      canHandle: !escalate,
      tool_calls_made: executedTools.length,
      tools_used: executedTools,
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