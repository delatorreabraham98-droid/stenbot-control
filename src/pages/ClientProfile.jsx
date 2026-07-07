import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Building2, CreditCard, Bell, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PLANS = {
  starter: { label: 'Starter', price: 0, messageLimit: 1000, features: ['1 bot', '1 canal', '1,000 mensajes/mes'] },
  pro: { label: 'Pro', price: 499, messageLimit: 10000, features: ['3 bots', '3 canales', '10,000 mensajes/mes', 'Analytics avanzado'] },
  enterprise: { label: 'Enterprise', price: 1499, messageLimit: 50000, features: ['Bots ilimitados', 'Canales ilimitados', '50,000 mensajes/mes', 'Soporte prioritario'] },
};

export default function ClientProfile() {
  const { clientProfile, user, refreshClientProfile } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({ emailNotifications: true, weeklyReport: true, leadAlerts: true });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!clientProfile) return;
    setForm({
      business_name: clientProfile.business_name || '',
      contact_name: clientProfile.contact_name || '',
      phone: clientProfile.phone || '',
      notes: clientProfile.notes || '',
    });
  }, [clientProfile]);

  const save = async () => {
    if (!clientProfile?.id) return;
    setSaving(true);
    try {
      await base44.entities.Client.update(clientProfile.id, form);
      await refreshClientProfile();
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      await base44.auth.updateMe({ preferences: prefs });
      toast.success('Preferencias guardadas');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  if (!clientProfile) return null;

  const plan = PLANS[clientProfile.plan] || PLANS.starter;
  const usagePercent = plan.messageLimit > 0 ? Math.min(100, Math.round((clientProfile.messages_used / plan.messageLimit) * 100)) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Mi Perfil" subtitle="Gestiona tus datos personales, suscripción y preferencias" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" /> Datos personales</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="w-4 h-4" /> Suscripción</TabsTrigger>
          <TabsTrigger value="prefs" className="gap-2"><Bell className="w-4 h-4" /> Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-white">
                {(clientProfile.business_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">{clientProfile.business_name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-1"><StatusBadge status={clientProfile.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre del negocio</Label>
                <Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del contacto</Label>
                <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan actual</p>
                  <div className="flex items-center gap-3 mt-1">
                    <h3 className="text-2xl font-bold text-foreground">{plan.label}</h3>
                    <StatusBadge status={clientProfile.billing_status || 'trialing'} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                  <p className="text-xs text-muted-foreground">
                    {clientProfile.next_billing_date ? `Próxima factura: ${format(new Date(clientProfile.next_billing_date), "d MMM yyyy", { locale: es })}` : 'Sin fecha de facturación'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Uso de mensajes</span>
                  <span className="font-medium">{clientProfile.messages_used || 0} / {plan.messageLimit}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${usagePercent > 90 ? 'bg-destructive' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-primary'}`} style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{usagePercent}% utilizado</p>
              </div>

              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-3">Incluye:</h4>
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(PLANS).map(([key, p]) => (
                <Card key={key} className={`p-5 ${clientProfile.plan === key ? 'border-primary ring-1 ring-primary' : ''}`}>
                  <h4 className="font-semibold text-foreground">{p.label}</h4>
                  <p className="text-2xl font-bold text-foreground mt-1">${p.price}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                  <p className="text-xs text-muted-foreground mt-1">{p.messageLimit.toLocaleString()} mensajes/mes</p>
                  {clientProfile.plan === key && <p className="text-xs text-primary font-medium mt-2">Plan actual</p>}
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">Para cambiar de plan, contacta al administrador.</p>
          </div>
        </TabsContent>

        <TabsContent value="prefs">
          <Card className="p-6 space-y-4">
            {[
              { key: 'emailNotifications', label: 'Notificaciones por correo', desc: 'Recibe alertas importantes en tu correo' },
              { key: 'weeklyReport', label: 'Reporte semanal', desc: 'Resumen de actividad de tu bot cada semana' },
              { key: 'leadAlerts', label: 'Alertas de leads', desc: 'Notifícame cuando se cree un nuevo lead' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={prefs[item.key]} onCheckedChange={v => setPrefs(p => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={savePrefs} disabled={savingPrefs}>{savingPrefs ? 'Guardando...' : 'Guardar preferencias'}</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}