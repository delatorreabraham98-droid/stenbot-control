import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const META_API_VERSION = 'v19.0';

function extractChannelId(url: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || null;
}

function getPhoneNumberId(payload: any): string | null {
  try {
    return payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || null;
  } catch {
    return null;
  }
}

function getMessages(payload: any): any[] {
  try {
    return payload.entry?.[0]?.changes?.[0]?.value?.messages || [];
  } catch {
    return [];
  }
}

function getContactProfile(payload: any): { name: string; wa_id: string } | null {
  try {
    const contacts = payload.entry?.[0]?.changes?.[0]?.value?.contacts || [];
    if (contacts[0]) return { name: contacts[0].profile?.name || '', wa_id: contacts[0].wa_id };
    return null;
  } catch {
    return null;
  }
}

async function downloadMediaFromMeta(mediaId: string, accessToken: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const infoRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${mediaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!infoRes.ok) {
      const err = await infoRes.json();
      console.error('Meta media info error', err);
      return null;
    }
    const info = await infoRes.json();
    const downloadUrl = info.url;
    if (!downloadUrl) {
      console.error('No download URL in media info', info);
      return null;
    }
    const dlRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!dlRes.ok) {
      console.error('Meta media download error', dlRes.status);
      return null;
    }
    const buffer = await dlRes.arrayBuffer();
    return { data: new Uint8Array(buffer), mimeType: info.mime_type || 'audio/ogg' };
  } catch (err) {
    console.error('downloadMediaFromMeta error', err);
    return null;
  }
}

async function transcribeAudio(audioData: Uint8Array, fileName: string, groqApiKey: string, openAiKey: string): Promise<string> {
  // Try Groq (free) first
  if (groqApiKey) {
    try {
      const blob = new Blob([audioData], { type: 'audio/ogg' });
      const form = new FormData();
      form.append('file', blob, fileName);
      form.append('model', 'whisper-large-v3');
      form.append('response_format', 'text');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqApiKey}` },
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) return (await res.text()).trim();
      console.warn('Groq Whisper failed', await res.text().catch(() => ''));
    } catch (err) {
      console.warn('Groq Whisper error', err);
    }
  }

  // Fallback to OpenAI
  if (openAiKey) {
    try {
      const blob = new Blob([audioData], { type: 'audio/ogg' });
      const form = new FormData();
      form.append('file', blob, fileName);
      form.append('model', 'whisper-1');
      form.append('response_format', 'text');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAiKey}` },
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) return (await res.text()).trim();
      const err = await res.text();
      console.error('OpenAI Whisper error', err);
    } catch (err) {
      console.error('OpenAI Whisper error', err);
    }
  }

  return '';
}

function splitTextForGoogleTTS(text: string, maxLen: number = 200): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(text.slice(0, maxLen));
  return chunks;
}

async function textToSpeech(text: string): Promise<Uint8Array | null> {
  try {
    const lang = 'es';
    const chunks = splitTextForGoogleTTS(text);
    const audioParts: Uint8Array[] = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        console.error('Google TTS error', await res.text().catch(() => ''));
        return null;
      }
      const buffer = await res.arrayBuffer();
      audioParts.push(new Uint8Array(buffer));
    }

    const totalLen = audioParts.reduce((sum, p) => sum + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of audioParts) {
      combined.set(part, offset);
      offset += part.length;
    }
    return combined;
  } catch (err) {
    console.error('textToSpeech error', err);
    return null;
  }
}
    return (await res.text()).trim();
  } catch (err) {
    console.error('transcribeAudio error', err);
    return '';
  }
}

