import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Radio, Copy, CheckCircle, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';

const emptyForm = {
  client_id: '', client_email: '', bot_id: '', type: 'whatsapp',
  meta_business_id: '', phone_number_id: '', page_id: '',
  instagram_business_account_id: '', webhook_verify_token: '', status: 'inactive'
};

const WEBHOOK_BASE = 'WEBHOOK_URL_PENDIENTE/webhookWhatsApp';

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [clients, setClients] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Channel.list('-created_date', 200),
      base44.entities.Client.list('-created_date', 200),
      base44.entities.Bot.list('-created_date', 200),
    ]).then(([ch, cl, b]) => { setChannels(ch); setClients(cl); setBots(b); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';
  const botName = (id) => bots.find(b => b.id === id)?.name || '—';
  const clientBots = (clientId) => bots.filter(b => b.client_id === clientId);

  const copyWebhook = (channelId) => {
    const url = `${WEBHOOK_BASE}/${channelId}`;
    navigator.clipboard.writeText(url);
    setCopied(channelId);
    setTimeout(() => setCopied(null), 2000);
    toast.success('URL copiada');
  };

  const openCreate = () => { setForm(emptyForm); setEditing(null); setOpen(true); };
  const openEdit = (ch) => { setForm({ ...ch }); setEditing(ch.id); setOpen(true); };

  const save = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Channel.update(editing, form);
      toast.success('Canal actualizado');
    } else {
      await base44.entities.Channel.create(form);
      toast.success('Canal creado');
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este canal?')) return;
    await base44.entities.Channel.delete(id);
    toast.success('Canal eliminado');
    load();
  };

  const channelIcon = (type) => {
    if (type === 'whatsapp') return '📱';
    if (type === 'instagram') return '📸';
    return '💬';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Canales"
        subtitle="Administra las conexiones de WhatsApp, Instagram y Messenger"
        action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo canal</Button>}
      />

      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
        <p className="text-sm font-medium text-primary mb-1">Cómo conectar con Meta</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Crea el canal aquí y copia la URL del webhook</li>
          <li>Ve al portal de <strong>Meta for Developers</strong> → tu app → Webhooks</li>
          <li>Pega la URL y usa el Verify Token que configuraste</li>
          <li>Suscríbete al evento <code className="bg-muted px-1 rounded">messages</code></li>
          <li>Cambia el estado del canal a "Activo"</li>
        </ol>
      </div>

      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : channels.length === 0 ? (
        <EmptyState icon={Radio} title="Sin canales" description="Conecta el primer canal de Meta para empezar." action={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nuevo canal</Button>} />
      ) : (
        <div className="space-y-3">
          {channels.map(ch => (
            <div key={ch.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{channelIcon(ch.type)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ch.type} />
                      <StatusBadge status={ch.status} />
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{clientName(ch.client_id)}</p>
                    <p className="text-xs text-muted-foreground">Bot: {botName(ch.bot_id)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {ch.phone_number_id && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-lg font-mono">{ch.phone_number_id}</span>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => copyWebhook(ch.id)}>
                    {copied === ch.id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    Webhook URL
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ch)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(ch.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {ch.meta_business_id && (
                <div className="mt-2 pt-2 border-t border-border flex gap-4 text-xs text-muted-foreground">
                  <span>Business ID: <code className="font-mono">{ch.meta_business_id}</code></span>
                  {ch.page_id && <span>Page ID: <code className="font-mono">{ch.page_id}</code></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar canal' : 'Nuevo canal'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => {
                  const c = clients.find(cl => cl.id === v);
                  setForm(f => ({ ...f, client_id: v, client_email: c?.email || '', bot_id: '' }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bot *</Label>
                <Select value={form.bot_id} onValueChange={v => setForm(f => ({ ...f, bot_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{clientBots(form.client_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de canal *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Meta Business ID</Label>
              <Input value={form.meta_business_id} onChange={e => setForm(f => ({ ...f, meta_business_id: e.target.value }))} placeholder="960695886752699" />
            </div>
            {form.type === 'whatsapp' && (
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="1164009210125614" />
              </div>
            )}
            {(form.type === 'messenger' || form.type === 'instagram') && (
              <div className="space-y-1.5">
                <Label>Page ID</Label>
                <Input value={form.page_id} onChange={e => setForm(f => ({ ...f, page_id: e.target.value }))} />
              </div>
            )}
            {form.type === 'instagram' && (
              <div className="space-y-1.5">
                <Label>Instagram Business Account ID</Label>
                <Input value={form.instagram_business_account_id} onChange={e => setForm(f => ({ ...f, instagram_business_account_id: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Verify Token</Label>
              <Input value={form.webhook_verify_token} onChange={e => setForm(f => ({ ...f, webhook_verify_token: e.target.value }))} placeholder="mi_token_secreto_123" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !form.client_id || !form.bot_id || !form.type}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear canal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}