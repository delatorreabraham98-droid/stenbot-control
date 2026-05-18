import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, BookOpen, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';

const CATEGORIES = ['faq', 'product', 'pricing', 'policy', 'schedule', 'warranty', 'installation', 'wholesale', 'other'];
const CATEGORY_LABELS = {
  faq: 'FAQ', product: 'Producto', pricing: 'Precios', policy: 'Políticas',
  schedule: 'Horarios', warranty: 'Garantías', installation: 'Instalación',
  wholesale: 'Mayoreo', other: 'Otro'
};

const emptyForm = { client_id: '', title: '', content: '', category: 'faq', active: true };

export default function Knowledge() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.KnowledgeItem.list('-created_date', 300),
      base44.entities.Client.list('-created_date', 200),
    ]).then(([it, cl]) => { setItems(it); setClients(cl); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const filtered = items.filter(it => {
    const matchSearch = !search || it.title?.toLowerCase().includes(search.toLowerCase()) || it.content?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || it.category === filterCat;
    const matchClient = filterClient === 'all' || it.client_id === filterClient;
    return matchSearch && matchCat && matchClient;
  });

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true); };
  const openEdit = (item) => { setForm({ ...item }); setEditing(item.id); setOpen(true); };

  const save = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.KnowledgeItem.update(editing, form);
      toast.success('Elemento actualizado');
    } else {
      await base44.entities.KnowledgeItem.create(form);
      toast.success('Elemento creado');
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const toggle = async (item) => {
    await base44.entities.KnowledgeItem.update(item.id, { active: !item.active });
    toast.success(`${!item.active ? 'Activado' : 'Desactivado'}`);
    load();
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este elemento?')) return;
    await base44.entities.KnowledgeItem.delete(id);
    toast.success('Eliminado');
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Base de conocimiento"
        subtitle="FAQs, productos, precios, políticas y más"
        action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo elemento</Button>}
      />

      {/* Category pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}>
          Todos
        </button>
        {CATEGORIES.map(cat => {
          const count = items.filter(i => i.category === cat).length;
          return (
            <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCat === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}>
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Search & Client filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Sin elementos" description="Agrega el conocimiento del negocio para que el bot pueda responder mejor." action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo elemento</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className={`bg-card rounded-2xl border border-border p-4 transition-all hover:shadow-sm ${!item.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{CATEGORY_LABELS[item.category]}</span>
                    <span className="text-xs text-muted-foreground">{clientName(item.client_id)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggle(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    {item.active
                      ? <ToggleRight className="w-4 h-4 text-green-500" />
                      : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar elemento' : 'Nuevo elemento'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="¿Cuál es el precio de...?" />
            </div>
            <div className="space-y-1.5">
              <Label>Contenido *</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} placeholder="Escribe la respuesta completa que el bot debe usar..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !form.client_id || !form.title || !form.content}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear elemento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}