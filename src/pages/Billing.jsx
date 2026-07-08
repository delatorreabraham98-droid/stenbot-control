import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { CreditCard, Users, DollarSign, MessageSquare, Loader2, Pencil, Search, TrendingUp, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PLANS = {
  starter: { label: 'Starter', price: 9.90, messageLimit: 1000 },
  pro: { label: 'Pro', price: 499, messageLimit: 10000 },
  enterprise: { label: 'Enterprise', price: 1499, messageLimit: 50000 },
};

const BILLING_STATUS = {
  current: { label: 'Al corriente', color: 'text-green-600 bg-green-500/10' },
  past_due: { label: 'Vencido', color: 'text-red-600 bg-red-500/10' },
  canceled: { label: 'Cancelado', color: 'text-gray-600 bg-gray-500/10' },
  trialing: { label: 'Prueba', color: 'text-blue-600 bg-blue-500/10' },
};

const emptyForm = { plan: 'starter', billing_status: 'trialing', message_limit: 1000, monthly_amount: 0, next_billing_date: '', billing_cycle_start: '' };

export default function Billing() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') toast.success('¡Suscripción activada! El pago se procesó correctamente.');
    if (params.get('status') === 'cancelled') toast.info('Pago cancelado.');
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Client.list('-created_date', 200);
      setClients(data);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.business_name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.billing_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totals = {
    mrr: clients.reduce((sum, c) => sum + (c.monthly_amount || 0), 0),
    active: clients.filter(c => c.billing_status === 'current' || c.billing_status === 'trialing').length,
    pastDue: clients.filter(c => c.billing_status === 'past_due').length,
    totalMessages: clients.reduce((sum, c) => sum + (c.messages_used || 0), 0),
  };

  const openEdit = (c) => {
    setEditClient(c);
    setForm({
      plan: c.plan || 'starter',
      billing_status: c.billing_status || 'trialing',
      message_limit: c.message_limit || 1000,
      monthly_amount: c.monthly_amount || 0,
      next_billing_date: c.next_billing_date || '',
      billing_cycle_start: c.billing_cycle_start || '',
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const updateData = { ...form };
      if (!updateData.next_billing_date) delete updateData.next_billing_date;
      if (!updateData.billing_cycle_start) delete updateData.billing_cycle_start;
      await base44.entities.Client.update(editClient.id, updateData);
      toast.success('Facturación actualizada');
      setEditClient(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onPlanChange = (plan) => {
    const p = PLANS[plan];
    setForm(f => ({ ...f, plan, monthly_amount: p.price, message_limit: p.messageLimit }));
  };

  const handleCheckout = async (clientId, plan) => {
    if (window.self !== window.top) {
      toast.error('El pago solo funciona desde la app publicada, no desde el editor.');
      return;
    }
    setCheckoutLoading(plan);
    try {
      const res = await base44.functions.invoke('createCheckoutSession', { plan, client_id: clientId });
      if (res.data?.url) window.location.href = res.data.url;
    } catch (err) {
      toast.error('Error al crear checkout: ' + err.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Facturación y Suscripciones" subtitle="Gestiona planes, límites y estados de cuenta" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Ingreso mensual (MRR)" value={`$${totals.mrr.toLocaleString()}`} icon={DollarSign} color="success" />
        <StatCard title="Suscripciones activas" value={totals.active} icon={Users} color="primary" />
        <StatCard title="Cuentas vencidas" value={totals.pastDue} icon={CreditCard} color="warning" />
        <StatCard title="Mensajes totales" value={totals.totalMessages.toLocaleString()} icon={MessageSquare} color="blue" />
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(BILLING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CreditCard} title="Sin clientes" description="No hay clientes que coincidan con los filtros." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Mensual</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Uso</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Próx. factura</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const plan = PLANS[c.plan] || PLANS.starter;
                  const usagePercent = plan.messageLimit > 0 ? Math.min(100, Math.round(((c.messages_used || 0) / plan.messageLimit) * 100)) : 0;
                  const bs = BILLING_STATUS[c.billing_status] || BILLING_STATUS.trialing;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{c.business_name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.plan} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${bs.color}`}>{bs.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">${c.monthly_amount || 0}</td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="text-xs text-muted-foreground mb-1">{c.messages_used || 0}/{plan.messageLimit}</div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${usagePercent > 90 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${usagePercent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.next_billing_date ? format(new Date(c.next_billing_date), "d MMM yyyy", { locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {c.billing_status !== 'current' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700"
                              onClick={() => handleCheckout(c.id, c.plan || 'pro')}
                              disabled={checkoutLoading === (c.plan || 'pro')}
                              title="Suscribir vía Stripe"
                            >
                              {checkoutLoading === (c.plan || 'pro') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar facturación — {editClient?.business_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={onPlanChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLANS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} — ${v.price}/mes</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado de facturación</Label>
                <Select value={form.billing_status} onValueChange={v => setForm(f => ({ ...f, billing_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Límite de mensajes/mes</Label>
                <Input type="number" value={form.message_limit} onChange={e => setForm(f => ({ ...f, message_limit: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Monto mensual ($)</Label>
                <Input type="number" value={form.monthly_amount} onChange={e => setForm(f => ({ ...f, monthly_amount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Inicio del ciclo</Label>
                <Input type="date" value={form.billing_cycle_start} onChange={e => setForm(f => ({ ...f, billing_cycle_start: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Próxima factura</Label>
                <Input type="date" value={form.next_billing_date} onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => handleCheckout(editClient.id, form.plan)} disabled={checkoutLoading === form.plan}>
              {checkoutLoading === form.plan ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><Zap className="w-4 h-4" /> Suscribir vía Stripe</>}
            </Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}