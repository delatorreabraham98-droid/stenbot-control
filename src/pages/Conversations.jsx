import { useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { MessageSquare, Search, AlertTriangle, X, Send, Mic, Volume2, RefreshCw } from 'lucide-react';
import WhatsAppReplyModal from '@/components/conversations/WhatsAppReplyModal';
import QuickReplies from '@/components/conversations/QuickReplies';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// Marks a conversation as "urgent" if last message was inbound and >30min ago with no human response
function isUrgent(conv) {
  if (conv.status === 'closed') return false;
  if (!conv.last_message_at) return false;
  const diff = Date.now() - new Date(conv.last_message_at).getTime();
  return diff > 30 * 60 * 1000;
}

export default function Conversations() {
  const { isAdmin, clientProfile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState(isAdmin ? 'all' : clientProfile?.id || 'all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyModal, setReplyModal] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;
  const replyTextRef = useRef('');
  replyTextRef.current = replyText;
  const draftsRef = useRef({});

  const clientId = isAdmin ? null : clientProfile?.id;

  // ── Data loading ──────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const promises = [base44.entities.Conversation.list('-last_message_at', 200)];
    if (isAdmin) promises.push(base44.entities.Client.list('-created_date', 200));
    Promise.all(promises).then(([conv, cl]) => {
      setConversations(conv);
      if (cl) setClients(cl);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => { load(); }, [load, clientProfile?.id]);

  // ── Real-time: subscribe to Conversation changes ──────────────
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe((event) => {
      if (event.type === 'create') {
        setConversations(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setConversations(prev => prev.map(c => c.id === event.data.id ? { ...c, ...event.data } : c));
        // If it's the open conversation, update selected too
        if (selectedRef.current?.id === event.data.id) {
          setSelected(prev => ({ ...prev, ...event.data }));
        }
      }
    });
    return unsub;
  }, []);

  // ── Real-time: subscribe to new Messages ──────────────────────
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create' && selectedRef.current?.id === event.data.conversation_id) {
        // Only add if not already in list (avoid duplicate with optimistic update)
        setMessages(prev => {
          const exists = prev.some(m => m.id === event.data.id);
          if (exists) return prev;
          // Replace temp optimistic message if text matches
          const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.message_text === event.data.message_text);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = event.data;
            return next;
          }
          return [...prev, event.data];
        });
      }
    });
    return unsub;
  }, []);

  // ── Auto-scroll to bottom ─────────────────────────────────────
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, scrollToBottom]);

  // ── Load messages for selected conversation ───────────────────
  const loadMessages = async (conv) => {
    // Preserve the draft of the conversation we're leaving, restore the new one
    if (selectedRef.current) {
      draftsRef.current[selectedRef.current.id] = replyTextRef.current;
    }
    setSelected(conv);
    setReplyText(draftsRef.current[conv.id] || '');
    setLoadingMessages(true);
    setMessages([]);
    const msgs = await base44.entities.Message.filter({ conversation_id: conv.id }, 'created_date', 100);
    setMessages(msgs);
    setLoadingMessages(false);
    // Instant scroll on first load
    setTimeout(() => scrollToBottom('instant'), 50);
  };

  // ── Send reply ────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    const text = replyText.trim();
    const convId = selected.id;
    setReplyText('');

    const tempMsg = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      direction: 'outbound',
      sender_type: 'human',
      message_text: text,
      created_date: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: convId,
        message_text: text,
      });
      if (res.data?.success === false && res.data?.saved) {
        toast.warning(`Guardado en CRM pero no llegó a WhatsApp: ${res.data.error}`);
      } else if (res.data?.error && !res.data?.saved) {
        toast.error(`Error al enviar: ${res.data.error}`);
        setReplyText(text);
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        return;
      }
      load();
    } catch (err) {
      toast.error(`Error al enviar: ${err.response?.data?.error || err.message}`);
      setReplyText(text);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (convId, status) => {
    // Optimistic update so the UI reflects the change immediately
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, status } : c));
    if (selected?.id === convId) setSelected(prev => ({ ...prev, status }));
    try {
      await base44.entities.Conversation.update(convId, { status });
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error(`No se pudo guardar: ${err.response?.data?.error || err.message}`);
      // Revert on failure
      load();
      if (selected?.id === convId) {
        const fresh = conversations.find(c => c.id === convId);
        if (fresh) setSelected(prev => ({ ...prev, status: fresh.status }));
      }
    }
  };

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const filtered = conversations.filter(c => {
    const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.external_user_id?.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchClient = clientId ? c.client_id === clientId : (filterClient === 'all' || c.client_id === filterClient);
    return matchSearch && matchStatus && matchClient;
  });

  const timeLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch { return ''; }
  };

  // Group messages by day
  const groupedMessages = messages.reduce((groups, msg) => {
    const day = format(new Date(msg.created_date), 'yyyy-MM-dd');
    if (!groups[day]) groups[day] = [];
    groups[day].push(msg);
    return groups;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
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
        {isAdmin && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="icon" onClick={load} title="Actualizar">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-96">

        {/* ── Conversation List ── */}
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{filtered.length} conversaciones</p>
            {filtered.filter(isUrgent).length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                🔴 {filtered.filter(isUrgent).length} urgente{filtered.filter(isUrgent).length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-2 p-3">{Array(6).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Sin conversaciones" description="No hay conversaciones que coincidan." />
            ) : (
              filtered.map(conv => {
                const urgent = isUrgent(conv);
                return (
                  <div
                    key={conv.id}
                    onClick={() => loadMessages(conv)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer",
                      selected?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary",
                      urgent && selected?.id !== conv.id && "border-l-2 border-l-red-400 bg-red-50/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{conv.customer_name || conv.external_user_id}</p>
                          {conv.status === 'needs_human' && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                          {urgent && conv.status !== 'needs_human' && <span className="text-xs text-red-500 font-bold flex-shrink-0">!</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message_preview}</p>
                        {conv.customer_phone && (
                          <p className="text-xs text-muted-foreground font-mono">📱 {conv.customer_phone}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={conv.channel_type || 'whatsapp'} />
                          <StatusBadge status={conv.status} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeLabel(conv.last_message_at)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setReplyModal(conv); }}
                          className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors whitespace-nowrap"
                        >
                          💬 Responder
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Message Panel ── */}
        {selected ? (
          <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden flex flex-col min-w-0">

            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{selected.customer_name || selected.external_user_id}</p>
                {selected.customer_phone && (
                  <p className="text-xs text-muted-foreground font-mono">📱 {selected.customer_phone}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={selected.channel_type || 'whatsapp'} />
                  <StatusBadge status={selected.status} />
                  {isAdmin && <span className="text-xs text-muted-foreground">{clientName(selected.client_id)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Switch
                    checked={selected.status === 'needs_human'}
                    onCheckedChange={(checked) => updateStatus(selected.id, checked ? 'needs_human' : 'bot_active')}
                  />
                  <span className="text-xs font-medium text-foreground">Atención Humana</span>
                </label>
                {selected.status !== 'closed' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => updateStatus(selected.id, 'closed')}>
                    <X className="w-3.5 h-3.5" />Cerrar
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={messagesContainerRef}>
              {loadingMessages ? (
                <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className={cn("h-12 bg-muted animate-pulse rounded-2xl w-3/4", i % 2 === 0 ? "ml-auto" : "")} />)}</div>
              ) : messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Sin mensajes" description="No hay mensajes en esta conversación." />
              ) : (
                Object.entries(groupedMessages).map(([day, dayMsgs]) => (
                  <div key={day}>
                    {/* Day separator */}
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground px-2 font-medium">
                        {format(new Date(day), "d 'de' MMMM", { locale: es })}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-1.5">
                      {dayMsgs.map((msg, idx) => {
                        const isOut = msg.direction === 'outbound';
                        const isTemp = msg.id.startsWith('temp-');
                        const prevMsg = dayMsgs[idx - 1];
                        const sameSender = prevMsg && prevMsg.direction === msg.direction;

                        return (
                          <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start", sameSender ? "mt-0.5" : "mt-2")}>
                            <div className={cn(
                              "max-w-[75%] px-3.5 py-2 rounded-2xl text-sm",
                              isOut
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm",
                              isTemp && "opacity-60"
                            )}>
                              {msg.message_type === 'audio' && (
                                <div className="flex items-center gap-1.5 mb-1 text-xs opacity-70">
                                  {isOut ? <Volume2 className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                  <span>Mensaje de audio</span>
                                </div>
                              )}
                              <p className="leading-snug whitespace-pre-wrap">{msg.message_text}</p>
                              <div className={cn("flex items-center gap-1.5 mt-1", isOut ? "justify-end" : "justify-start")}>
                                <span className={cn("text-xs", isOut ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                  {msg.sender_type === 'bot' ? '🤖' : msg.sender_type === 'human' ? '👤' : ''}
                                  {' '}{format(new Date(msg.created_date), 'HH:mm')}
                                </span>
                                {isTemp && <span className="text-xs opacity-50">Enviando...</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <QuickReplies
              clientId={selected.client_id}
              clientEmail={selected.client_email}
              onSelect={(text) => setReplyText(prev => prev ? prev + ' ' + text : text)}
            />

            {/* Reply Box */}
            <div className="px-4 py-3 border-t border-border flex gap-2 items-end">
              <textarea
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-28"
                rows={1}
                placeholder="Escribe una respuesta... (Enter para enviar, Shift+Enter para nueva línea)"
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
              <p className="text-muted-foreground text-sm">Selecciona una conversación para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>

      {replyModal && (
        <WhatsAppReplyModal
          conversation={replyModal}
          open={!!replyModal}
          onClose={() => setReplyModal(null)}
          onSent={() => { load(); loadMessages(replyModal); }}
        />
      )}
    </div>
  );
}