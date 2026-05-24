import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const payload = body.data || body.args || body.params || body;
    const conversation_id = payload.conversation_id || payload.conversationId;
    const message_text = payload.message_text || payload.messageBody || payload.body || payload.text;
    if (!conversation_id || !message_text) {
      return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
    }
    const conversations = await base44.asServiceRole.entities.Conversation.filter({ id: conversation_id });
    const conversation = conversations[0];
    if (!conversation) return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    const channels = await base44.asServiceRole.entities.Channel.filter({ id: conversation.channel_id });
    const channel = channels[0];
    if (!channel) return Response.json({ error: 'Canal no encontrado' }, { status: 404 });
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) return Response.json({ error: 'META_ACCESS_TOKEN no configurado' }, { status: 500 });
    // Enviar WhatsApp con timeout de 10s
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      if (channel.type === 'whatsapp') {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: conversation.external_user_id,
              type: 'text',
              text: { body: message_text },
            }),
            signal: controller.signal
          }
        );
        const data = await res.json();
        if (!res.ok) {
          clearTimeout(timer);
          return Response.json({ error: data.error?.message || 'Error de Meta' }, { status: 400 });
        }
      } else if (channel.type === 'messenger' || channel.type === 'instagram') {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: conversation.external_user_id },
              message: { text: message_text },
            }),
            signal: controller.signal
          }
        );
        const data = await res.json();
        if (!res.ok) {
          clearTimeout(timer);
          return Response.json({ error: data.error?.message || 'Error de Meta' }, { status: 400 });
        }
      }
    } finally {
      clearTimeout(timer);
    }
    // Guardar mensaje y actualizar conversación en paralelo
    const now = new Date().toISOString();
    await Promise.all([
      base44.asServiceRole.entities.Message.create({
        conversation_id,
        client_id: conversation.client_id,
        direction: 'outbound',
        sender_type: 'human',
        message_text,
        message_type: 'text',
        status: 'sent',
      }),
      base44.asServiceRole.entities.Conversation.update(conversation_id, {
        last_message_at: now,
        last_message_preview: message_text,
        message_count: (conversation.message_count || 0) + 1,
      })
    ]);
    return Response.json({ success: true });
  } catch (error) {
    const msg = error.name === 'AbortError' ? 'Timeout al enviar WhatsApp' : error.message;
    return Response.json({ error: msg }, { status: 500 });
  }
});