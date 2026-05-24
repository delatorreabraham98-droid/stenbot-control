import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  MessageCircle, Camera, MessageSquare, Copy, CheckCircle,
  ChevronDown, ChevronUp, CheckCircle2, Circle,
  AlertCircle, Loader2, Smartphone
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const WEBHOOK_BASE = 'https://your-backend.onrender.com/webhook';

const INTEGRATIONS = [
  {
    type: 'whatsapp',
    icon: MessageCircle,
    name: 'WhatsApp',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-900',
    description: 'Conecta tu número de WhatsApp Business para recibir y responder mensajes automáticamente.',
    guide: [
      'Asegúrate de tener una cuenta de Meta for Developers activa.',
      'Crea una aplicación en el portal de Meta for Developers.',
      'Configura el producto WhatsApp en tu aplicación.',
      'Obtén un número de teléfono Business de WhatsApp.',
      'Copia la URL del webhook y pégala en la configuración de Webhooks de tu app.',
      'Usa el Verify Token que aparece abajo.',
      'Suscríbete al evento messages.',
      'Espera a que el administrador active el canal.',
    ],
  },
  {
    type: 'instagram',
    icon: Camera,
    name: 'Instagram',
    color: 'text-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    borderColor: 'border-pink-200 dark:border-pink-900',
    description: 'Conecta tu cuenta de Instagram Business para gestionar mensajes directos.',
    guide: [
      'Convierte tu cuenta de Instagram a Cuenta de Creador o Empresa.',
      'Asegúrate de tener una página de Facebook vinculada.',
      'Conecta tu Instagram a la página de Facebook.',
      'Ve al portal de Meta for Developers → tu app → Webhooks.',
      'Pega la URL del webhook y el Verify Token.',
      'Suscríbete al evento messages.',
      'Espera a que el administrador active el canal.',
    ],
  },
  {
    type: 'messenger',
    icon: MessageSquare,
    name: 'Messenger',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-900',
    description: 'Conecta tu página de Facebook Messenger para atender clientes desde Facebook.',
    guide: [
      'Asegúrate de tener una página de Facebook creada.',
      'Ve al portal de Meta for Developers → tu app.',
      'Agrega el producto Messenger a tu aplicación.',
      'Configura un Webhook y genera un Token de Página.',
      'Pega la URL del webhook y suscríbete a messages.',
      'Vincula tu página de Facebook a la app.',
      'Espera a que el administrador active el canal.',
    ],
  },
];

function IntegrationCard({ integration, channel, copied, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const { type, icon: Icon, name, color, bgColor, borderColor, description, guide } = integration;
  const connected = channel && channel.status === 'active';
  const configuring = channel && channel.status === 'inactive';
  const error = channel && channel.status === 'error';

  const statusIcon = connected ? CheckCircle2 : error ? AlertCircle : configuring ? Loader2 : Circle;
  const statusClass = connected ? 'text-green-500' : error ? 'text-red-500' : configuring ? 'text-amber-500' : 'text-muted-foreground';

  return (
    <div className={cn("bg-card rounded-2xl border border-border overflow-hidden transition-all hover:shadow-sm", expanded && "shadow-sm")}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border", bgColor, borderColor)}>
              <Icon className={cn("w-6 h-6", color)} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {channel ? (
                  <StatusBadge status={channel.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">No conectado</span>
                )}
              </div>
            </div>
          </div>
          <statusIcon className={cn("w-5 h-5", statusClass)} />
        </div>

        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {channel && (
          <div className="space-y-2 mb-4 p-3 bg-muted/50 rounded-xl">
            {channel.phone_number_id && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="w-3.5 h-3.5" />
                <span className="font-mono">{channel.phone_number_id}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs flex-1"
                onClick={() => onCopy(channel.id)}
              >
                {copied === channel.id ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copiar Webhook URL
              </Button>
            </div>
            {channel.webhook_verify_token && (
              <div className="text-xs text-muted-foreground">
                Verify Token: <code className="font-mono bg-muted px-1 rounded">{channel.webhook_verify_token}</code>
              </div>
            )}
          </div>
        )}

        {!channel && (
          <div className="mb-4 p-3 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground">
              Solicita al administrador que configure tu canal de {name} para poder conectarlo.
            </p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Ocultar guía' : 'Ver guía de configuración'}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <ol className="space-y-2">
              {guide.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground mt-0.5">
                    {i + 1}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
            <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-xs text-primary font-medium mb-1">💡 Recuerda</p>
              <p className="text-xs text-muted-foreground">
                Una vez configurado el webhook en Meta, avisa al administrador para que active tu canal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientIntegrations() {
  const { clientProfile } = useAuth();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!clientProfile?.id) return;
    base44.entities.Channel.filter({ client_id: clientProfile.id }, '-created_date', 20)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [clientProfile]);

  const copyWebhook = (channelId) => {
    const url = `${WEBHOOK_BASE}/${channelId}`;
    navigator.clipboard.writeText(url);
    setCopied(channelId);
    setTimeout(() => setCopied(null), 2000);
    toast.success('URL del webhook copiada');
  };

  const channelMap = {};
  channels.forEach(ch => { channelMap[ch.type] = ch; });

  if (!clientProfile) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Integraciones"
        subtitle="Conecta tus canales de mensajería para empezar a conversar con tus clientes."
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INTEGRATIONS.map(integration => (
            <IntegrationCard
              key={integration.type}
              integration={integration}
              channel={channelMap[integration.type]}
              copied={copied}
              onCopy={copyWebhook}
            />
          ))}
        </div>
      )}
    </div>
  );
}
