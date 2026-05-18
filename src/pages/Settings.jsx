import { Settings, Server, Globe, Key, Info } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

const plans = [
  {
    name: 'Starter',
    price: '$499 MXN/mes',
    features: ['1 canal de Meta', 'Hasta 500 mensajes/mes', '1 bot', 'Soporte básico'],
    color: 'border-border',
  },
  {
    name: 'Pro',
    price: '$999 MXN/mes',
    features: ['3 canales de Meta', 'Hasta 3,000 mensajes/mes', '3 bots', 'Base de conocimiento', 'Soporte prioritario'],
    color: 'border-primary',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'A convenir',
    features: ['Canales ilimitados', 'Mensajes ilimitados', 'Bots ilimitados', 'IA personalizada', 'SLA garantizado'],
    color: 'border-purple-400',
  },
];

const envVars = [
  { key: 'META_VERIFY_TOKEN', desc: 'Token propio para verificar webhooks de Meta', required: true },
  { key: 'META_ACCESS_TOKEN', desc: 'Token de acceso principal de Meta', required: true },
  { key: 'OPENAI_API_KEY', desc: 'Llave API de OpenAI para IA', required: true },
  { key: 'SUPABASE_URL', desc: 'URL del proyecto Supabase', required: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Llave de servicio de Supabase', required: true },
  { key: 'APP_BASE_URL', desc: 'URL pública del backend en Render', required: true },
  { key: 'DEFAULT_TIMEZONE', desc: 'Zona horaria por defecto', required: false },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Configuración"
        subtitle="Planes, variables de entorno e información del sistema"
      />

      {/* Plans */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" /> Planes disponibles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.name} className={`bg-card rounded-2xl border-2 p-5 ${plan.color} ${plan.highlight ? 'shadow-lg shadow-primary/10' : ''}`}>
              {plan.highlight && (
                <span className="inline-block text-xs font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full mb-3">Recomendado</span>
              )}
              <h3 className="font-syne font-bold text-xl text-foreground">{plan.name}</h3>
              <p className="text-2xl font-bold text-primary mt-1 mb-4">{plan.price}</p>
              <ul className="space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Env Vars */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" /> Variables de entorno (backend Render)
        </h2>
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Variable</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {envVars.map(v => (
                <tr key={v.key} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-primary">{v.key}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.desc}</td>
                  <td className="px-4 py-3">
                    {v.required
                      ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Requerida</span>
                      : <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Opcional</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Configura estas variables en el panel de Render → tu servicio → Environment
        </p>
      </section>

      {/* Architecture */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" /> Arquitectura del sistema
        </h2>
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Base44', role: 'Dashboard admin', color: 'bg-primary/10 text-primary' },
              { name: 'Render', role: 'Backend Node.js', color: 'bg-blue-100 text-blue-700' },
              { name: 'Supabase', role: 'Base de datos', color: 'bg-green-100 text-green-700' },
              { name: 'OpenAI', role: 'Motor de IA', color: 'bg-purple-100 text-purple-700' },
              { name: 'Meta', role: 'WhatsApp / IG / Messenger', color: 'bg-indigo-100 text-indigo-700' },
              { name: 'Hostinger', role: 'Dominio & DNS', color: 'bg-orange-100 text-orange-700' },
            ].map(item => (
              <div key={item.name} className="text-center p-3 rounded-xl border border-border">
                <div className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-block mb-2 ${item.color}`}>{item.name}</div>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}