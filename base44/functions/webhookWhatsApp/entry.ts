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


function stripEmojis(text: string): string {
  return text.replace(/[\ud800-\udfff\u200d\u200b\ufe0f\u23cf\u231a\u23f0-\u23fa\u2600-\u27bf]+/g, '').replace(/\s+/g, ' ').trim();
}

function shortenForAudio(text: string): string {
  return text
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\b(?:✅|❌|🔹|🔸|👉|💡|🚗|🛒|😊|👌|🔥)\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function textToSpeechEdge(text: string, voice: string): Promise<Uint8Array | null> {
  try {
    const parts: Uint8Array[] = [];
    for (const chunk of splitTextForTTS(text)) {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      parts.push(new Uint8Array(buffer));
    }
    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) { combined.set(part, offset); offset += part.length; }
    return combined;
  } catch { return null; }
}

async function textToSpeechGoogle(text: string, lang: string): Promise<Uint8Array | null> {
  try {
    const parts: Uint8Array[] = [];
    for (const chunk of splitTextForTTS(text)) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      parts.push(new Uint8Array(buffer));
    }
    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) { combined.set(part, offset); offset += part.length; }
    return combined;
  } catch { return null; }
}

function splitTextForTTS(text: string, maxLen = 200): string[] {
  const cleaned = shortenForAudio(stripEmojis(text));
  if (!cleaned) return [];
  const sentences = cleaned.match(/[^.!?\n]+[.!?\n]*/g) || [cleaned];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxLen && current.length > 0) { chunks.push(current.trim()); current = s; }
    else { current += s; }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(cleaned.slice(0, maxLen));
  return chunks;
}

async function textToSpeech(text: string): Promise<Uint8Array | null> {
  const clean = shortenForAudio(stripEmojis(text));
  if (!clean) return null;

  // Edge TTS (voz grave masculina)
  for (const voice of ['es-MX-JorgeNeural', 'es-ES-AlvaroNeural']) {
    const result = await textToSpeechEdge(clean, voice);
    if (result) { console.log('TTS done with Edge', voice); return result; }
  }

  // Google TTS fallback
  for (const lang of ['es-MX', 'es-ES', 'es']) {
    const result = await textToSpeechGoogle(clean, lang);
    if (result) return result;
  }

  console.error('All TTS services failed');
  return null;
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

// Motor IA desacoplado — ver función backend "processMessage" (Function Calling dinámico)

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
        console.log(`[Webhook] Conversation ${conversation.id} status="${conversation.status}" shouldRespond=${shouldRespond}`);

        if (shouldRespond && openAiKey) {
          const bots = await base44.asServiceRole.entities.Bot.filter({ id: channel.bot_id });
          const bot = bots[0];

          const aiResult = await base44.asServiceRole.functions.invoke('processMessage', {
            conversation_id: conversation.id,
            bot_id: channel.bot_id,
            client_id: channel.client_id,
            user_message: customerText,
          });
          const { text: botReply, canHandle } = aiResult?.data ?? aiResult;

          // Re-read conversation status: the AI call takes several seconds,
          // during which the user may have toggled "Atención Humana" (needs_human)
          // or closed the conversation. If so, don't send the bot reply.
          const freshConvs = await base44.asServiceRole.entities.Conversation.filter({ id: conversation.id });
          const freshStatus = freshConvs[0]?.status;
          if (freshStatus !== 'open' && freshStatus !== 'bot_active') {
            console.log(`[Webhook] Status changed to "${freshStatus}" during AI processing — skipping bot reply`);
            await base44.asServiceRole.entities.Conversation.update(conversation.id, {
              last_message_at: now,
              last_message_preview: customerText,
              message_count: (conversation.message_count || 1),
            });
            continue;
          }

          const respondWithAudio = messageType === 'audio';
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

          const escalationMsg = !canHandle && bot?.human_escalation_message
            ? bot.human_escalation_message
            : undefined;

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
          }

          // Re-read status one final time right before updating.
          // The TTS + send + escalation steps above can take several seconds,
          // during which the human may have toggled "Atención Humana" (needs_human)
          // or closed the conversation. The bot must NEVER overwrite a manual
          // human state back to bot_active — otherwise the next inbound message
          // would reactivate the bot by itself.
          const finalCheck = await base44.asServiceRole.entities.Conversation.filter({ id: conversation.id });
          const finalStatus = finalCheck[0]?.status;
          const newStatus = canHandle ? 'bot_active' : 'needs_human';

          const updateData: any = {
            last_message_at: now,
            last_message_preview: botReply,
            message_count: (conversation.message_count || 1) + (escalationMsg ? 2 : 1),
          };
          // Only change the status if the conversation is still in a bot-managed state.
          // If the human set needs_human or closed it, preserve that intent.
          if (finalStatus === 'open' || finalStatus === 'bot_active') {
            updateData.status = newStatus;
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