async function uploadMediaToMeta(audioData: Uint8Array, phoneNumberId: string, accessToken: string): Promise<string | null> {
  try {
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', blob, 'response.mp3');
    form.append('type', 'audio/mpeg');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form,
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

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

async function sendWhatsAppMessage(phoneNumberId: string, to: string, text: string, accessToken: string, audioMediaId?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let body: any;

    if (audioMediaId) {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'audio',
        audio: { id: audioMediaId },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      };
    }

    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error?.message || 'Error de Meta' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sendAudioMessage(phoneNumberId: string, to: string, audioData: Uint8Array, accessToken: string): Promise<{ ok: boolean; error?: string; mediaId?: string }> {
  const mediaId = await uploadMediaToMeta(audioData, phoneNumberId, accessToken);
  if (!mediaId) return { ok: false, error: 'No se pudo subir el audio a Meta' };
  const sendResult = await sendWhatsAppMessage(phoneNumberId, to, '', accessToken, mediaId);
  return { ...sendResult, mediaId };
}

async function generateBotResponse(
  openAiKey: string,
  botPersonality: string,
  businessContext: string,
  knowledgeItems: string,
  conversationHistory: { role: string; content: string }[],
  customerMessage: string
): Promise<{ text: string; canHandle: boolean }> {
  const systemPrompt = `Eres un asistente de atención al cliente. ${botPersonality ? 'Personalidad: ' + botPersonality : ''}

${businessContext ? 'Contexto del negocio: ' + businessContext : ''}

${knowledgeItems ? 'Información de la empresa:\n' + knowledgeItems : ''}

Instrucciones:
- Responde de forma natural y amigable.
- Usa la información de la empresa para responder preguntas sobre productos, precios, horarios, etc.
- Si no tienes información suficiente para responder, di que necesitas consultar con un asesor humano.
- Si el cliente solicita explícitamente hablar con un humano o su solicitud requiere atención personal, indica "ESCALAR" al inicio de tu respuesta.
- Mantén las respuestas breves y directas (máximo 3 párrafos).
- Responde SIEMPRE en el mismo idioma en que el cliente escribió.`;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: customerMessage },
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json();
      console.error('OpenAI error', errData);
      return { text: 'Lo siento, tengo problemas para procesar tu mensaje. Un asesor te atenderá en breve.', canHandle: false };
    }

    const data = await res.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || '';

    const escalate = reply.startsWith('ESCALAR');
    if (escalate) reply = reply.replace(/^ESCALAR\s*/i, '').trim();

    return { text: reply, canHandle: !escalate };
  } catch (err) {
    console.error('OpenAI request failed', err);
    return { text: 'Lo siento, tengo problemas para procesar tu mensaje. Un asesor te atenderá en breve.', canHandle: false };
  }
}

async function buildConversationHistory(base44: any, conversationId: string): Promise<{ role: string; content: string }[]> {
  try {
    const msgs = await base44.asServiceRole.entities.Message.filter({ conversation_id: conversationId }, 'created_date', 20);
    return msgs.map((m: any) => ({
      role: m.sender_type === 'bot' ? 'assistant' : 'user',
      content: m.message_text,
    }));
  } catch {
    return [];
  }
}

async function loadKnowledge(base44: any, clientId: string): Promise<string> {
  try {
    const items = await base44.asServiceRole.entities.KnowledgeItem.filter({ client_id: clientId, active: true });
    return items.map((i: any) => `[${i.category}] ${i.title}: ${i.content}`).join('\n\n');
  } catch {
    return '';
  }
}

