import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MessageSquare, Clock, CheckCircle, TrendingUp, Activity, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const PERIODS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export default function Analytics() {
  const { isAdmin } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [clientFilter, setClientFilter] = useState('all');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [convs, msgs, cls] = await Promise.all([
        base44.entities.Conversation.list('-created_date', 500),
        base44.entities.Message.list('-created_date', 1000),
        isAdmin ? base44.entities.Client.list('-created_date', 100) : Promise.resolve([]),
      ]);
      setConversations(convs);
      setMessages(msgs);
      setClients(cls);
    } catch (err) {
      toast.error('Error al cargar métricas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const days = parseInt(period);
  const startDate = subDays(new Date(), days);

  const filteredConvs = useMemo(() => {
    let result = conversations.filter(c => new Date(c.created_date) >= startDate);
    if (clientFilter !== 'all') {
      result = result.filter(c => c.client_id === clientFilter);
    }
    return result;
  }, [conversations, period, clientFilter, startDate]);

  const filteredMsgs = useMemo(() => {
    let result = messages.filter(m => new Date(m.created_date) >= startDate);
    if (clientFilter !== 'all') {
      const convIds = new Set(filteredConvs.map(c => c.id));
      result = result.filter(m => convIds.has(m.conversation_id));
    }
    return result;
  }, [messages, filteredConvs, period, clientFilter]);

  const dailyData = useMemo(() => {
    const range = eachDayOfInterval({ start: startDate, end: new Date() });
    return range.map(date => {
      const dateStr = date.toDateString();
      const dayMsgs = filteredMsgs.filter(m => new Date(m.created_date).toDateString() === dateStr);
      const dayConvs = filteredConvs.filter(c => new Date(c.created_date).toDateString() === dateStr);
      const inbound = dayMsgs.filter(m => m.direction === 'inbound').length;
      const outbound = dayMsgs.filter(m => m.direction === 'outbound').length;
      return {
        date: format(date, 'd MMM', { locale: es }),
        entrantes: inbound,
        salientes: outbound,
        conversaciones: dayConvs.length,
      };
    });
  }, [filteredMsgs, filteredConvs, startDate]);

  const stats = useMemo(() => {
    const totalMsgs = filteredMsgs.length;
    const inbound = filteredMsgs.filter(m => m.direction === 'inbound').length;
    const outbound = filteredMsgs.filter(m => m.direction === 'outbound').length;
    const resolved = filteredConvs.filter(c => c.status === 'closed').length;
    const needsHuman = filteredConvs.filter(c => c.status === 'needs_human').length;
    const botActive = filteredConvs.filter(c => c.status === 'bot_active').length;
    const resolutionRate = filteredConvs.length > 0 ? Math.round((resolved / filteredConvs.length) * 100) : 0;

    const responseTimes = filteredMsgs
      .filter(m => m.direction === 'outbound' && m.sender_type === 'bot')
      .map(m => new Date(m.created_date));
    
    const avgResponseMin = '—';

    return {
      totalMsgs,
      totalConvs: filteredConvs.length,
      resolutionRate,
      needsHuman,
      botHandled: botActive,
      inbound,
      outbound,
    };
  }, [filteredMsgs, filteredConvs]);

  const statusData = useMemo(() => {
    const counts = {};
    filteredConvs.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    const labels = { open: 'Abiertas', bot_active: 'Bot activo', needs_human: 'Humano', closed: 'Cerradas' };
    const colors = { open: 'hsl(38 92% 50%)', bot_active: 'hsl(252 80% 54%)', needs_human: 'hsl(0 84% 60%)', closed: 'hsl(142 76% 36%)' };
    return Object.entries(counts).map(([key, value]) => ({ name: labels[key] || key, value, color: colors[key] || '#999' }));
  }, [filteredConvs]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Métricas de Conversación"
        subtitle="Analiza el rendimiento de tus bots y conversaciones"
        action={
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Mensajes totales" value={stats.totalMsgs} icon={MessageSquare} color="primary" />
            <StatCard title="Conversaciones" value={stats.totalConvs} icon={BarChart3} color="blue" />
            <StatCard title="Tasa de resolución" value={`${stats.resolutionRate}%`} icon={CheckCircle} color="success" />
            <StatCard title="Req. atención humana" value={stats.needsHuman} icon={Activity} color="warning" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="p-5 lg:col-span-2">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Volumen de mensajes
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="entrantes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Entrantes" />
                  <Line type="monotone" dataKey="salientes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Salientes" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Estado de conversaciones
              </h2>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">Sin datos</div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Conversaciones nuevas por día
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Bar dataKey="conversaciones" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Nuevas conversaciones" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}