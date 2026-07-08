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
import { Plus, Pencil, Trash2, Wrench, Search, Loader2, Zap, Link2, FlaskConical, Server, Clock, Repeat, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const PRESET_TEMPLATES = [
  {
    name: 'consultarDisponibilidad',
    description: 'Consulta la disponibilidad de citas o reservaciones para una fecha específica',
    method: 'GET',
    path: '/disponibilidad',
    parameters_schema: {
      type: 'object',
      properties: { fecha: { type: 'string', description: 'Fecha a consultar en formato YYYY-MM-DD' } },
      required: ['fecha'],
    },
  },
  {
    name: 'consultarPaquetes',
    description: 'Consulta los paquetes o servicios disponibles del negocio',
    method: 'GET',
    path: '/paquetes',
    parameters_schema: { type: 'object', properties: {} },
  },
  {
    name: 'crearLead',
    description: 'Crea un nuevo lead o prospecto en el CRM del negocio con los datos del cliente',
    method: 'POST',
    path: '/leads',
    parameters_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre del cliente' },
        telefono: { type: 'string', description: 'Teléfono del cliente' },
        producto_interes: { type: 'string', description: 'Producto o servicio de interés' },
      },
      required: ['nombre', 'telefono'],
    },
  },
  {
    name: 'crearCita',
    description: 'Crea una nueva cita o reservación',
    method: 'POST',
    path: '/citas',
    parameters_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre del cliente' },
        fecha: { type: 'string', description: 'Fecha deseada (YYYY-MM-DD)' },
        hora: { type: 'string', description: 'Hora deseada (HH:MM)' },
        servicio: { type: 'string', description: 'Servicio o tipo de cita' },
      },
      required: ['nombre', 'fecha', 'hora'],
    },
  },
];

const emptyForm = {
  name: '',
  description: '',
  api_id: '',
  path: '',
  method: 'POST',
  parameters_schema: '{"type":"object","properties":{}}',
  response_path: '',
  prompt_hint: '',
  bot_id: '',
  version: '1.0',
  cache_ttl_seconds: 0,
  retry_count: 0,
  retry_delay_ms: 1000,
  active: true,
};