function getAudioMessageInfo(msg: any): { mediaId: string | null; mimeType: string } {
  try {
    const audio = msg.audio;
    if (!audio) return { mediaId: null, mimeType: 'audio/ogg' };
    return { mediaId: audio.id || audio.media_id || null, mimeType: audio.mime_type || 'audio/ogg' };
  } catch {
    return { mediaId: null, mimeType: 'audio/ogg' };
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const channelId = extractChannelId(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (!channelId) {
      return new Response('Missing channel ID', { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    try {
      const channels = await base44.asServiceRole.entities.Channel.filter({ id: channelId });
      const channel = channels[0];
      if (!channel) {
        return new Response('Channel not found', { status: 404 });
      }

      if (mode === 'subscribe' && token === channel.webhook_verify_token) {
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      return new Response('Verification failed', { status: 403 });
    } catch (err) {
      console.error('GET handler error', err);
      return new Response('Internal error', { status: 500 });
    }
  }

  if (req.method === 'POST') {
    const base44 = createClientFromRequest(req);

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const respond = (body: string, status: number = 200) => new Response(body, { status });

    const phoneNumberId = getPhoneNumberId(payload);
    if (!phoneNumberId) {
      return respond('No phone_number_id found in payload. If this is a test notification, it is ok.', 200);
    }

    const messages = getMessages(payload);
    if (messages.length === 0) {
      return respond('No messages to process', 200);
    }

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('META_ACCESS_TOKEN not configured');
      return respond('Meta access token not configured', 500);
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const groqApiKey = Deno.env.get('GROQ_API_KEY');

    for (const msg of messages) {
      try {
        let customerText = '';
        let messageType: 'text' | 'audio' = 'text';

        if (msg.type === 'text') {
          customerText = msg.text?.body?.trim();
          if (!customerText) continue;
        } else if (msg.type === 'audio') {
          messageType = 'audio';
          const { mediaId, mimeType } = getAudioMessageInfo(msg);
          if (!mediaId) {
            console.error('Audio message without media ID, skipping');
            continue;
          }
          const audioData = await downloadMediaFromMeta(mediaId, accessToken);
          if (!audioData || !audioData.data) {
            console.error('Failed to download audio media');
            continue;
          }
          const transcribed = await transcribeAudio(audioData.data, `audio.${mimeType.includes('mp4') ? 'm4a' : 'ogg'}`, groqApiKey, openAiKey);
          if (!transcribed) {
            console.error('Transcription returned empty');
            continue;
          }
          customerText = transcribed;
          console.log('Transcribed audio:', customerText);
        } else {
          continue;
        }

        const senderPhone = msg.from;
        const contactProfile = getContactProfile(payload);

        const channels = await base44.asServiceRole.entities.Channel.filter({ phone_number_id: phoneNumberId });
        const channel = channels[0];
        if (!channel) {
          console.error(`No channel found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        const clientEmail = channel.client_email;

        const existingConvs = await base44.asServiceRole.entities.Conversation.filter({
          channel_id: channel.id,
          external_user_id: senderPhone,
        });

        let conversation: any;
        if (existingConvs.length > 0) {
          conversation = existingConvs[0];
        } else {
          conversation = await base44.asServiceRole.entities.Conversation.create({
            client_id: channel.client_id,
            client_email: clientEmail,
            channel_id: channel.id,
            channel_type: channel.type,
            external_user_id: senderPhone,
            customer_name: contactProfile?.name || '',
            customer_phone: senderPhone,
            status: 'bot_active',
            last_message_at: new Date().toISOString(),
            last_message_preview: customerText,
            message_count: 1,
          });
        }

        const now = new Date().toISOString();
        const commonMsgFields = {
          client_id: channel.client_id,
          client_email: clientEmail,
          conversation_id: conversation.id,
          message_type: messageType,
          status: 'sent' as const,
        };

        await base44.asServiceRole.entities.Message.create({
          ...commonMsgFields,
          direction: 'inbound',
          sender_type: 'customer',
          message_text: customerText,
          raw_payload: JSON.stringify(msg),
        });

        const shouldRespond = conversation.status === 'open' || conversation.status === 'bot_active';

        if (shouldRespond && openAiKey) {
          const bots = await base44.asServiceRole.entities.Bot.filter({ id: channel.bot_id });
          const bot = bots[0];

          const knowledgeItems = await loadKnowledge(base44, channel.client_id);
          const history = await buildConversationHistory(base44, conversation.id);

          const { text: botReply, canHandle } = await generateBotResponse(
            openAiKey,
            bot?.bot_personality || '',
            bot?.business_context || '',
            knowledgeItems,
            history,
            customerText
          );

          const respondWithAudio = bot?.respond_with_audio === true;
          let sendResult: { ok: boolean; error?: string };
          let audioMediaId: string | undefined;

          if (respondWithAudio) {
            const audioData = await textToSpeech(botReply);
            if (audioData) {
              const audioResult = await sendAudioMessage(phoneNumberId, senderPhone, audioData, accessToken);
              sendResult = { ok: audioResult.ok, error: audioResult.error };
              audioMediaId = audioResult.mediaId;
            } else {
              sendResult = await sendWhatsAppMessage(phoneNumberId, senderPhone, botReply, accessToken);
            }
          } else {
            sendResult = await sendWhatsAppMessage(phoneNumberId, senderPhone, botReply, accessToken);
          }

          await base44.asServiceRole.entities.Message.create({
            ...commonMsgFields,
            direction: 'outbound',
            sender_type: 'bot',
            message_text: botReply,
            message_type: respondWithAudio && audioMediaId ? 'audio' : 'text',
            status: sendResult.ok ? 'sent' : 'failed',
          });

          const newStatus = canHandle ? 'bot_active' : 'needs_human';
          const escalationMsg = !canHandle && bot?.human_escalation_message
            ? bot.human_escalation_message
            : undefined;

          const updateData: any = {
            last_message_at: now,
            last_message_preview: botReply,
            message_count: (conversation.message_count || 1) + 1,
            status: newStatus,
          };

          if (escalationMsg) {
            await sendWhatsAppMessage(phoneNumberId, senderPhone, escalationMsg, accessToken);
            await base44.asServiceRole.entities.Message.create({
              ...commonMsgFields,
              direction: 'outbound',
              sender_type: 'bot',
              message_text: escalationMsg,
              message_type: 'text',
              status: 'sent',
            });
            updateData.message_count = (updateData.message_count || 1) + 1;
          }

          await base44.asServiceRole.entities.Conversation.update(conversation.id, updateData);
        } else if (shouldRespond && !openAiKey) {
          await base44.asServiceRole.entities.Conversation.update(conversation.id, {
            status: 'needs_human',
            last_message_at: now,
            last_message_preview: customerText,
            message_count: (conversation.message_count || 1),
          });
        } else {
          await base44.asServiceRole.entities.Conversation.update(conversation.id, {
            last_message_at: now,
            last_message_preview: customerText,
            message_count: (conversation.message_count || 1),
          });
        }
      } catch (err) {
        console.error('Error processing message', err);
      }
    }

    return respond('OK');
  }

  return new Response('Method not allowed', { status: 405 });
});
