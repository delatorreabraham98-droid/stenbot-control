import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Search, Activity, Loader2, RefreshCw, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const ACTION_LABELS = {
  create: { label: 'Creación', color: 'text-green-600 bg-green-500/10' },
  update: { label: 'Actualización', color: 'text-blue-600 bg-blue-500/10' },
  delete: { label: 'Eliminación', color: 'text-red-600 bg-red-500/10' },
  login: { label: 'Inicio sesión', color: 'text-purple-600 bg-purple-500/10' },
  logout: { label: 'Cierre sesión', color: 'text-gray-600 bg-gray-500/10' },
  config_change: { label: 'Configuración', color: 'text-amber-600 bg-amber-500/10' },
  message_send: { label: 'Mensaje enviado', color: 'text-indigo-600 bg-indigo-500/10' },
  status_change: { label: 'Cambio estado', color: 'text-teal-600 bg-teal-500/10' },
  billing_change: { label: 'Facturación', color: 'text-pink-600 bg-pink-500/10' },
};

const SEVERITY_ICONS = {
  info: { icon: Info, class: 'text-blue-500' },
  warning: { icon: AlertTriangle, class: 'text-yellow-500' },
  critical: { icon: ShieldAlert, class: 'text-red-500' },
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ActivityLog.list('-created_date', 200);
      setLogs(data);
    } catch (err) {
      toast.error('Error al cargar logs: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.description?.toLowerCase().includes(search.toLowerCase()) || l.user_email?.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === 'all' || l.action_type === filterAction;
    const matchSeverity = filterSeverity === 'all' || l.severity === filterSeverity;
    return matchSearch && matchAction && matchSeverity;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Registro de Actividad"
        subtitle="Auditoría de acciones realizadas en el panel"
        action={<Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descripción o usuario..." className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Advertencia</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Activity} title="Sin registros" description="No se encontraron actividades con los filtros seleccionados." />
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const action = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'text-gray-600 bg-gray-500/10' };
            const sev = SEVERITY_ICONS[log.severity] || SEVERITY_ICONS.info;
            const SevIcon = sev.icon;
            return (
              <Card key={log.id} className="p-4 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${sev.class} bg-current/10`}>
                    <SevIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${action.color}`}>{action.label}</span>
                      {log.entity_name && <span className="text-xs text-muted-foreground">en {log.entity_name}</span>}
                    </div>
                    <p className="text-sm text-foreground">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{log.user_name || log.user_email}</span>
                      <span>·</span>
                      <span>{format(new Date(log.created_date), "d MMM yyyy 'a las' HH:mm", { locale: es })}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}