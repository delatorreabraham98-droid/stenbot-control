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
    if (!conversation) {
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const channels = await base44.asServiceRole.entities.Channel.filter({ id: conversation.channel_id });
    const channel = channels[0];
    if (!channel) {
      return Response.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      return Response.json({ error: 'META_ACCESS_TOKEN no configurado' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // 1. Guardar el mensaje en el CRM primero (siempre)
    const savedMessage = await base44.asServiceRole.entities.Message.create({
      conversation_id,
      client_id: conversation.client_id,
      direction: 'outbound',
      sender_type: 'human',
      message_text,
      message_type: 'text',
      status: 'sent',
    });

    // Actualizar conversación
    await base44.asServiceRole.entities.Conversation.update(conversation_id, {
      last_message_at: now,
      last_message_preview: message_text,
      message_count: (conversation.message_count || 0) + 1,
    });

    // 2. Intentar enviar por Meta
    const recipientPhone = conversation.customer_phone || conversation.external_user_id;

    console.log('WHATSAPP SEND DEBUG', {
      recipientPhone,
      customer_phone: conversation.customer_phone,
      external_user_id: conversation.external_user_id,
      phone_number_id: channel.phone_number_id,
      conversation_id
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let metaError = null;

    try {
      let res;

      if (channel.type === 'whatsapp') {
        res = await fetch(
          `https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipientPhone,
              type: 'text',
              text: { body: message_text },
            }),
            signal: controller.signal
          }
        );
      } else if (channel.type === 'messenger' || channel.type === 'instagram') {
        res = await fetch(
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
      }

      if (res) {
        const data = await res.json();
        console.log('META RESPONSE', data);

        if (!res.ok) {
          metaError = data.error?.message || 'Error de Meta';
          console.error('META ERROR', data);
          // Marcar mensaje como fallido
          await base44.asServiceRole.entities.Message.update(savedMessage.id, { status: 'failed' });
        }
      }
    } finally {
      clearTimeout(timer);
    }

    if (metaError) {
      return Response.json({
        success: false,
        saved: true,
        error: metaError,
        message: 'Mensaje guardado en CRM pero no enviado a WhatsApp'
      }, { status: 400 });
    }

    return Response.json({ success: true, saved: true });

  } catch (error) {
    console.error('SEND WHATSAPP ERROR', error);
    const msg = error.name === 'AbortError' ? 'Timeout al enviar WhatsApp' : error.message;
    return Response.json({ error: msg }, { status: 500 });
  }
});