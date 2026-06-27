import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ChevronLeft, ChevronRight, Plus, X, Edit, Trash2, Clock, MapPin, Phone, Mail, User } from 'lucide-react';
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Calendar() {
  const { isAdmin, clientProfile, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    start_time: '',
    end_time: '',
    type: 'meeting',
    status: 'scheduled',
    location: '',
    notes: '',
    assigned_to_id: user?.id,
    lead_id: ''
  });
  const [editing, setEditing] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const clientId = isAdmin ? null : clientProfile?.id;

  const load = useCallback(() => {
    setLoading(true);
    const promises = [
      base44.entities.Appointment.list('-start_time', 200),
      base44.entities.Lead.list('-created_date', 200)
    ];
    Promise.all(promises).then(([appts, lds]) => {
      setAppointments(appts);
      setLeads(lds);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, clientProfile?.id]);

  useEffect(() => {
    const unsub = base44.entities.Appointment.subscribe((event) => {
      if (event.type === 'create') {
        setAppointments(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setAppointments(prev => prev.map(a => a.id === event.data.id ? event.data : a));
      } else if (event.type === 'delete') {
        setAppointments(prev => prev.filter(a => a.id !== event.data.id));
      }
    });
    return unsub;
  }, []);

  const openNewModal = (date = null) => {
    const baseTime = date ? format(date, "yyyy-MM-dd'T'HH:mm") : '';
    setForm({
      title: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      start_time: baseTime,
      end_time: baseTime ? format(new Date(new Date(date).getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : '',
      type: 'meeting',
      status: 'scheduled',
      location: '',
      notes: '',
      assigned_to_id: user?.id,
      lead_id: ''
    });
    setEditing(null);
    setSelectedDate(date);
    setEditModal(true);
  };

  const openEditModal = (appointment) => {
    setForm({
      ...appointment,
      start_time: format(new Date(appointment.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(appointment.end_time), "yyyy-MM-dd'T'HH:mm")
    });
    setEditing(appointment.id);
    setEditModal(true);
  };

  const saveAppointment = async () => {
    if (!form.title.trim() || !form.start_time || !form.end_time) {
      toast.error('Completa los campos requeridos');
      return;
    }
    try {
      const data = {
        ...form,
        client_id: clientProfile?.id
      };
      if (editing) {
        await base44.entities.Appointment.update(editing, data);
        toast.success('Cita actualizada');
      } else {
        await base44.entities.Appointment.create(data);
        toast.success('Cita creada');
      }
      setEditModal(false);
      load();
    } catch (err) {
      toast.error('Error al guardar cita');
    }
  };

  const deleteAppointment = async (id) => {
    if (!window.confirm('¿Eliminar esta cita?')) return;
    try {
      await base44.entities.Appointment.delete(id);
      toast.success('Cita eliminada');
      load();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const filtered = appointments.filter(a => !clientId || a.client_id === clientId);
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const getAppointmentsForDay = (date) => {
    return filtered.filter(a => isSameDay(new Date(a.start_time), date));
  };

  const typeLabelMap = {
    meeting: 'Reunión',
    call: 'Llamada',
    installation: 'Instalación',
    follow_up: 'Seguimiento',
    demo: 'Demo',
    other: 'Otro'
  };

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader title="Calendario" subtitle="Gestiona citas y disponibilidad" />

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6 bg-card rounded-xl border border-border p-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button onClick={() => openNewModal()} className="gap-2 ml-2">
            <Plus className="w-4 h-4" />
            Nueva cita
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-0 border-b border-border">
            {weekDays.map(day => (
              <div key={day} className="p-3 text-center font-semibold text-sm text-muted-foreground border-r border-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 auto-rows-[120px]">
            {daysInMonth.map((date, idx) => {
              const dayAppts = getAppointmentsForDay(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              return (
                <div
                  key={idx}
                  onClick={() => openNewModal(date)}
                  className={cn(
                    "border-r border-b border-border p-2 cursor-pointer hover:bg-muted/30 transition-colors",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                    isSameDay(date, new Date()) && "bg-primary/5"
                  )}
                >
                  <div className="text-sm font-medium mb-1">{format(date, 'd')}</div>
                  <div className="space-y-0.5 text-[10px] max-h-[90px] overflow-y-auto">
                    {dayAppts.map(appt => (
                      <div
                        key={appt.id}
                        onClick={e => { e.stopPropagation(); openEditModal(appt); }}
                        className="p-1 rounded bg-primary/10 text-primary text-xs font-medium line-clamp-2 cursor-pointer hover:bg-primary/20"
                      >
                        {format(new Date(appt.start_time), 'HH:mm')} - {appt.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Appointments List */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Próximas citas</h3>
        <div className="space-y-2">
          {filtered
            .filter(a => new Date(a.start_time) >= new Date())
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
            .slice(0, 10)
            .map(appt => (
              <div key={appt.id} className="bg-card rounded-lg border border-border p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-foreground">{appt.title}</h4>
                    <StatusBadge status={appt.type} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {format(new Date(appt.start_time), 'dd MMM HH:mm', { locale: es })}
                    </div>
                    {appt.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {appt.location}
                      </div>
                    )}
                    {appt.customer_name && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {appt.customer_name}
                      </div>
                    )}
                    {appt.customer_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${appt.customer_phone}`} className="hover:text-primary">{appt.customer_phone}</a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(appt)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => deleteAppointment(appt.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <Dialog open={editModal} onOpenChange={setEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar cita' : 'Nueva cita'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="mt-1"
                  placeholder="Ej: Reunión de seguimiento"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fecha/Hora inicio *</Label>
                  <Input
                    type="datetime-local"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha/Hora fin *</Label>
                  <Input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={t => setForm(f => ({ ...f, type: t }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabelMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={s => setForm(f => ({ ...f, status: s }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programada</SelectItem>
                    <SelectItem value="confirmed">Confirmada</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="no_show">No se presentó</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Cliente</h3>
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={form.customer_phone}
                      onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={form.customer_email}
                      onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Ubicación</Label>
                <Input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="mt-1"
                  placeholder="Ej: Oficina, En línea, etc"
                />
              </div>

              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="mt-1 min-h-20"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
              <Button onClick={saveAppointment}>Guardar cita</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}