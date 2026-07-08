import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Search, Loader2, ScrollText, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Database, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusIcon = (log) => {
  if (log.cached) return <Database className="w-3.5 h-3.5 text-blue-500" />;
  if (log.error) return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  if (log.response_status >= 200 && log.response_status < 300) return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
};

export default function ToolLogs() {
  const { clientProfile, isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [expanded, setExpanded] = useState(null);

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
    try { setLogs(await base44.entities.ToolLog.list('-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const load = async () => {
    setLoading(true);
    try { setLogs(await base44.entities.ToolLog.filter({ client_id: clientId }, '-created_date', 200)); }
    catch (err) { toast.error('Error: ' + err.message); }
    finally { setLoading(false); }
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.tool_name?.toLowerCase().includes(search.toLowerCase()) || l.api_name?.toLowerCase().includes(search.toLowerCase());
    const matchSource = filterSource === 'all' || l.source === filterSource;
    const matchClient = !isAdmin || selectedClient === 'all' || l.client_id === selectedClient;
    return matchSearch && matchSource && matchClient;
  });

  const getClientName = (cId) => clients.find(c => c.id === cId)?.business_name || '';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Tool Logs" subtitle="Historial de ejecución de herramientas: requests, respuestas, latencia y errores." />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por herramienta o API..." className="pl-9" />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fuentes</SelectItem>
            <SelectItem value="planner">Planner IA</SelectItem>
            <SelectItem value="playground">Playground</SelectItem>
            <SelectItem value="health_check">Health Check</SelectItem>
          </SelectContent>
        </Select>
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
        <EmptyState icon={ScrollText} title="Sin logs" description="Las ejecuciones de herramientas aparecerán aquí." />
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <Card key={log.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                {statusIcon(log)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{log.tool_name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{log.request_method}</span>
                    {log.cached && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">CACHED</span>}
                    {log.retry_attempts > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">retry {log.retry_attempts}x</span>}
                    {log.source && <span className="text-xs text-muted-foreground">{log.source}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-mono">{log.request_url}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  {log.response_status > 0 && <span className={log.response_status < 300 ? 'text-green-600' : 'text-red-600'}>{log.response_status}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.duration_ms}ms</span>
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
              {expanded === log.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 bg-muted/20">
                  {isAdmin && log.client_id && <p className="text-xs text-muted-foreground">Cliente: {getClientName(log.client_id)}</p>}
                  {log.error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{log.error}</div>}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Parámetros</p>
                    <pre className="text-xs font-mono bg-card p-2 rounded border border-border overflow-x-auto">{JSON.stringify(log.request_params, null, 2)}</pre>
                  </div>
                  {log.response_body && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Respuesta</p>
                      <pre className="text-xs font-mono bg-card p-2 rounded border border-border overflow-x-auto max-h-48 overflow-y-auto">{log.response_body}</pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}