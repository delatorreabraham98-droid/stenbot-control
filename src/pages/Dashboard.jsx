import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, MessageSquare, UserPlus, AlertTriangle, Bot, Radio, TrendingUp, Activity } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Client.list('-created_date', 100),
      base44.entities.Conversation.list('-last_message_at', 100),
      base44.entities.Lead.list('-created_date', 100),
      base44.entities.Bot.list('-created_date', 100),
    ]).then(([c, conv, l, b]) => {
      setClients(c);
      setConversations(conv);
      setLeads(l);
      setBots(b);
    }).finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const todayConversations = conversations.filter(c => new Date(c.created_date).toDateString() === today);
  const todayLeads = leads.filter(l => new Date(l.created_date).toDateString() === today);
  const needsHuman = conversations.filter(c => c.status === 'needs_human');
  const activeClients = clients.filter(c => c.status === 'active');

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

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Resumen
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Bots activos', value: bots.filter(b => b.active).length, total: bots.length },
                { label: 'Clientes Pro', value: clients.filter(c => c.plan === 'pro').length, total: clients.length },
                { label: 'Clientes Enterprise', value: clients.filter(c => c.plan === 'enterprise').length, total: clients.length },
                { label: 'Leads ganados', value: leads.filter(l => l.status === 'won').length, total: leads.length },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{loading ? '—' : `${item.value} / ${item.total}`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Canales
            </h2>
            <p className="text-sm text-muted-foreground">Ve a <span className="font-medium text-foreground">Canales</span> para gestionar las conexiones de Meta.</p>
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