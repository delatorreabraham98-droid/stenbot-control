import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Plus, Pencil, Trash2, Search, Loader2, Server, Heart, Activity, Shield, Key } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  name: '', base_url: '', version: 'v1',
  auth_type: 'none', auth_source: 'inline', auth_token: '', auth_env_var_name: '',
  auth_header_name: 'Authorization', auth_header_prefix: 'Bearer',
  custom_headers: '{}', timeout_ms: 15000, health_check_path: '', rate_limit_per_minute: 0,
  active: true,
};

const healthColors = {
  healthy: 'bg-green-100 text-green-700',
  unhealthy: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
};

export default function Apis() {
  const { clientProfile, isAdmin } = useAuth();
  const [apis, setApis] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(null);

  const clientId = clientProfile?.id;

  useEffect(() => {
    if (isAdmin) { loadClients(); loadAll(); }
    else if (clientId) { load(); }
  }, [clientId, isAdmin]);

  const loadClients = async () => {
    try { setClients(await base44.entities.Client.list('-created_date', 100)); } catch {}
  };

  const loadAll = async () => {
    setLoading(true);
    try { setApis(await base44.entities.Api.list('-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const load = async () => {
    setLoading(true);
    try { setApis(await base44.entities.Api.filter({ client_id: clientId }, '-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const filtered = apis.filter(a => {
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.base_url?.toLowerCase().includes(search.toLowerCase());
    const matchClient = !isAdmin || selectedClient === 'all' || a.client_id === selectedClient;
    return matchSearch && matchClient;
  });

  const openNew = () => {
    setForm({ ...emptyForm, client_id: clientId, client_email: clientProfile?.email });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (a) => {
    setForm({
      name: a.name || '', base_url: a.base_url || '', version: a.version || 'v1',
      auth_type: a.auth_type || 'none', auth_source: a.auth_source || 'inline',
      auth_token: a.auth_token || '', auth_env_var_name: a.auth_env_var_name || '',
      auth_header_name: a.auth_header_name || 'Authorization', auth_header_prefix: a.auth_header_prefix ?? 'Bearer',
      custom_headers: a.custom_headers ? JSON.stringify(a.custom_headers, null, 2) : '{}',
      timeout_ms: a.timeout_ms || 15000, health_check_path: a.health_check_path || '',
      rate_limit_per_minute: a.rate_limit_per_minute || 0, active: a.active,
    });
    setEditId(a.id);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.base_url.trim()) {
      toast.error('Nombre y URL base son obligatorios');
      return;
    }
    let parsedHeaders;
    try { parsedHeaders = JSON.parse(form.custom_headers); }
    catch { toast.error('Los headers personalizados no son JSON válido'); return; }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        base_url: form.base_url.trim().replace(/\/$/, ''),
        version: form.version || 'v1',
        auth_type: form.auth_type,
        auth_source: form.auth_source,
        auth_token: form.auth_token || '',
        auth_env_var_name: form.auth_env_var_name || '',
        auth_header_name: form.auth_header_name || 'Authorization',
        auth_header_prefix: form.auth_type === 'bearer' ? 'Bearer' : form.auth_header_prefix || '',
        custom_headers: parsedHeaders,
        timeout_ms: Number(form.timeout_ms) || 15000,
        health_check_path: form.health_check_path || '',
        rate_limit_per_minute: Number(form.rate_limit_per_minute) || 0,
        active: form.active,
        client_id: clientId,
        client_email: clientProfile?.email,
      };
      if (editId) {
        await base44.entities.Api.update(editId, data);
        toast.success('API actualizada');
      } else {
        await base44.entities.Api.create(data);
        toast.success('API registrada');
      }
      setDialogOpen(false);
      isAdmin ? loadAll() : load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta API? Las herramientas asociadas dejarán de funcionar.')) return;
    try { await base44.entities.Api.delete(id); toast.success('API eliminada'); isAdmin ? loadAll() : load(); }
    catch (err) { toast.error(err.message); }
  };

  const runHealthCheck = async (id) => {
    setChecking(id);
    try {
      const res = await base44.functions.invoke('healthCheckApi', { api_id: id });
      const data = res.data;
      if (data?.status === 'healthy') toast.success(`API saludable (${data.duration_ms}ms)`);
      else toast.error(`API no saludable: ${data?.error || 'HTTP ' + data?.http_status}`);
      isAdmin ? loadAll() : load();
    } catch (err) { toast.error('Error: ' + err.message); }
    finally { setChecking(null); }
  };

  const getClientName = (cId) => clients.find(c => c.id === cId)?.business_name || '';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="API Registry"
        subtitle="Registra APIs externas. Cada herramienta apunta a un endpoint de una API registrada."
        action={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nueva API</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar API..." className="pl-9" />
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
        <EmptyState icon={Server} title="Sin APIs registradas" description="Registra tu primera API para que las herramientas puedan conectarse." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(a => (
            <Card key={a.id} className="p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{a.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">{a.base_url}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => runHealthCheck(a.id)} disabled={checking === a.id} title="Health check">
                    {checking === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-muted">v{a.version || 'v1'}</span>
                <span className="px-2 py-0.5 rounded bg-muted flex items-center gap-1"><Shield className="w-3 h-3" /> {a.auth_type}</span>
                {a.rate_limit_per_minute > 0 && <span className="px-2 py-0.5 rounded bg-muted">{a.rate_limit_per_minute}/min</span>}
                <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${healthColors[a.last_health_status || 'unknown']}`}>
                  <Activity className="w-3 h-3" /> {a.last_health_status || 'unknown'}
                </span>
              </div>
              {isAdmin && a.client_id && <p className="text-xs text-muted-foreground mt-2">{getClientName(a.client_id)}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Editar API' : 'Nueva API'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="API Jardín Mediterráneo" />
              </div>
              <div className="space-y-1.5">
                <Label>Versión</Label>
                <Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="v1" className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>URL Base</Label>
              <Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.midominio.com" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Autenticación</Label>
                <Select value={form.auth_type} onValueChange={v => setForm(f => ({ ...f, auth_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin auth</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Origen del secreto</Label>
                <Select value={form.auth_source} onValueChange={v => setForm(f => ({ ...f, auth_source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline">Inline (guardar token aquí)</SelectItem>
                    <SelectItem value="env_var">Variable de entorno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.auth_type !== 'none' && (
              <>
                {form.auth_source === 'inline' ? (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Key className="w-3 h-3" /> Token / API Key</Label>
                    <Input type="password" value={form.auth_token} onChange={e => setForm(f => ({ ...f, auth_token: e.target.value }))} placeholder="tu-token-secreto" className="font-mono text-sm" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Key className="w-3 h-3" /> Nombre de variable de entorno</Label>
                    <Input value={form.auth_env_var_name} onChange={e => setForm(f => ({ ...f, auth_env_var_name: e.target.value }))} placeholder="MI_CLIENTE_API_KEY" className="font-mono text-sm" />
                    <p className="text-xs text-muted-foreground">El token se leerá de Deno.env.get() en tiempo de ejecución. Configúrala en Settings → Environment Variables.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Header name</Label>
                    <Input value={form.auth_header_name} onChange={e => setForm(f => ({ ...f, auth_header_name: e.target.value }))} placeholder="Authorization" className="font-mono text-sm" />
                  </div>
                  {form.auth_type !== 'bearer' && (
                    <div className="space-y-1.5">
                      <Label>Header prefix</Label>
                      <Input value={form.auth_header_prefix} onChange={e => setForm(f => ({ ...f, auth_header_prefix: e.target.value }))} placeholder="Bearer o vacío" className="font-mono text-sm" />
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Headers personalizados (JSON)</Label>
              <Textarea value={form.custom_headers} onChange={e => setForm(f => ({ ...f, custom_headers: e.target.value }))} rows={3} className="font-mono text-xs" placeholder='{"X-Tenant-Id": "123"}' />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Timeout (ms)</Label>
                <Input type="number" value={form.timeout_ms} onChange={e => setForm(f => ({ ...f, timeout_ms: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Rate limit/min</Label>
                <Input type="number" value={form.rate_limit_per_minute} onChange={e => setForm(f => ({ ...f, rate_limit_per_minute: e.target.value }))} placeholder="0 = sin límite" />
              </div>
              <div className="space-y-1.5">
                <Label>Health check path</Label>
                <Input value={form.health_check_path} onChange={e => setForm(f => ({ ...f, health_check_path: e.target.value }))} placeholder="/health" className="font-mono text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              API activa
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