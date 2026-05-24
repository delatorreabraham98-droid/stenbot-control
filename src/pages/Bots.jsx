import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Bot, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ContextImporter from '@/components/bots/ContextImporter';
import { toast } from 'sonner';

const emptyForm = {
  client_id: '', name: '', bot_personality: '', business_context: '',
  default_language: 'es', timezone: 'America/Tijuana', active: true,
  human_escalation_message: 'Un asesor te atenderá en breve. ¡Gracias por tu paciencia!'
};

export default function Bots() {
  const [bots, setBots] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Bot.list('-created_date', 200),
      base44.entities.Client.list('-created_date', 200)
    ]).then(([b, c]) => { setBots(b); setClients(c); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true); };
  const openEdit = (bot) => { setForm({ ...bot }); setEditing(bot.id); setOpen(true); };

  const save = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Bot.update(editing, form);
      toast.success('Bot actualizado');
    } else {
      await base44.entities.Bot.create(form);
      toast.success('Bot creado');
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const toggle = async (bot) => {
    await base44.entities.Bot.update(bot.id, { active: !bot.active });
    toast.success(`Bot ${!bot.active ? 'activado' : 'desactivado'}`);
    load();
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este bot?')) return;
    await base44.entities.Bot.delete(id);
    toast.success('Bot eliminado');
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Bots"
        subtitle="Configura los asistentes de IA para cada cliente"
        action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo bot</Button>}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState icon={Bot} title="Sin bots" description="Crea el primer bot para empezar a atender clientes." action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo bot</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map(bot => (
            <div key={bot.id} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle(bot)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    {bot.active
                      ? <ToggleRight className="w-5 h-5 text-green-500" />
                      : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(bot)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(bot.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <h3 className="font-semibold text-foreground">{bot.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{clientName(bot.client_id)}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{bot.bot_personality}</p>
              <div className="flex items-center gap-2 mt-3">
                <StatusBadge status={bot.active ? 'active' : 'inactive'} />
                <span className="text-xs text-muted-foreground">{bot.default_language?.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar bot' : 'Nuevo bot'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del bot *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Personalidad del bot</Label>
              <Textarea placeholder="Ej: Eres un asistente amable y profesional que atiende clientes de una tienda de iluminación LED..." value={form.bot_personality} onChange={e => setForm(f => ({ ...f, bot_personality: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Contexto del negocio</Label>
              <Textarea placeholder="Ej: Somos una empresa líder en Tijuana especializada en luces LED para hogar y comercio..." value={form.business_context} onChange={e => setForm(f => ({ ...f, business_context: e.target.value }))} rows={3} />
              <ContextImporter onContextExtracted={(text) => setForm(f => ({ ...f, business_context: (f.business_context ? f.business_context + '\n\n' : '') + text }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje de escalación a humano</Label>
              <Textarea value={form.human_escalation_message} onChange={e => setForm(f => ({ ...f, human_escalation_message: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={form.default_language} onValueChange={v => setForm(f => ({ ...f, default_language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">Inglés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Zona horaria</Label>
                <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !form.client_id || !form.name}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear bot'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}