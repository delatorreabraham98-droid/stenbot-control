import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, Building2, ChevronRight, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Gratis',
    description: 'Para negocios que inician',
    features: ['1 bot', 'Hasta 500 mensajes/mes', 'Soporte por correo']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Gratis',
    description: 'Para negocios en crecimiento',
    features: ['3 bots', 'Hasta 3,000 mensajes/mes', 'Base de conocimiento', 'Soporte prioritario'],
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Gratis',
    description: 'Para grandes operaciones',
    features: ['Bots ilimitados', 'Mensajes ilimitados', 'IA personalizada', 'SLA garantizado']
  }
];

const DEFAULT_BOT_PERSONALITY = `Eres un asistente de ventas amable y profesional. Tu objetivo es ayudar a los clientes a encontrar lo que necesitan, resolver sus dudas y guiarlos en el proceso de compra. Responde siempre de forma clara y educada en español.`;

const DEFAULT_BOT_CONTEXT = `Somos una empresa dedicada a ofrecer productos y servicios de calidad a nuestros clientes.`;

export default function Register() {
  const { user, refreshClientProfile, clientProfile } = useAuth();
  const navigate = useNavigate();

  // Si ya tiene perfil de cliente, redirigir inmediatamente
  useEffect(() => {
    if (clientProfile) {
      navigate('/');
    }
  }, [clientProfile]);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    phone: '',
    plan: 'pro'
  });

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.business_name.trim()) {
      toast.error('El nombre del negocio es obligatorio');
      return;
    }

    if (saving) return; // Prevenir doble envío

    // Verificar si ya existe un cliente con este email antes de crear
    const existing = await base44.entities.Client.filter({ email: user.email });
    if (existing && existing.length > 0) {
      toast.success('Ya tienes una cuenta creada');
      await refreshClientProfile();
      navigate('/');
      return;
    }

    setSaving(true);
    try {
      const client = await base44.entities.Client.create({
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim() || form.business_name.trim(),
        email: user.email,
        phone: form.phone.trim(),
        plan: form.plan,
        status: 'active'
      });

      await base44.entities.Bot.create({
        client_id: client.id,
        client_email: user.email,
        name: `Bot de ${form.business_name.trim()}`,
        bot_personality: DEFAULT_BOT_PERSONALITY,
        business_context: `${form.business_name.trim()} - ${DEFAULT_BOT_CONTEXT}`,
        default_language: 'es',
        timezone: 'America/Tijuana',
        active: true,
        human_escalation_message: 'Un asesor te atenderá en breve. ¡Gracias por tu paciencia!'
      });

      const defaultItems = [
        {
          client_id: client.id,
          client_email: user.email,
          title: 'Horario de atención',
          content: 'Lunes a viernes de 9:00 AM a 6:00 PM. Sábados de 9:00 AM a 2:00 PM.',
          category: 'schedule',
          active: true
        },
        {
          client_id: client.id,
          client_email: user.email,
          title: 'Formas de pago',
          content: 'Aceptamos efectivo, transferencia bancaria y tarjetas de crédito/débito.',
          category: 'faq',
          active: true
        }
      ];

      for (const item of defaultItems) {
        await base44.entities.KnowledgeItem.create(item);
      }

      toast.success('Cuenta creada exitosamente');
      await refreshClientProfile();
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Error al crear la cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-syne font-bold text-foreground">Configura tu cuenta</h1>
          <p className="text-muted-foreground mt-2">Comienza a usar STEN Bot Platform para tu negocio</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-lg p-6 md:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span className={`text-sm ${step >= s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {s === 1 ? 'Negocio' : 'Plan'}
                </span>
                {s < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-base">Nombre del negocio *</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ej: La Torre LED Shop"
                  value={form.business_name}
                  onChange={e => update('business_name', e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-base">Nombre del contacto</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Tu nombre"
                  value={form.contact_name}
                  onChange={e => update('contact_name', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-base">Teléfono</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ej: 6861234567"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                />
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">
                  Cuenta: <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                <Button
                  className="w-full h-11 text-base mt-2 gap-2"
                  onClick={() => setStep(2)}
                  disabled={!form.business_name.trim()}
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                Todos los planes son <strong className="text-foreground">gratis</strong> durante esta etapa.
                Selecciona el que mejor se adapte a tu negocio.
              </p>

              <RadioGroup value={form.plan} onValueChange={v => update('plan', v)} className="grid gap-3">
                {PLANS.map(plan => (
                  <Label
                    key={plan.id}
                    className={`relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-sm ${
                      form.plan === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30'
                    } ${plan.recommended ? 'ring-1 ring-primary/20' : ''}`}
                  >
                    <RadioGroupItem value={plan.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{plan.name}</span>
                        {plan.recommended && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-primary mt-0.5">{plan.price}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map(f => (
                          <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-primary" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button className="flex-1 h-11 gap-2" onClick={handleSubmit} disabled={saving}>
                  {saving ? (
                    <>Creando cuenta...</>
                  ) : (
                    <><Building2 className="w-4 h-4" /> Crear mi cuenta</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}