import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { Building2, Bot, Key, Globe, Radio } from 'lucide-react';

export default function ClientSettings() {
  const { clientProfile, refreshClientProfile } = useAuth();
  const [bot, setBot] = useState(null);
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [clientForm, setClientForm] = useState({});
  const [botForm, setBotForm] = useState({});

  useEffect(() => {
    if (!clientProfile?.id) return;
    setClientForm({
      business_name: clientProfile.business_name || '',
      contact_name: clientProfile.contact_name || '',
      phone: clientProfile.phone || '',
    });

    base44.entities.Bot.filter({ client_id: clientProfile.id }, '-created_date', 10).then(bots => {
      if (bots[0]) {
        setBot(bots[0]);
        setBotForm({
          name: bots[0].name || '',
          bot_personality: bots[0].bot_personality || '',
          business_context: bots[0].business_context || '',
          default_language: bots[0].default_language || 'es',
          timezone: bots[0].timezone || 'America/Tijuana',
          human_escalation_message: bots[0].human_escalation_message || '',
        });
      }
    });

    base44.entities.Channel.filter({ client_id: clientProfile.id }, '-created_date', 10).then(setChannels);
  }, [clientProfile]);

  const saveClient = async () => {
    if (!clientProfile?.id) return;
    setSaving(true);
    try {
      await base44.entities.Client.update(clientProfile.id, clientForm);
      toast.success('Perfil actualizado');
      await refreshClientProfile();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveBot = async () => {
    if (!bot?.id) return;
    setSavingBot(true);
    try {
      await base44.entities.Bot.update(bot.id, botForm);
      toast.success('Bot actualizado');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingBot(false);
    }
  };

  if (!clientProfile) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Configuración" subtitle="Administra tu perfil y tu bot" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2"><Building2 className="w-4 h-4" /> Mi negocio</TabsTrigger>
          <TabsTrigger value="bot" className="gap-2"><Bot className="w-4 h-4" /> Mi bot</TabsTrigger>
          <TabsTrigger value="channels" className="gap-2"><Radio className="w-4 h-4" /> Canales</TabsTrigger>
          <TabsTrigger value="plan" className="gap-2"><Globe className="w-4 h-4" /> Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre del negocio</Label>
                <Input value={clientForm.business_name} onChange={e => setClientForm(f => ({ ...f, business_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del contacto</Label>
                <Input value={clientForm.contact_name} onChange={e => setClientForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input value={clientProfile.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveClient} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bot">
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            {bot ? (
              <>
                <div className="space-y-1.5">
                  <Label>Nombre del bot</Label>
                  <Input value={botForm.name} onChange={e => setBotForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Personalidad del bot</Label>
                  <Textarea
                    value={botForm.bot_personality}
                    onChange={e => setBotForm(f => ({ ...f, bot_personality: e.target.value }))}
                    rows={4}
                    placeholder="Describe cómo debe comportarse tu bot..."
                  />
                  <p className="text-xs text-muted-foreground">Esto define el tono y estilo de las respuestas de tu bot.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Contexto del negocio</Label>
                  <Textarea
                    value={botForm.business_context}
                    onChange={e => setBotForm(f => ({ ...f, business_context: e.target.value }))}
                    rows={3}
                    placeholder="Describe tu negocio para que el bot lo conozca..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Idioma</Label>
                    <Select value={botForm.default_language} onValueChange={v => setBotForm(f => ({ ...f, default_language: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">Inglés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zona horaria</Label>
                    <Input value={botForm.timezone} onChange={e => setBotForm(f => ({ ...f, timezone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje de escalación a humano</Label>
                  <Textarea
                    value={botForm.human_escalation_message}
                    onChange={e => setBotForm(f => ({ ...f, human_escalation_message: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveBot} disabled={savingBot}>{savingBot ? 'Guardando...' : 'Guardar bot'}</Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No tienes un bot configurado aún.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="bg-card rounded-2xl border border-border p-6">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tienes canales conectados. Pronto podrás conectar WhatsApp, Instagram y Messenger.
              </p>
            ) : (
              <div className="space-y-3">
                {channels.map(ch => (
                  <div key={ch.id} className="flex items-center justify-between p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={ch.type} />
                      <span className="text-sm text-muted-foreground">{ch.phone_number_id || ch.page_id || '—'}</span>
                    </div>
                    <StatusBadge status={ch.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <p className="text-xl font-bold text-foreground capitalize">{clientProfile.plan}</p>
              </div>
              <StatusBadge status={clientProfile.plan} />
            </div>
            <p className="text-sm text-muted-foreground">
              Actualmente todos los planes son gratuitos. Cuando se activen los pagos, podrás actualizar tu plan desde aquí.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
