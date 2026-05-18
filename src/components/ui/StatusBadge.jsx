import { cn } from '@/lib/utils';

const statusConfig = {
  // Client / Bot
  active: { label: 'Activo', class: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausado', class: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelado', class: 'bg-red-100 text-red-700' },
  inactive: { label: 'Inactivo', class: 'bg-gray-100 text-gray-600' },
  error: { label: 'Error', class: 'bg-red-100 text-red-700' },
  // Conversation
  open: { label: 'Abierta', class: 'bg-blue-100 text-blue-700' },
  bot_active: { label: 'Bot activo', class: 'bg-purple-100 text-purple-700' },
  needs_human: { label: 'Requiere humano', class: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Cerrada', class: 'bg-gray-100 text-gray-600' },
  // Leads
  new: { label: 'Nuevo', class: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Contactado', class: 'bg-indigo-100 text-indigo-700' },
  quoted: { label: 'Cotizado', class: 'bg-purple-100 text-purple-700' },
  won: { label: 'Ganado', class: 'bg-green-100 text-green-700' },
  lost: { label: 'Perdido', class: 'bg-red-100 text-red-700' },
  // Plans
  starter: { label: 'Starter', class: 'bg-gray-100 text-gray-700' },
  pro: { label: 'Pro', class: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', class: 'bg-purple-100 text-purple-700' },
  // Channel types
  whatsapp: { label: 'WhatsApp', class: 'bg-green-100 text-green-700' },
  instagram: { label: 'Instagram', class: 'bg-pink-100 text-pink-700' },
  messenger: { label: 'Messenger', class: 'bg-blue-100 text-blue-700' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", config.class, className)}>
      {config.label}
    </span>
  );
}