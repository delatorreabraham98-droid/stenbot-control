import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const QUICK_REPLIES = [
  { label: '📍 ¿Dónde se ubica?', text: '¿Dónde se ubica su negocio o punto de instalación?' },
  { label: '🔧 ¿Desea instalación?', text: '¿Le gustaría incluir el servicio de instalación?' },
  { label: '📅 ¿Desea agendar?', text: '¿Desea agendar una visita o cita con nosotros?' },
  { label: '💰 Le mando precio', text: 'Con gusto le envío la lista de precios actualizada.' },
];

export default function WhatsAppReplyModal({ conversation, open, onClose, onSent }) {
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!messageBody.trim()) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: conversation.id,
        message_text: messageBody.trim(),
      });
      if (res.data?.success === false && res.data?.saved) {
        toast.warning(`Guardado en CRM, pero no llegó a WhatsApp: ${res.data.error}`);
        setMessageBody('');
        onClose();
        if (onSent) onSent();
      } else if (res.data?.error && !res.data?.saved) {
        toast.error('No se pudo enviar el mensaje');
      } else {
        toast.success('Mensaje enviado correctamente');
        setMessageBody('');
        onClose();
        if (onSent) onSent();
      }
    } catch {
      toast.error('No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessageBody('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Responder por WhatsApp
          </DialogTitle>
        </DialogHeader>

        {conversation && (
          <p className="text-sm text-muted-foreground -mt-2">
            Para: <span className="font-medium text-foreground">{conversation.customer_name || conversation.external_user_id}</span>
            {conversation.customer_phone && <span className="ml-1 text-xs">({conversation.customer_phone})</span>}
          </p>
        )}

        {/* Quick Replies */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr.label}
              onClick={() => setMessageBody(qr.text)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors"
            >
              {qr.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[100px]"
          placeholder="Escribe el mensaje..."
          value={messageBody}
          onChange={e => setMessageBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
        />
        <p className="text-xs text-muted-foreground -mt-2">Ctrl+Enter para enviar</p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !messageBody.trim()} className="gap-2">
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}