import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CalendarDays, Pencil, Trash2, Check, X, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const emptyForm = {
  client_id: '', date: '', available: true,
  customer_name: '', event_name: '', notes: ''
};

export default function Availability() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState('all');

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Availability.list('date', 500),
      base44.entities.Client.list('-created_date', 200),
    ]).then(([a, c]) => {
      let mine = a;
      if (!isAdmin) mine = a.filter(x => x.client_email === user.email);
      setRows(mine);
      setClients(c);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const shown = filterClient === 'all' ? rows : rows.filter(r => r.client_id === filterClient);

  const openCreate = () => {
    const defaultClient = isAdmin ? (clients[0]?.id || '') : (clients.find(c => c.email === user.email)?.id || '');
    setForm({ ...emptyForm, client_id: defaultClient, date: new Date().toISOString().slice(0, 10) });
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (r) => { setForm({ ...r }); setEditing(r.id); setOpen(true); };

  const save = async () => {
    if (!form.date || !form.client_id) { toast.error('Fecha y cliente son obligatorios'); return; }
    setSaving(true);
    const client = clients.find(c => c.id === form.client_id);
    const payload = { ...form, client_email: client?.email || '' };
    try {
      if (editing) {
        await base44.entities.Availability.update(editing, payload);
        toast.success('Disponibilidad actualizada');
      } else {
        await base44.entities.Availability.create(payload);
        toast.success('Fecha registrada');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error('No se pudo guardar');
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta fecha?')) return;
    await base44.entities.Availability.delete(id);
    toast.success('Fecha eliminada');
    load();
  };

  const toggle = async (r) => {
    await base44.entities.Availability.update(r.id, { available: !r.available });
    load();
  };

  const formatDate = (d) => {
    try {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Disponibilidad"
        subtitle="Calendario de fechas reservadas y libres que el bot consulta en tiempo real"
        action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nueva fecha</Button>}
      />

      {isAdmin && clients.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Filtrar por cliente:</span>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array(6).fill(0).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin fechas registradas"
          description="Agrega las fechas reservadas y disponibles para que el bot responda consultas de disponibilidad."
          action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nueva fecha</Button>}
        />
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="col-span-3">Fecha</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-3">Cliente</div>
            <div className="col-span-3">Evento</div>
            <div className="col-span-1 text-right">Acciones</div>
          </div>
          <div className="divide-y divide-border">
            {shown.map(r => (
              <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-3">
                  <p className="text-sm font-medium text-foreground capitalize">{formatDate(r.date)}</p>
                  {isAdmin && <p className="text-xs text-muted-foreground">{clientName(r.client_id)}</p>}
                </div>
                <div className="col-span-2">
                  {r.available ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-lg">
                      <Check className="w-3 h-3" /> Disponible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-500/10 px-2 py-1 rounded-lg">
                      <Lock className="w-3 h-3" /> Reservada
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-sm text-foreground truncate">{r.customer_name || '—'}</div>
                <div className="col-span-3 text-sm text-muted-foreground truncate">{r.event_name || '—'}</div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(r)} title={r.available ? 'Marcar reservada' : 'Marcar disponible'}>
                    {r.available ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar fecha' : 'Nueva fecha'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.available ? 'true' : 'false'} onValueChange={v => setForm(f => ({ ...f, available: v === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Disponible</SelectItem>
                    <SelectItem value="false">Reservada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente (evento)</Label>
                <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Nombre del cliente" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} placeholder="Boda, XV años, etc." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notas internas" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !form.date || !form.client_id}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Registrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}