export default function Tools() {
  const { clientProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [bots, setBots] = useState([]);
  const [apis, setApis] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const clientId = clientProfile?.id;

  useEffect(() => {
    if (isAdmin) {
      loadClients();
      loadAll();
      loadAllApis();
    } else if (clientId) {
      load();
      loadBots();
      loadApis(clientId);
    }
  }, [clientId, isAdmin]);

  const loadClients = async () => {
    try {
      const data = await base44.entities.Client.list('-created_date', 100);
      setClients(data);
    } catch {}
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Tool.list('-created_date', 200);
      setTools(data);
    } catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadAllApis = async () => {
    try { setApis(await base44.entities.Api.list('-created_date', 200)); } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Tool.filter({ client_id: clientId }, '-created_date', 200);
      setTools(data);
    } catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadBots = async () => {
    try { setBots(await base44.entities.Bot.filter({ client_id: clientId })); } catch {}
  };

  const loadApis = async (cId) => {
    try { setApis(await base44.entities.Api.filter({ client_id: cId })); } catch {}
  };

  const filtered = tools.filter(t => {
    const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchClient = !isAdmin || selectedClient === 'all' || t.client_id === selectedClient;
    return matchSearch && matchClient;
  });

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setForm({
      name: t.name || '',
      description: t.description || '',
      api_id: t.api_id || '',
      path: t.path || '',
      method: t.method || 'POST',
      parameters_schema: t.parameters_schema ? JSON.stringify(t.parameters_schema, null, 2) : '{"type":"object","properties":{}}',
      response_path: t.response_path || '',
      prompt_hint: t.prompt_hint || '',
      bot_id: t.bot_id || '',
      version: t.version || '1.0',
      cache_ttl_seconds: t.cache_ttl_seconds || 0,
      retry_count: t.retry_count || 0,
      retry_delay_ms: t.retry_delay_ms || 1000,
      active: t.active,
    });
    setEditId(t.id);
    setDialogOpen(true);
  };

  const applyPreset = (preset) => {
    setForm(f => ({
      ...f,
      name: preset.name,
      description: preset.description,
      method: preset.method,
      path: preset.path,
      parameters_schema: JSON.stringify(preset.parameters_schema, null, 2),
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.api_id || !form.path.trim()) {
      toast.error('Nombre, descripción, API y ruta son obligatorios');
      return;
    }
    let parsedSchema;
    try { parsedSchema = JSON.parse(form.parameters_schema); }
    catch { toast.error('El esquema de parámetros no es JSON válido'); return; }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        api_id: form.api_id,
        path: form.path.trim(),
        method: form.method,
        parameters_schema: parsedSchema,
        response_path: form.response_path || '',
        prompt_hint: form.prompt_hint || '',
        bot_id: form.bot_id || '',
        version: form.version || '1.0',
        cache_ttl_seconds: Number(form.cache_ttl_seconds) || 0,
        retry_count: Number(form.retry_count) || 0,
        retry_delay_ms: Number(form.retry_delay_ms) || 1000,
        active: form.active,
        client_id: clientId,
        client_email: clientProfile?.email,
      };
      if (editId) {
        await base44.entities.Tool.update(editId, data);
        toast.success('Herramienta actualizada');
      } else {
        await base44.entities.Tool.create(data);
        toast.success('Herramienta creada');
      }
      setDialogOpen(false);
      isAdmin ? loadAll() : load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta herramienta?')) return;
    try { await base44.entities.Tool.delete(id); toast.success('Herramienta eliminada'); isAdmin ? loadAll() : load(); }
    catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (t) => {
    try { await base44.entities.Tool.update(t.id, { active: !t.active }); isAdmin ? loadAll() : load(); }
    catch (err) { toast.error(err.message); }
  };

  const getApiName = (apiId) => apis.find(a => a.id === apiId)?.name || 'API no encontrada';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Herramientas"
        subtitle="Cada herramienta apunta a un endpoint de una API registrada. El Planner IA decide cuándo usarlas."
        action={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nueva herramienta</Button>}
      />

      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-6">
        <Server className="w-5 h-5 text-primary flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          Las herramientas ahora se conectan a APIs registradas. Ve a <button onClick={() => navigate('/apis')} className="text-primary font-semibold underline">APIs</button> para registrar una API, o a <button onClick={() => navigate('/playground')} className="text-primary font-semibold underline">Playground</button> para probar tus herramientas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar herramienta..." className="pl-9" />
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
        <EmptyState icon={Wrench} title="Sin herramientas" description="Registra tu primera herramienta apuntando a una API registrada." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <Card key={t.id} className="p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground font-mono">{t.name}</h3>
                    <span className="text-xs text-muted-foreground">{t.method} · v{t.version || '1.0'}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/playground?tool=${t.id}`)} title="Probar en Playground">
                    <FlaskConical className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(t)} title={t.active ? 'Activa' : 'Inactiva'}>
                    <Switch checked={t.active} className="scale-75 pointer-events-none" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Link2 className="w-3 h-3" />
                <span className="truncate font-mono">{getApiName(t.api_id)}{t.path}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.cache_ttl_seconds > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                    <Database className="w-3 h-3" /> Caché {t.cache_ttl_seconds}s
                  </span>
                )}
                {t.retry_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                    <Repeat className="w-3 h-3" /> Retry {t.retry_count}x
                  </span>
                )}
                {t.bot_id && (
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                    {bots.find(b => b.id === t.bot_id)?.name || 'Bot específico'}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Editar herramienta' : 'Nueva herramienta'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {!editId && (
              <div className="space-y-1.5">
                <Label>Plantillas rápidas</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TEMPLATES.map(p => (
                    <button key={p.name} onClick={() => applyPreset(p)} className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors font-mono">{p.name}()</button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre de la función</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="consultarDisponibilidad" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Bot (opcional)</Label>
                <Select value={form.bot_id || 'all'} onValueChange={v => setForm(f => ({ ...f, bot_id: v === 'all' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos los bots" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los bots</SelectItem>
                    {bots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Consulta la disponibilidad de citas para una fecha específica" />
              <p className="text-xs text-muted-foreground">La IA usa esta descripción para decidir cuándo invocar la herramienta.</p>
            </div>
            <div className="space-y-1.5">
              <Label>API registrada</Label>
              {apis.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  No hay APIs registradas. <button onClick={() => navigate('/apis')} className="font-semibold underline">Registrar API</button>
                </div>
              ) : (
                <Select value={form.api_id} onValueChange={v => setForm(f => ({ ...f, api_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona una API" /></SelectTrigger>
                  <SelectContent>
                    {apis.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.base_url}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ruta del endpoint</Label>
                <Input value={form.path} onChange={e => setForm(f => ({ ...f, path: e.target.value }))} placeholder="/disponibilidad" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Prompt de uso (opcional)</Label>
              <Textarea value={form.prompt_hint} onChange={e => setForm(f => ({ ...f, prompt_hint: e.target.value }))} rows={2} placeholder="Úsala cuando el cliente pregunte por fechas disponibles o quiera reservar" />
              <p className="text-xs text-muted-foreground">Guía a la IA sobre cuándo y por qué usar esta herramienta.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Esquema de parámetros (JSON)</Label>
              <Textarea value={form.parameters_schema} onChange={e => setForm(f => ({ ...f, parameters_schema: e.target.value }))} rows={6} className="font-mono text-xs" placeholder='{"type":"object","properties":{"fecha":{"type":"string"}},"required":["fecha"]}' />
            </div>
            <div className="space-y-1.5">
              <Label>Ruta de respuesta (opcional)</Label>
              <Input value={form.response_path} onChange={e => setForm(f => ({ ...f, response_path: e.target.value }))} placeholder="data.result" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Extrae solo la parte relevante de la respuesta (notación punto).</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Database className="w-3 h-3" /> Caché (seg)</Label>
                <Input type="number" value={form.cache_ttl_seconds} onChange={e => setForm(f => ({ ...f, cache_ttl_seconds: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Repeat className="w-3 h-3" /> Reintentos</Label>
                <Input type="number" value={form.retry_count} onChange={e => setForm(f => ({ ...f, retry_count: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Delay (ms)</Label>
                <Input type="number" value={form.retry_delay_ms} onChange={e => setForm(f => ({ ...f, retry_delay_ms: e.target.value }))} placeholder="1000" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              Herramienta activa
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