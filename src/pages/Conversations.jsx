import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Search, AlertTriangle, X, ChevronRight, Send, UserCheck } from 'lucide-react';
import WhatsAppReplyModal from '@/components/conversations/WhatsAppReplyModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyModal, setReplyModal] = useState(null); // conversation to reply to

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Conversation.list('-last_message_at', 200),
      base44.entities.Client.list('-created_date', 200),
    ]).then(([conv, cl]) => { setConversations(conv); setClients(cl); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadMessages = async (conv) => {
    setSelected(conv);
    setLoadingMessages(true);
    const msgs = await base44.entities.Message.filter({ conversation_id: conv.id }, 'created_date', 100);
    setMessages(msgs);
    setLoadingMessages(false);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');
    try {
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: selected.id,
        message_text: text,
      });
      if (res.data?.error) {
        toast.error(`Error al enviar: ${res.data.error}`);
        setReplyText(text);
      } else {
        toast.success('Mensaje enviado');
        loadMessages(selected);
        load();
      }
    } catch (err) {
      toast.error(`Error al enviar: ${err.response?.data?.error || err.message}`);
      setReplyText(text);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (convId, status) => {
    await base44.entities.Conversation.update(convId, { status });
    toast.success('Estado actualizado');
    load();
    if (selected?.id === convId) setSelected(prev => ({ ...prev, status }));
  };

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const filtered = conversations.filter(c => {
    const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.external_user_id?.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchClient = filterClient === 'all' || c.client_id === filterClient;
    return matchSearch && matchStatus && matchClient;
  });

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    return format(new Date(dateStr), 'dd MMM HH:mm', { locale: es });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Conversaciones" subtitle="Inbox de mensajes de todos los canales conectados" />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="open">Abierta</SelectItem>
            <SelectItem value="bot_active">Bot activo</SelectItem>
            <SelectItem value="needs_human">Requiere humano</SelectItem>
            <SelectItem value="closed">Cerrada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-96">
        {/* Conversation List */}
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground">{filtered.length} conversaciones</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-2 p-3">{Array(6).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Sin conversaciones" description="No hay conversaciones que coincidan." />
            ) : (
              filtered.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadMessages(conv)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors",
                    selected?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{conv.customer_name || conv.external_user_id}</p>
                        {conv.status === 'needs_human' && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message_preview}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={conv.channel_type || 'whatsapp'} />
                        <StatusBadge status={conv.status} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{timeAgo(conv.last_message_at)}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setReplyModal(conv); }}
                        className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors whitespace-nowrap"
                      >
                        💬 Responder
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Panel */}
        {selected ? (
          <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden flex flex-col min-w-0">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{selected.customer_name || selected.external_user_id}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={selected.channel_type || 'whatsapp'} />
                  <StatusBadge status={selected.status} />
                  <span className="text-xs text-muted-foreground">{clientName(selected.client_id)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.status !== 'needs_human' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => updateStatus(selected.id, 'needs_human')}>
                    <UserCheck className="w-3.5 h-3.5" />Escalar a humano
                  </Button>
                )}
                {selected.status !== 'closed' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => updateStatus(selected.id, 'closed')}>
                    <X className="w-3.5 h-3.5" />Cerrar
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" id="messages-container">
              {loadingMessages ? (
                <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className={cn("h-12 bg-muted animate-pulse rounded-2xl w-3/4", i % 2 === 0 ? "ml-auto" : "")} />)}</div>
              ) : messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Sin mensajes" description="No hay mensajes en esta conversación." />
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.direction === 'outbound' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm",
                      msg.direction === 'outbound'
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}>
                      <p>{msg.message_text}</p>
                      <p className={cn("text-xs mt-1", msg.direction === 'outbound' ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {msg.sender_type} · {format(new Date(msg.created_date), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply Box */}
            <div className="px-4 py-3 border-t border-border flex gap-2 items-end">
              <textarea
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-28"
                rows={1}
                placeholder="Escribe una respuesta..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              />
              <Button size="icon" onClick={sendReply} disabled={sending || !replyText.trim()} className="h-9 w-9 flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-card rounded-2xl border border-border flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Selecciona una conversación</p>
            </div>
          </div>
        )}
      </div>
      {replyModal && (
        <WhatsAppReplyModal
          conversation={replyModal}
          open={!!replyModal}
          onClose={() => setReplyModal(null)}
          onSent={() => { load(); if (selected?.id === replyModal.id) loadMessages(replyModal); }}
        />
      )}
    </div>
  );
}