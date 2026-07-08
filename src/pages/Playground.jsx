import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Loader2, FlaskConical, Play, Zap, Brain, Clock, CheckCircle, XCircle, Database, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function Playground() {
  const { clientProfile, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [tools, setTools] = useState([]);
  const [apis, setApis] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tool'); // 'tool' | 'planner'

  // Tool testing state
  const [selectedTool, setSelectedTool] = useState(searchParams.get('tool') || '');
  const [params, setParams] = useState({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  // Planner testing state
  const [plannerMsg, setPlannerMsg] = useState('');
  const [plannerBot, setPlannerBot] = useState('');
  const [bots, setBots] = useState([]);
  const [plannerExecuting, setPlannerExecuting] = useState(false);
  const [plannerResult, setPlannerResult] = useState(null);

  const clientId = clientProfile?.id;

  useEffect(() => {
    if (isAdmin) { loadClients(); loadAll(); loadAllBots(); }
    else if (clientId) { load(); loadBots(clientId); }
  }, [clientId, isAdmin]);

  const loadClients = async () => { try { setClients(await base44.entities.Client.list('-created_date', 100)); } catch {} };
  const loadAll = async () => {
    setLoading(true);
    try { setTools(await base44.entities.Tool.list('-created_date', 200)); setApis(await base44.entities.Api.list('-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };
  const load = async () => {
    setLoading(true);
    try { setTools(await base44.entities.Tool.filter({ client_id: clientId }, '-created_date', 200)); setApis(await base44.entities.Api.filter({ client_id: clientId })); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };
  const loadAllBots = async () => { try { setBots(await base44.entities.Bot.list('-created_date', 100)); } catch {} };
  const loadBots = async (cId) => { try { setBots(await base44.entities.Bot.filter({ client_id: cId })); } catch {} };

  const activeClientId = isAdmin
    ? (selectedClient === 'all' ? tools[0]?.client_id : selectedClient)
    : clientId;

  const availableTools = isAdmin && selectedClient === 'all' ? tools : tools.filter(t => t.client_id === activeClientId);
  const currentTool = availableTools.find(t => t.id === selectedTool) || null;

  const executeTool = async () => {
    if (!currentTool) { toast.error('Selecciona una herramienta'); return; }
    setExecuting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('executeTool', {
        tool_id: currentTool.id,
        client_id: currentTool.client_id,
        params,
        source: 'playground',
      });
      setResult(res.data);
    } catch (err) { setResult({ success: false, error: err.message }); }
    finally { setExecuting(false); }
  };

  const testPlanner = async () => {
    if (!plannerMsg.trim()) { toast.error('Escribe un mensaje'); return; }
    if (!activeClientId) { toast.error('Selecciona un cliente'); return; }
    setPlannerExecuting(true);
    setPlannerResult(null);
    try {
      const res = await base44.functions.invoke('processMessage', {
        client_id: activeClientId,
        bot_id: plannerBot || undefined,
        user_message: plannerMsg,
      });
      setPlannerResult(res.data);
    } catch (err) { setPlannerResult({ error: err.message }); }
    finally { setPlannerExecuting(false); }
  };

  const renderParamField = (key, schema) => {
    const type = schema?.type || 'string';
    const isRequired = currentTool?.parameters_schema?.required?.includes(key);
    return (
      <div key={key} className="space-y-1">
        <Label className="text-xs font-mono">
          {key} {isRequired && <span className="text-destructive">*</span>}
          <span className="text-muted-foreground ml-1">({type})</span>
        </Label>
        {schema?.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
        <Input
          value={params[key] ?? ''}
          onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
          placeholder={`valor para ${key}`}
          className="font-mono text-sm"
        />
      </div>
    );
  };

  const getApiName = (apiId) => apis.find(a => a.id === apiId)?.name || '';
  const availableBots = isAdmin && selectedClient === 'all' ? bots : bots.filter(b => b.client_id === activeClientId);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Playground" subtitle="Prueba herramientas individualmente o simula el Planner IA completo." />

      <div className="flex gap-2 mb-6">
        <Button variant={tab === 'tool' ? 'default' : 'outline'} onClick={() => setTab('tool')} className="gap-2">
          <FlaskConical className="w-4 h-4" /> Herramienta
        </Button>
        <Button variant={tab === 'planner' ? 'default' : 'outline'} onClick={() => setTab('planner')} className="gap-2">
          <Brain className="w-4 h-4" /> Planner IA
        </Button>
      </div>

      {isAdmin && (
        <div className="mb-4">
          <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedTool(''); setParams({}); }}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'tool' ? (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Selecciona una herramienta</Label>
                {availableTools.length === 0 ? (
                  <EmptyState icon={Zap} title="Sin herramientas" description="No hay herramientas registradas para este cliente." />
                ) : (
                  <Select value={selectedTool} onValueChange={(v) => { setSelectedTool(v); setParams({}); setResult(null); }}>
                    <SelectTrigger><SelectValue placeholder="Elegir herramienta..." /></SelectTrigger>
                    <SelectContent>
                      {availableTools.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — {getApiName(t.api_id)}{t.path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {currentTool && (
                <>
                  <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                    <p className="text-sm">{currentTool.description}</p>
                    {currentTool.prompt_hint && <p className="text-xs text-muted-foreground italic">{currentTool.prompt_hint}</p>}
                    <div className="flex gap-2 text-xs text-muted-foreground pt-1">
                      <span className="font-mono">{currentTool.method}</span>
                      <span className="flex items-center gap-1"><Server className="w-3 h-3" />{getApiName(currentTool.api_id)}</span>
                      <span className="font-mono">{currentTool.path}</span>
                    </div>
                  </div>

                  {currentTool.parameters_schema?.properties && Object.keys(currentTool.parameters_schema.properties).length > 0 && (
                    <div className="space-y-3">
                      <Label>Parámetros</Label>
                      {Object.entries(currentTool.parameters_schema.properties).map(([key, schema]) => renderParamField(key, schema))}
                    </div>
                  )}

                  <Button onClick={executeTool} disabled={executing} className="gap-2">
                    {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {executing ? 'Ejecutando...' : 'Ejecutar herramienta'}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {result && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                {result.success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                <h3 className="font-semibold">Respuesta</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {result.status && `HTTP ${result.status} · `}
                  {result.duration_ms != null && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{result.duration_ms}ms</span>}
                  {result.cached && <span className="flex items-center gap-1 ml-2"><Database className="w-3 h-3" />cached</span>}
                </span>
              </div>
              <pre className="text-xs font-mono bg-muted/30 p-3 rounded-lg border border-border overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(result.data ?? result.error ?? result, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bot (opcional)</Label>
                <Select value={plannerBot} onValueChange={setPlannerBot}>
                  <SelectTrigger><SelectValue placeholder="Sin bot específico" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin bot específico</SelectItem>
                    {availableBots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mensaje del cliente</Label>
                <Textarea value={plannerMsg} onChange={e => setPlannerMsg(e.target.value)} rows={3}
                  placeholder="Quiero una boda para 180 personas el 15 de noviembre" />
              </div>
              <Button onClick={testPlanner} disabled={plannerExecuting} className="gap-2">
                {plannerExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {plannerExecuting ? 'Planificando...' : 'Probar Planner IA'}
              </Button>
            </div>
          </Card>

          {plannerResult && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Resultado del Planner</h3>
              </div>
              {plannerResult.tools_used?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Herramientas ejecutadas:</span>
                  {plannerResult.tools_used.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{t}</span>
                  ))}
                </div>
              )}
              <div className={`p-3 rounded-lg ${plannerResult.canHandle ? 'bg-green-50' : 'bg-amber-50'}`}>
                <p className="text-sm">{plannerResult.text}</p>
                {!plannerResult.canHandle && <p className="text-xs text-amber-600 mt-1">⚠ Requiere atención humana</p>}
              </div>
              {plannerResult.error && <p className="text-xs text-red-500">Error: {plannerResult.error}</p>}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}