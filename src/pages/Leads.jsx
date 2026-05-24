import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { UserPlus, Search, Pencil, Download, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_OPTIONS = ['new', 'contacted', 'quoted', 'won', 'lost'];

export default function Leads() {
  const { isAdmin, clientProfile } = useAuth();
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState(isAdmin ? 'all' : clientProfile?.id || 'all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const clientId = isAdmin ? null : clientProfile?.id;

  const load = () => {
    setLoading(true);
    const promises = [base44.entities.Lead.list('-created_date', 300)];

    if (isAdmin) {
      promises.push(base44.entities.Client.list('-created_date', 200));
    }

    Promise.all(promises).then(([l, c]) => {
      setLeads(l);
      if (c) setClients(c);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [isAdmin, clientProfile?.id]);

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.customer_name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchClient = clientId ? l.client_id === clientId : (filterClient === 'all' || l.client_id === filterClient);
    return matchSearch && matchStatus && matchClient;
  });

  const openEdit = (lead) => { setForm({ ...lead }); setOpen(true); };

  const save = async () => {
    setSaving(true);
    await base44.entities.Lead.update(form.id, form);
    toast.success('Lead actualizado');
    setSaving(false);
    setOpen(false);
    load();
  };

  const exportCSV = () => {
    const headers = ['Nombre', 'Teléfono', 'Email', 'Producto', 'Ciudad', 'Estado', 'Cliente', 'Fecha'];
    const rows = filtered.map(l => [
      l.customer_name, l.phone, l.email, l.product_interest,
      l.city, l.status, clientName(l.client_id),
      format(new Date(l.created_date), 'dd/MM/yyyy')
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Leads"
        subtitle="Prospectos capturados por los bots"
        action={
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />Exportar CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar nombre o teléfono..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(s => {
          const count = leads.filter(l => l.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}>
              {s}: {count}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserPlus} title="Sin leads" description="Los bots capturarán leads automáticamente aquí." />
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Ciudad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{lead.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{clientName(lead.client_id)}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-foreground">{lead.phone || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">{lead.product_interest || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">{lead.city || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {format(new Date(lead.created_date), 'dd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar lead</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={form.customer_name || ''} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Producto de interés</Label>
                  <Input value={form.product_interest || ''} onChange={e => setForm(f => ({ ...f, product_interest: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad</Label>
                  <Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notas internas</Label>
                <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Actualizar lead'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}