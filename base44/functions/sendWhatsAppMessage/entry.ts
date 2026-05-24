import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation_id, message_text } = await req.json();
    if (!conversation_id || !message_text) {
      return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Fetch conversation and channel
    const conversations = await base44.asServiceRole.entities.Conversation.filter({ id: conversation_id });
    const conversation = conversations[0];
    if (!conversation) return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });

    const channels = await base44.asServiceRole.entities.Channel.filter({ id: conversation.channel_id });
    const channel = channels[0];
    if (!channel) return Response.json({ error: 'Canal no encontrado' }, { status: 404 });

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');

    // Send via WhatsApp Cloud API
    if (channel.type === 'whatsapp') {
      const res = await fetch(`https://graph.facebook.com/v19.0/${channel.phone_number_id}/messages`, {
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
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Error de Meta' }, { status: 400 });

    } else if (channel.type === 'messenger' || channel.type === 'instagram') {
      // Send via Messenger / Instagram Graph API
      const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: conversation.external_user_id },
          message: { text: message_text },
        }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.error?.message || 'Error de Meta' }, { status: 400 });
    }

    // Save message in DB
    await base44.asServiceRole.entities.Message.create({
      conversation_id,
      client_id: conversation.client_id,
      direction: 'outbound',
      sender_type: 'human',
      message_text,
      message_type: 'text',
      status: 'sent',
    });

    // Update conversation preview
    await base44.asServiceRole.entities.Conversation.update(conversation_id, {
      last_message_at: new Date().toISOString(),
      last_message_preview: message_text,
      message_count: (conversation.message_count || 0) + 1,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});