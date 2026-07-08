import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const META_API_VERSION = 'v19.0';

async function downloadFromUrl(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

async function uploadMediaToMeta(audioData: Uint8Array, phoneNumberId: string, accessToken: string, mimeType: string = 'audio/ogg'): Promise<string | null> {
  try {
    const ext = mimeType.includes('mp4') ? 'm4a' : 'ogg';
    const blob = new Blob([audioData], { type: mimeType });
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', blob, `audio.${ext}`);
    form.append('type', mimeType);

    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error('Meta media upload error', err);
      return null;
    }
    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.error('uploadMediaToMeta error', err);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const payload = body.data || body.args || body.params || body;

    const conversation_id = payload.conversation_id || payload.conversationId;
    let message_text = payload.message_text || payload.messageBody || payload.body || payload.text;
    const message_type = payload.message_type || payload.messageType || 'text';
    const audio_url = payload.audio_url || payload.audioUrl;

    if (!conversation_id || (!message_text && message_type !== 'audio')) {
      return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const conversations = await base44.asServiceRole.entities.Conversation.filter({ id: conversation_id });
    const conversation = conversations[0];
    if (!conversation) {
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }
    if (!conversation.channel_id) {
      return Response.json({ error: 'La conversación no tiene un canal asignado' }, { status: 400 });
    }

    const channels = await base44.asServiceRole.entities.Channel.filter({ id: conversation.channel_id });
    const channel = channels[0];
    if (!channel) {
      return Response.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Determine effective message text for preview
    const previewText = message_type === 'audio' && audio_url ? '[Mensaje de audio]' : message_text;

    // 1. Save message to CRM
    const savedMessage = await base44.asServiceRole.entities.Message.create({
      conversation_id,
      client_id: conversation.client_id,
      client_email: conversation.client_email || channel.client_email,
      direction: 'outbound',
      sender_type: 'human',
      message_text: previewText,
      message_type: message_type,
      status: 'sent',
    });

    // 2. Update conversation
    // When a human replies manually, lock the conversation to manual mode (needs_human)
    // so the bot doesn't auto-respond to the next inbound message from the customer.
    // Skip if the conversation is already closed.
    const updateData: any = {
      last_message_at: now,
      last_message_preview: previewText,
      message_count: (conversation.message_count || 0) + 1,
    };
    if (conversation.status !== 'closed') {
      updateData.status = 'needs_human';
    }
    await base44.asServiceRole.entities.Conversation.update(conversation_id, updateData);

    // 3. Check Meta token
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      return Response.json({
        success: false,
        saved: true,
        error: 'META_ACCESS_TOKEN no configurado. Mensaje guardado en CRM.',
      });
    }

    const recipientPhone = conversation.customer_phone || conversation.external_user_id;

    // 4. Send via Meta API
    let metaError = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      let res;

      if (channel.type === 'whatsapp') {
        if (message_type === 'audio' && audio_url) {
          // Download audio from URL and upload to Meta
          const audioData = await downloadFromUrl(audio_url);
          if (!audioData) {
            metaError = 'No se pudo descargar el audio desde la URL proporcionada';
          } else {
            const mediaId = await uploadMediaToMeta(audioData, channel.phone_number_id, accessToken);
            if (!mediaId) {
              metaError = 'No se pudo subir el audio a Meta';
            } else {
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
                    type: 'audio',
                    audio: { id: mediaId },
                  }),
                  signal: controller.signal,
                }
              );
            }
          }
        } else {
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
              signal: controller.signal,
            }
          );
        }
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
            signal: controller.signal,
          }
        );
      } else {
        metaError = `Tipo de canal no soportado: ${channel.type}`;
      }

      if (res) {
        const data = await res.json();

        if (!res.ok) {
          metaError = data.error?.message || 'Error de Meta';
          console.error('META ERROR', data);
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
        message: 'Mensaje guardado en CRM pero no enviado a WhatsApp',
      });
    }

    return Response.json({ success: true, saved: true });
  } catch (error) {
    console.error('SEND WHATSAPP ERROR', error);
    const msg = error.name === 'AbortError' ? 'Timeout al enviar WhatsApp' : error.message;
    return Response.json({ error: msg }, { status: 500 });
  }
});