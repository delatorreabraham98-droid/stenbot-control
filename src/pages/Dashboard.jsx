import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, MessageSquare, UserPlus, AlertTriangle, Bot, Radio, TrendingUp, Activity, Plug, Building2 } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [bots, setBots] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Client.list('-created_date', 200),
      base44.entities.Conversation.list('-last_message_at', 200),
      base44.entities.Lead.list('-created_date', 200),
      base44.entities.Bot.list('-created_date', 200),
      base44.entities.Channel.list('-created_date', 200),
    ]).then(([c, conv, l, b, ch]) => {
      setClients(c);
      setConversations(conv);
      setLeads(l);
      setBots(b);
      setChannels(ch);
    }).finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const todayConversations = conversations.filter(c => new Date(c.created_date).toDateString() === today);
  const todayLeads = leads.filter(l => new Date(l.created_date).toDateString() === today);
  const needsHuman = conversations.filter(c => c.status === 'needs_human');
  const activeClients = clients.filter(c => c.status === 'active');
  const activeBots = bots.filter(b => b.active);
  const clientsWithChannels = [...new Set(channels.map(ch => ch.client_id).filter(Boolean))].length;
  const clientsWithBots = [...new Set(bots.map(b => b.client_id).filter(Boolean))].length;
  const todaysClients = clients.filter(c => new Date(c.created_date).toDateString() === today);

  // Last 7 days chart data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toDateString();
    return {
      day: format(d, 'EEE', { locale: es }),
      conversaciones: conversations.filter(c => new Date(c.created_date).toDateString() === dateStr).length,
      leads: leads.filter(l => new Date(l.created_date).toDateString() === dateStr).length,
    };
  });

  const recentConversations = conversations.filter(c => c.status === 'needs_human').slice(0, 5);
  const recentClients = [...clients].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()).slice(0, 5);

  const clientBotCount = (clientId) => bots.filter(b => b.client_id === clientId && b.active).length;
  const clientChannelCount = (clientId) => channels.filter(ch => ch.client_id === clientId && ch.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={`Hoy, ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Clientes activos" value={loading ? '—' : activeClients.length} icon={Users} color="primary" loading={loading} />
        <StatCard title="Conversaciones hoy" value={loading ? '—' : todayConversations.length} icon={MessageSquare} color="blue" loading={loading} />
        <StatCard title="Leads hoy" value={loading ? '—' : todayLeads.length} icon={UserPlus} color="success" loading={loading} />
        <StatCard title="Requieren humano" value={loading ? '—' : needsHuman.length} icon={AlertTriangle} color="warning" loading={loading} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bots activos</p>
            <p className="text-lg font-bold text-foreground">{loading ? '—' : activeBots.length}</p>
            <p className="text-[10px] text-muted-foreground">{clientsWithBots} clientes con bot</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
            <Plug className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canales activos</p>
            <p className="text-lg font-bold text-foreground">{loading ? '—' : channels.filter(ch => ch.status === 'active').length}</p>
            <p className="text-[10px] text-muted-foreground">{clientsWithChannels} clientes con canal</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Registros hoy</p>
            <p className="text-lg font-bold text-foreground">{loading ? '—' : todaysClients.length}</p>
            <p className="text-[10px] text-muted-foreground">nuevos clientes</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total canales</p>
            <p className="text-lg font-bold text-foreground">{loading ? '—' : channels.length}</p>
            <p className="text-[10px] text-muted-foreground">WhatsApp / IG / Messenger</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Actividad (últimos 7 días)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7} barSize={10} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Bar dataKey="conversaciones" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leads" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Clients */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Últimos registros
            </h2>
            {loading ? (
              <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : recentClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin clientes registrados</p>
            ) : (
              <div className="space-y-2">
                {recentClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.business_name}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(c.created_date), 'dd MMM HH:mm', { locale: es })}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                      {clientBotCount(c.id) > 0 && <span className="text-green-500">{clientBotCount(c.id)} bot{clientBotCount(c.id) > 1 ? 's' : ''}</span>}
                      {clientChannelCount(c.id) > 0 && <span className="text-blue-500">· {clientChannelCount(c.id)} canal{clientChannelCount(c.id) > 1 ? 'es' : ''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Resumen
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Clientes con bot', value: clientsWithBots, total: clients.length },
                { label: 'Clientes con canal', value: clientsWithChannels, total: clients.length },
                { label: 'Clientes Pro', value: clients.filter(c => c.plan === 'pro').length, total: clients.length },
                { label: 'Leads ganados', value: leads.filter(l => l.status === 'won').length, total: leads.length },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{loading ? '—' : `${item.value} / ${item.total}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Needs Human */}
      {recentConversations.length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Conversaciones que requieren atención humana
          </h2>
          <div className="space-y-2">
            {recentConversations.map(conv => (
              <div key={conv.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-foreground">{conv.customer_name || conv.external_user_id}</p>
                  <p className="text-xs text-muted-foreground">{conv.last_message_preview}</p>
                </div>
                <StatusBadge status={conv.channel_type || 'whatsapp'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}