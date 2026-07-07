import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Pencil, Trash2, MessageSquare, Search, Loader2, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'saludo', label: 'Saludo', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'seguimiento', label: 'Seguimiento', color: 'bg-amber-500/10 text-amber-600' },
  { value: 'cierre', label: 'Cierre', color: 'bg-green-500/10 text-green-600' },
  { value: 'precio', label: 'Precio', color: 'bg-purple-500/10 text-purple-600' },
  { value: 'soporte', label: 'Soporte', color: 'bg-red-500/10 text-red-600' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-500/10 text-gray-600' },
];

const categoryStyle = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

const emptyForm = { title: '', body: '', category: 'saludo', active: true };

export default function Templates() {
  const { clientProfile, isAdmin } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const clientId = clientProfile?.id;

  useEffect(() => {
    load();
  }, [clientProfile]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await base44.entities.Template.filter({ client_id: clientId }, '-created_date', 200);
      setTemplates(data);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.body?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || t.category === filterCat;
    return matchSearch && matchCat;
  });

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setForm({ title: t.title, body: t.body, category: t.category, active: t.active });
    setEditId(t.id);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Título y cuerpo son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await base44.entities.Template.update(editId, form);
        toast.success('Plantilla actualizada');
      } else {
        await base44.entities.Template.create({ ...form, client_id: clientId, client_email: clientProfile?.email });
        toast.success('Plantilla creada');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await base44.entities.Template.delete(id);
      toast.success('Plantilla eliminada');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyBody = (t) => {
    navigator.clipboard.writeText(t.body);
    setCopied(t.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Plantillas de Mensajes"
        subtitle="Gestiona respuestas predefinidas para tus chats"
        action={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nueva plantilla</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plantilla..." className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Sin plantillas" description="Crea tu primera plantilla para agilizar tus respuestas." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => {
            const cat = categoryStyle(t.category);
            return (
              <Card key={t.id} className="p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${cat.color}`}>{cat.label}</span>
                    {!t.active && <span className="text-xs text-muted-foreground">Inactiva</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyBody(t)}>
                      {copied === t.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-1">{t.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Saludo de bienvenida" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} placeholder="Hola! Gracias por escribir a {negocio}..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
              Plantilla activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}