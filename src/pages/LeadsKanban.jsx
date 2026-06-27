import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Phone, Mail, MapPin, DollarSign, Wrench, X } from 'lucide-react';
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

const STATUSES = [
  { id: 'new', label: 'Nuevo', color: 'bg-blue-50 border-blue-200' },
  { id: 'contacted', label: 'Contactado', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'quoted', label: 'Cotizado', color: 'bg-purple-50 border-purple-200' },
  { id: 'won', label: 'Ganado', color: 'bg-green-50 border-green-200' },
  { id: 'lost', label: 'Perdido', color: 'bg-red-50 border-red-200' }
];

export default function LeadsKanban() {
  const { isAdmin, clientProfile } = useAuth();
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState(isAdmin ? 'all' : clientProfile?.id || 'all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  const clientId = isAdmin ? null : clientProfile?.id;

  // Load leads
  const load = useCallback(() => {
    setLoading(true);
    const promises = [base44.entities.Lead.list('-created_date', 500)];
    if (isAdmin) promises.push(base44.entities.Client.list('-created_date', 200));
    Promise.all(promises).then(([ls, cl]) => {
      setLeads(ls);
      if (cl) setClients(cl);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => { load(); }, [load, clientProfile?.id]);

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Lead.subscribe((event) => {
      if (event.type === 'create') {
        setLeads(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setLeads(prev => prev.map(l => l.id === event.data.id ? { ...l, ...event.data } : l));
      } else if (event.type === 'delete') {
        setLeads(prev => prev.filter(l => l.id !== event.data.id));
      }
    });
    return unsub;
  }, []);

  // Drag & drop
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    const newStatus = destination.droppableId;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));

    try {
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      toast.success(`Lead movido a ${STATUSES.find(s => s.id === newStatus)?.label}`);
    } catch (err) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: lead.status } : l));
      toast.error('Error al actualizar lead');
    }
  };

  const openEditModal = (lead) => {
    setSelectedLead(lead);
    setEditForm(lead);
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      await base44.entities.Lead.update(selectedLead.id, editForm);
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...editForm } : l));
      setEditModal(false);
      toast.success('Lead actualizado');
    } catch (err) {
      toast.error('Error al guardar cambios');
    }
  };

  const deleteLead = async (id) => {
    if (!window.confirm('¿Eliminar este lead?')) return;
    try {
      await base44.entities.Lead.delete(id);
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const clientName = (id) => clients.find(c => c.id === id)?.business_name || '—';

  const filtered = leads.filter(l => {
    const matchClient = clientId ? l.client_id === clientId : (filterClient === 'all' || l.client_id === filterClient);
    return matchClient;
  });

  const leadsGrouped = STATUSES.reduce((acc, status) => {
    acc[status.id] = filtered.filter(l => l.status === status.id);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-full">
      <PageHeader title="Leads - Kanban" subtitle="Gestiona tu pipeline de ventas por etapas" />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        {isAdmin && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        <p className="text-sm text-muted-foreground self-center">Total: {filtered.length} leads</p>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Cargando leads...</div>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-h-96">
            {STATUSES.map(status => (
              <div key={status.id} className={cn("rounded-2xl border-2 p-4 overflow-hidden flex flex-col", status.color)}>
                {/* Column header */}
                <div className="mb-4">
                  <h2 className="font-semibold text-foreground text-sm">{status.label}</h2>
                  <p className="text-xs text-muted-foreground">{leadsGrouped[status.id]?.length || 0} leads</p>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 space-y-2 rounded-xl p-2 transition-colors",
                        snapshot.isDraggingOver && "bg-white/50"
                      )}
                    >
                      {leadsGrouped[status.id]?.map((lead, idx) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "bg-white rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                                snapshot.isDragging && "shadow-lg"
                              )}
                            >
                              {/* Drag handle + Close button */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div {...provided.dragHandleProps} className="flex-shrink-0">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <button
                                  onClick={() => deleteLead(lead.id)}
                                  className="flex-shrink-0 p-0.5 hover:bg-red-100 rounded text-red-500"
                                  title="Eliminar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Lead info */}
                              <div className="space-y-2" onClick={() => openEditModal(lead)} role="button" className="cursor-pointer hover:opacity-80">
                                <h3 className="font-semibold text-sm text-foreground line-clamp-2">{lead.customer_name}</h3>

                                {lead.product_interest && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">📦 {lead.product_interest}</p>
                                )}

                                {/* Contact info grid */}
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {lead.phone && (
                                    <div className="flex items-center gap-1.5">
                                      <Phone className="w-3 h-3 flex-shrink-0" />
                                      <a href={`tel:${lead.phone}`} className="hover:text-primary truncate">{lead.phone}</a>
                                    </div>
                                  )}
                                  {lead.email && (
                                    <div className="flex items-center gap-1.5">
                                      <Mail className="w-3 h-3 flex-shrink-0" />
                                      <a href={`mailto:${lead.email}`} className="hover:text-primary truncate">{lead.email}</a>
                                    </div>
                                  )}
                                  {lead.city && (
                                    <div className="flex items-center gap-1.5">
                                      <MapPin className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{lead.city}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Value + extras */}
                                {(lead.estimated_value || lead.requires_installation) && (
                                  <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                                    {lead.estimated_value && (
                                      <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        ${lead.estimated_value}
                                      </span>
                                    )}
                                    {lead.requires_installation && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1 font-medium">
                                        <Wrench className="w-3 h-3" />
                                        Instalación
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Edit Modal */}
      {editModal && (
        <Dialog open={editModal} onOpenChange={setEditModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={editForm.customer_name || ''}
                  onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={editForm.phone || ''}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={editForm.email || ''}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Producto de interés</Label>
                <Input
                  value={editForm.product_interest || ''}
                  onChange={e => setEditForm(f => ({ ...f, product_interest: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Ciudad</Label>
                <Input
                  value={editForm.city || ''}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Valor estimado ($)</Label>
                <Input
                  type="number"
                  value={editForm.estimated_value || ''}
                  onChange={e => setEditForm(f => ({ ...f, estimated_value: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={editForm.notes || ''}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="mt-1 min-h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
              <Button onClick={saveEdit}>Guardar cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}