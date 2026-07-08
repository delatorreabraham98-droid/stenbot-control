import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Pencil, Trash2, Braces, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { key: '', value: '', description: '', active: true };

export default function GlobalVariables() {
  const { clientProfile, isAdmin } = useAuth();
  const [vars, setVars] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const clientId = clientProfile?.id;

  useEffect(() => {
    if (isAdmin) { loadClients(); loadAll(); }
    else if (clientId) { load(); }
  }, [clientId, isAdmin]);

  const loadClients = async () => { try { setClients(await base44.entities.Client.list('-created_date', 100)); } catch {} };
  const loadAll = async () => {
    setLoading(true);
    try { setVars(await base44.entities.GlobalVariable.list('-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };
  const load = async () => {
    setLoading(true);
    try { setVars(await base44.entities.GlobalVariable.filter({ client_id: clientId }, '-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const filtered = vars.filter(v => {
    const matchSearch = !search || v.key?.toLowerCase().includes(search.toLowerCase());
    const matchClient = !isAdmin || selectedClient === 'all' || v.client_id === selectedClient;
    return matchSearch && matchClient;
  });

  const openNew = () => { setForm(emptyForm); setEditId(null); setDialogOpen(true); };
  const openEdit = (v) => {
    setForm({ key: v.key || '', value: v.value || '', description: v.description || '', active: v.active });
    setEditId(v.id); setDialogOpen(true);
  };

  const save = async () => {
    if (!form.key.trim() || !form.value.trim()) { toast.error('El nombre y el contenido son obligatorios'); return; }
    try {
      const data = { ...form, key: form.key.trim(), client_id: clientId, client_email: clientProfile?.email };
      if (editId) { await base44.entities.GlobalVariable.update(editId, data); toast.success('Dato actualizado'); }
      else { await base44.entities.GlobalVariable.create(data); toast.success('Dato guardado'); }
      setDialogOpen(false); isAdmin ? loadAll() : load();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este dato?')) return;
    try { await base44.entities.GlobalVariable.delete(id); toast.success('Dato eliminado'); isAdmin ? loadAll() : load(); }
    catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (v) => {
    try { await base44.entities.GlobalVariable.update(v.id, { active: !v.active }); isAdmin ? loadAll() : load(); }
    catch (err) { toast.error(err.message); }
  };

  const getClientName = (cId) => clients.find(c => c.id === cId)?.business_name || '';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Datos Guardados"
        subtitle="Guarda información de tu negocio para reutilizarla automáticamente en tus herramientas."
        action={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nuevo dato</Button>}
      />

      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-6 text-sm text-muted-foreground">
        <Braces className="w-4 h-4 text-primary flex-shrink-0" />
        <span>Ejemplo: guardas <strong className="text-foreground">"Teléfono"</strong> con valor <strong className="text-foreground">"555-1234"</strong> y el bot lo usa automáticamente cuando lo necesita.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
        {isAdmin && (
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Braces} title="Sin datos guardados" description="Guarda información de tu negocio (teléfono, dirección, horarios) para que el bot la use automáticamente." />
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <Card key={v.id} className="p-3 flex items-center gap-3 hover:shadow-sm transition-all">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Braces className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-semibold text-primary">{`{{${v.key}}}`}</code>
                  {!v.active && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactiva</span>}
                </div>
                <p className="text-sm text-muted-foreground truncate font-mono">{v.value}</p>
                {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                {isAdmin && v.client_id && <p className="text-xs text-muted-foreground mt-0.5">{getClientName(v.client_id)}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(v)}><Switch checked={v.active} className="scale-75 pointer-events-none" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(v.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Editar dato' : 'Nuevo dato'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del dato</Label>
              <Input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, '_') }))} placeholder="TELEFONO" className="font-mono" />
              <p className="text-xs text-muted-foreground">Usa un nombre corto, sin espacios (ej: DIRECCION, HORARIO)</p>
            </div>
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="Av. Reforma 123, CDMX" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Para uso interno" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={val => setForm(f => ({ ...f, active: val }))} />
              Variable activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}