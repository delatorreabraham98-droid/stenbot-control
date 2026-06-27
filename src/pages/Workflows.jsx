import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Zap, Plus, Edit, Trash2, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TRIGGERS = [
  { id: 'lead_status_change', label: 'Lead cambia de estado' },
  { id: 'conversation_status_change', label: 'Conversación cambia de estado' },
  { id: 'message_received', label: 'Mensaje recibido' },
  { id: 'lead_created', label: 'Lead creado' }
];

const ACTIONS = [
  { id: 'send_email', label: 'Enviar email' },
  { id: 'send_whatsapp', label: 'Enviar WhatsApp' },
  { id: 'update_lead', label: 'Actualizar lead' },
  { id: 'create_task', label: 'Crear tarea' }
];

export default function Workflows() {
  const { isAdmin, clientProfile } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'lead_status_change',
    trigger_value: '',
    actions: []
  });
  const [editing, setEditing] = useState(null);

  const clientId = isAdmin ? null : clientProfile?.id;

  const load = useCallback(() => {
    setLoading(true);
    base44.entities.Workflow.list('-created_date', 100)
      .then(setWorkflows)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, clientProfile?.id]);

  useEffect(() => {
    const unsub = base44.entities.Workflow.subscribe((event) => {
      if (event.type === 'create') {
        setWorkflows(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setWorkflows(prev => prev.map(w => w.id === event.data.id ? event.data : w));
      } else if (event.type === 'delete') {
        setWorkflows(prev => prev.filter(w => w.id !== event.data.id));
      }
    });
    return unsub;
  }, []);

  const openNewModal = () => {
    setForm({ name: '', description: '', trigger_type: 'lead_status_change', trigger_value: '', actions: [] });
    setEditing(null);
    setEditModal(true);
  };

  const openEditModal = (workflow) => {
    setForm(workflow);
    setEditing(workflow.id);
    setEditModal(true);
  };

  const saveWorkflow = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    try {
      if (editing) {
        await base44.entities.Workflow.update(editing, form);
        toast.success('Workflow actualizado');
      } else {
        await base44.entities.Workflow.create({ ...form, client_id: clientProfile?.id });
        toast.success('Workflow creado');
      }
      setEditModal(false);
      load();
    } catch (err) {
      toast.error('Error al guardar workflow');
    }
  };

  const deleteWorkflow = async (id) => {
    if (!window.confirm('¿Eliminar este workflow?')) return;
    try {
      await base44.entities.Workflow.delete(id);
      toast.success('Workflow eliminado');
      load();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const toggleActive = async (workflow) => {
    try {
      await base44.entities.Workflow.update(workflow.id, { active: !workflow.active });
    } catch (err) {
      toast.error('Error al actualizar');
    }
  };

  const addAction = () => {
    setForm(f => ({
      ...f,
      actions: [...f.actions, { type: 'send_email', config: {} }]
    }));
  };

  const removeAction = (idx) => {
    setForm(f => ({
      ...f,
      actions: f.actions.filter((_, i) => i !== idx)
    }));
  };

  const updateAction = (idx, key, value) => {
    setForm(f => {
      const actions = [...f.actions];
      actions[idx] = { ...actions[idx], [key]: value };
      return { ...f, actions };
    });
  };

  const filtered = workflows.filter(w => !clientId || w.client_id === clientId);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader title="Workflows" subtitle="Automatiza acciones basadas en eventos" />

      <div className="mb-4 flex justify-end">
        <Button onClick={openNewModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Workflow
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Sin workflows aún</p>
          <Button onClick={openNewModal}>Crear el primer workflow</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(workflow => (
            <div key={workflow.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                    <button
                      onClick={() => toggleActive(workflow)}
                      className={cn(
                        "inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors",
                        workflow.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {workflow.active ? '✓' : '◯'}
                    </button>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground mb-2">{workflow.description}</p>
                  )}
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      🎯 Trigger: <span className="font-medium">{TRIGGERS.find(t => t.id === workflow.trigger_type)?.label}</span>
                    </p>
                    <p className="text-muted-foreground">
                      ⚙️ Acciones: <span className="font-medium">{workflow.actions?.length || 0} acción(es)</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(workflow)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => deleteWorkflow(workflow.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <Dialog open={editModal} onOpenChange={setEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Workflow' : 'Nuevo Workflow'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Básico */}
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                  placeholder="Ej: Notificar cuando lead es cotizado"
                />
              </div>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="mt-1 min-h-16"
                />
              </div>

              {/* Trigger */}
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Cuándo ejecutar</h3>
                <Select value={form.trigger_type} onValueChange={t => setForm(f => ({ ...f, trigger_type: t }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.trigger_type === 'lead_status_change' && (
                  <div className="mt-3">
                    <Label className="text-xs">Cuando el estado sea:</Label>
                    <Select value={form.trigger_value} onValueChange={v => setForm(f => ({ ...f, trigger_value: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['new', 'contacted', 'quoted', 'won', 'lost'].map(s => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Acciones</h3>
                <div className="space-y-3 mb-3">
                  {form.actions.map((action, idx) => (
                    <div key={idx} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Select value={action.type} onValueChange={t => updateAction(idx, 'type', t)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACTIONS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => removeAction(idx)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                        >
                          ✕
                        </button>
                      </div>

                      {action.type === 'send_email' && (
                        <>
                          <Input
                            placeholder="Email (o {{customer_email}})"
                            value={action.config.email || ''}
                            onChange={e => updateAction(idx, 'config', { ...action.config, email: e.target.value })}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Asunto"
                            value={action.config.subject || ''}
                            onChange={e => updateAction(idx, 'config', { ...action.config, subject: e.target.value })}
                            className="text-xs"
                          />
                          <Textarea
                            placeholder="Cuerpo del mensaje (usa {{customer_name}}, {{product_interest}} etc)"
                            value={action.config.body || ''}
                            onChange={e => updateAction(idx, 'config', { ...action.config, body: e.target.value })}
                            className="text-xs min-h-20"
                          />
                        </>
                      )}

                      {action.type === 'send_whatsapp' && (
                        <Textarea
                          placeholder="Mensaje (usa {{customer_name}}, {{product_interest}} etc)"
                          value={action.config.message || ''}
                          onChange={e => updateAction(idx, 'config', { ...action.config, message: e.target.value })}
                          className="text-xs min-h-20"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={addAction} className="w-full gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Agregar acción
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
              <Button onClick={saveWorkflow}>Guardar workflow</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}