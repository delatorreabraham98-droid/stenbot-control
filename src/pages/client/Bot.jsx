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
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { toast } from 'sonner';
import {
  Bot, Save, Power, Send, MessageSquare, UserPlus, Activity,
  Volume2, Sparkles, BookOpen, Radio, Zap, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClientBot() {
  const { clientProfile } = useAuth();
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const [stats, setStats] = useState({ conversations: 0, leads: 0, needsHuman: 0, messagesToday: 0 });
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);

  const clientId = clientProfile?.id;

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([
      base44.entities.Bot.filter({ client_id: clientId }, '-created_date', 10),
      base44.entities.Conversation.filter({ client_id: clientId }, '-last_message_at', 200),
      base44.entities.Lead.filter({ client_id: clientId }, '-created_date', 200),
    ]).then(([bots, convs, leads]) => {
      if (bots[0]) {
        setBot(bots[0]);
        setForm({
          name: bots[0].name || '',
          bot_personality: bots[0].bot_personality || '',
          business_context: bots[0].business_context || '',
          default_language: bots[0].default_language || 'es',
          timezone: bots[0].timezone || 'America/Tijuana',
          human_escalation_message: bots[0].human_escalation_message || '',
          respond_with_audio: bots[0].respond_with_audio || false,
          active: bots[0].active ?? true,
        });
      }
      const today = new Date().toDateString();
      setStats({
        conversations: convs.length,
        leads: leads.length,
        needsHuman: convs.filter(c => c.status === 'needs_human').length,
        messagesToday: convs.filter(c => new Date(c.last_message_at || c.created_date).toDateString() === today).length,
      });
    }).finally(() => setLoading(false));
  }, [clientId]);

  const save = async () => {
    if (!bot?.id) return;
    setSaving(true);
    try {
      await base44.entities.Bot.update(bot.id, form);
      setBot({ ...bot, ...form });
      toast.success('Bot actualizado correctamente');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!bot?.id) return;
    const newVal = !form.active;
    setForm(f => ({ ...f, active: newVal }));
    try {
      await base44.entities.Bot.update(bot.id, { active: newVal });
      setBot({ ...bot, active: newVal });
      toast.success(newVal ? 'Bot activado' : 'Bot pausado');
    } catch (err) {
      setForm(f => ({ ...f, active: !newVal }));
      toast.error(err.message);
    }
  };

  const testBot = async () => {
    if (!testMessage.trim() || !bot) return;
    setTesting(true);
    setTestResponse('');
    try {
      const prompt = `Eres un bot de WhatsApp llamado "${form.name}". ${form.bot_personality || ''} Contexto del negocio: ${form.business_context || ''} Responde brevemente a este mensaje del cliente: "${testMessage}"`;
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      setTestResponse(res);
    } catch (err) {
      toast.error('Error al probar el bot: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Mi Bot" subtitle="Panel de administración de tu bot" />
        <EmptyState
          icon={Bot}
          title="No tienes un bot configurado"
          description="Contacta al administrador para que cree tu bot y asígnelo a tu cuenta."
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Mi Bot"
        subtitle="Panel de administración de tu asistente de IA"
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={form.active ? 'active' : 'paused'} />
            <Button variant={form.active ? 'destructive' : 'default'} size="sm" onClick={toggleActive} className="gap-2">
              <Power className="w-4 h-4" />
              {form.active ? 'Pausar' : 'Activar'}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Conversaciones" value={stats.conversations} icon={MessageSquare} color="primary" />
        <StatCard title="Leads generados" value={stats.leads} icon={UserPlus} color="success" />
        <StatCard title="Requieren atención" value={stats.needsHuman} icon={Activity} color="warning" />
        <StatCard title="Mensajes hoy" value={stats.messagesToday} icon={Sparkles} color="blue" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link to="/knowledge" className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all">
          <BookOpen className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Conocimiento</p>
            <p className="text-xs text-muted-foreground">Base de datos del bot</p>
          </div>
        </Link>
        <Link to="/integrations" className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all">
          <Radio className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Canales</p>
            <p className="text-xs text-muted-foreground">WhatsApp, IG, Messenger</p>
          </div>
        </Link>
        <Link to="/availability" className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Disponibilidad</p>
            <p className="text-xs text-muted-foreground">Fechas y reservas</p>
          </div>
        </Link>
        <Link to="/settings" className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Mi negocio</p>
            <p className="text-xs text-muted-foreground">Perfil y plan</p>
          </div>
        </Link>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config" className="gap-2"><Bot className="w-4 h-4" /> Configuración</TabsTrigger>
          <TabsTrigger value="test" className="gap-2"><Send className="w-4 h-4" /> Probar bot</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Nombre del bot</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Asistente Virtual" />
            </div>

            <div className="space-y-1.5">
              <Label>Personalidad del bot</Label>
              <Textarea
                value={form.bot_personality}
                onChange={e => setForm(f => ({ ...f, bot_personality: e.target.value }))}
                rows={4}
                placeholder="Eres amable, profesional y siempre buscas ayudar al cliente..."
              />
              <p className="text-xs text-muted-foreground">Define el tono y estilo de las respuestas de tu bot.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Contexto del negocio</Label>
              <Textarea
                value={form.business_context}
                onChange={e => setForm(f => ({ ...f, business_context: e.target.value }))}
                rows={4}
                placeholder="Vendemos productos de jardinería en Tijuana. Horario: Lun-Sab 9-7. Envíos a toda la ciudad..."
              />
              <p className="text-xs text-muted-foreground">Información sobre tu negocio que el bot usará para responder.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={form.default_language} onValueChange={v => setForm(f => ({ ...f, default_language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">Inglés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Zona horaria</Label>
                <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mensaje de escalación a humano</Label>
              <Textarea
                value={form.human_escalation_message}
                onChange={e => setForm(f => ({ ...f, human_escalation_message: e.target.value }))}
                rows={2}
                placeholder="Un asesor te atenderá en breve. Mientras tanto, ¿puedo ayudarte con algo más?"
              />
              <p className="text-xs text-muted-foreground">Mensaje que envía el bot cuando transfiere a un humano.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Respuestas con audio</p>
                  <p className="text-xs text-muted-foreground">El bot convierte sus respuestas a notas de voz</p>
                </div>
              </div>
              <Switch
                checked={form.respond_with_audio}
                onCheckedChange={v => setForm(f => ({ ...f, respond_with_audio: v }))}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="test">
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Probar tu bot
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Envía un mensaje de prueba para ver cómo respondería tu bot con la configuración actual.
            </p>

            <div className="flex gap-2 mb-4">
              <Input
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && testBot()}
                placeholder="Escribe un mensaje como si fueras un cliente..."
                className="flex-1"
              />
              <Button onClick={testBot} disabled={testing || !testMessage.trim()} className="gap-2">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </Button>
            </div>

            {testResponse && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm">{testMessage}</p>
                  </div>
                </div>
                <div className="flex justify-start items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              </div>
            )}

            {!testResponse && !testing && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Las respuestas aparecerán aquí</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}