import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, MessageSquare, BarChart3, Zap, Calendar,
  BookOpen, Settings, Lightbulb, MoreHorizontal
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

export default function Help() {
  const sections = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Vista general de tu plataforma',
      content: (
        <div className="space-y-4">
          <p>El Dashboard es tu punto de entrada principal. Aquí puedes ver:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Estadísticas generales:</strong> Conversaciones activas, leads totales y estado de bots</li>
            <li><strong>Resumen de actividad:</strong> Últimos mensajes y actualizaciones</li>
            <li><strong>Acceso rápido:</strong> Botones para navegar a las secciones más usadas</li>
          </ul>
        </div>
      )
    },
    {
      id: 'clients',
      title: 'Clientes',
      icon: <Users className="w-5 h-5" />,
      description: 'Gestiona todos tus clientes',
      content: (
        <div className="space-y-4">
          <p>Aquí registras y administras los clientes que usan la plataforma:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Crear cliente:</strong> Botón "Nuevo cliente" para agregar un negocio</li>
            <li><strong>Información:</strong> Nombre comercial, contacto, email, teléfono</li>
            <li><strong>Plan:</strong> Asigna Starter, Pro o Enterprise según necesidades</li>
            <li><strong>Estado:</strong> Activo, pausado o cancelado</li>
            <li><strong>Editar:</strong> Haz clic en cualquier cliente para modificar datos</li>
          </ul>
        </div>
      )
    },
    {
      id: 'bots',
      title: 'Bots de IA',
      icon: <Zap className="w-5 h-5" />,
      description: 'Configura asistentes inteligentes',
      content: (
        <div className="space-y-4">
          <p>Crea y personaliza bots de IA para cada cliente:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Crear bot:</strong> "Nuevo bot" - asigna a un cliente específico</li>
            <li><strong>Personalidad:</strong> Define cómo actúa el bot (amable, profesional, etc.)</li>
            <li><strong>Contexto:</strong> Información del negocio que debe conocer el bot</li>
            <li><strong>Idioma:</strong> Español o inglés</li>
            <li><strong>Audio:</strong> Activa si quieres respuestas en voz</li>
            <li><strong>Mensaje de escalación:</strong> Qué dice el bot antes de pasar a humano</li>
          </ul>
        </div>
      )
    },
    {
      id: 'channels',
      title: 'Canales',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Conecta WhatsApp, Instagram y Messenger',
      content: (
        <div className="space-y-4">
          <p>Integra canales de Meta para recibir mensajes de clientes:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>WhatsApp:</strong> Conecta tu número de negocio de WhatsApp</li>
            <li><strong>Instagram:</strong> Mensajes directos desde tu cuenta de Instagram</li>
            <li><strong>Messenger:</strong> Integra tu página de Facebook</li>
            <li><strong>Webhook:</strong> La plataforma proporciona un URL para configurar en Meta</li>
            <li><strong>Estado:</strong> Verifica si el canal está conectado correctamente</li>
          </ul>
        </div>
      )
    },
    {
      id: 'conversations',
      title: 'Conversaciones',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Gestiona chats con clientes',
      content: (
        <div className="space-y-4">
          <p>Centro de control de todas las conversaciones en tiempo real:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Listar conversaciones:</strong> Ve todas las conversaciones activas</li>
            <li><strong>Filtrar por estado:</strong> Abierta, bot activo, requiere humano, cerrada</li>
            <li><strong>Vista de chat:</strong> Lee el historial completo con el cliente</li>
            <li><strong>Responder:</strong> Envía mensajes directos o usa plantillas rápidas</li>
            <li><strong>Ver teléfono:</strong> Información de contacto del cliente en la conversación</li>
            <li><strong>Cambiar estado:</strong> Marca como cerrada o requiere escalación</li>
          </ul>
        </div>
      )
    },
    {
      id: 'leads',
      title: 'Leads & Pipeline',
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Gestiona tu embudo de ventas',
      content: (
        <div className="space-y-4">
          <p>Dos vistas para administrar prospects y seguir el progreso de ventas:</p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm">Vista de Tabla (Leads):</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Lista de todos los leads con detalles</li>
                <li>Columnas: Nombre, teléfono, producto, estado, valor</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm">Vista Kanban (Pipeline):</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Arrastra leads entre estados: Nuevo → Contactado → Cotizado → Ganado/Perdido</li>
                <li>Visualiza el progreso de tu embudo de ventas</li>
                <li>Identifica rápidamente qué leads necesitan seguimiento</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Estados: Nuevo, Contactado, Cotizado, Ganado, Perdido</p>
        </div>
      )
    },
    {
      id: 'workflows',
      title: 'Automatizaciones',
      icon: <Zap className="w-5 h-5" />,
      description: 'Automatiza procesos de negocio',
      content: (
        <div className="space-y-4">
          <p>Crea flujos automáticos que se ejecuten según ciertos eventos:</p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm">Triggers (Activadores):</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Lead creado</li>
                <li>Cambio de estado de lead</li>
                <li>Cambio de estado de conversación</li>
                <li>Mensaje recibido</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm">Acciones:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Enviar email</li>
                <li>Enviar WhatsApp</li>
                <li>Actualizar lead</li>
                <li>Crear tarea</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3"><strong>Ejemplo:</strong> Cuando creas un lead, envía un WhatsApp automáticamente saludando al cliente</p>
        </div>
      )
    },
    {
      id: 'calendar',
      title: 'Calendario',
      icon: <Calendar className="w-5 h-5" />,
      description: 'Gestiona citas y eventos',
      content: (
        <div className="space-y-4">
          <p>Calendario centralizado para todas tus citas y reuniones:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Citas de la plataforma:</strong> Reuniones con clientes creadas en el sistema</li>
            <li><strong>Google Calendar:</strong> Sincronización automática con tu calendario de Google</li>
            <li><strong>Crear cita:</strong> Especifica fecha, hora, cliente, tipo (meeting, call, etc.)</li>
            <li><strong>Asignar:</strong> Delega citas a miembros del equipo</li>
            <li><strong>Recordatorios:</strong> La plataforma puede enviar notificaciones</li>
            <li><strong>Estados:</strong> Programada, confirmada, completada, cancelada, no presentó</li>
          </ul>
        </div>
      )
    },
    {
      id: 'knowledge',
      title: 'Base de Conocimiento',
      icon: <BookOpen className="w-5 h-5" />,
      description: 'Enseña a los bots sobre tu negocio',
      content: (
        <div className="space-y-4">
          <p>Crea una base de datos de información para que los bots respondan preguntas:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Categorías:</strong> FAQ, Productos, Precios, Políticas, Horarios, Garantía, Instalación, Mayoreo</li>
            <li><strong>Crear item:</strong> Título + Contenido (puede ser largo y detallado)</li>
            <li><strong>Activar/Desactivar:</strong> Controla qué información está disponible</li>
            <li><strong>Uso del bot:</strong> El bot consulta esta base para responder preguntas naturales</li>
            <li><strong>Cita del sitio:</strong> Importa información directamente desde la web de tu cliente</li>
          </ul>
        </div>
      )
    },
    {
      id: 'settings',
      title: 'Configuración',
      icon: <Settings className="w-5 h-5" />,
      description: 'Ajustes de la plataforma',
      content: (
        <div className="space-y-4">
          <p>Personaliza la experiencia y conecta integraciones:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Perfil:</strong> Edita tu información personal y contraseña</li>
            <li><strong>Integraciones:</strong> Conecta Google Calendar y otros servicios</li>
            <li><strong>Preferencias:</strong> Idioma, zona horaria, notificaciones</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Guía de Uso"
        subtitle="Aprende cómo funciona STEN Platform y cómo sacar el máximo provecho de cada función"
      />

      {/* Inicio Rápido */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Inicio Rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-l-2 border-primary pl-4">
              <p className="font-semibold text-sm mb-2">1. Crear un Cliente</p>
              <p className="text-sm text-muted-foreground">Ve a Clientes → "Nuevo cliente" y completa la información comercial</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="font-semibold text-sm mb-2">2. Crear un Bot</p>
              <p className="text-sm text-muted-foreground">Ve a Bots → "Nuevo bot", selecciona el cliente y personaliza la IA</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="font-semibold text-sm mb-2">3. Conectar Canales</p>
              <p className="text-sm text-muted-foreground">Ve a Canales → "Nuevo canal", elige WhatsApp/Instagram/Messenger</p>
            </div>
            <div className="border-l-2 border-primary pl-4">
              <p className="font-semibold text-sm mb-2">4. Cargar Conocimiento</p>
              <p className="text-sm text-muted-foreground">Ve a Base de Conocimiento → Agrega información sobre el negocio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secciones Detalladas */}
      <div>
        <h2 className="text-2xl font-bold mb-4 font-syne">Funcionalidades Detalladas</h2>
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-3 lg:grid-cols-5 gap-2 bg-transparent border border-border p-1">
            {sections.map(section => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="flex flex-col items-center gap-2 py-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                {section.icon}
                <span className="text-xs text-center">{section.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map(section => (
            <TabsContent key={section.id} value={section.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent rounded-lg">{section.icon}</div>
                    <div>
                      <CardTitle>{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {section.content}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Casos de Uso Comunes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MoreHorizontal className="w-5 h-5" />
            Casos de Uso Comunes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-sm mb-2">📞 Automatizar respuestas a consultas frecuentes</p>
              <p className="text-sm text-muted-foreground">
                Agrega preguntas comunes en Base de Conocimiento → El bot responde automáticamente → Solo interviene humano si es complejo
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">🔗 Calificar y seguir leads automáticamente</p>
              <p className="text-sm text-muted-foreground">
                Crea un Workflow que cuando se crea un lead, envíe un WhatsApp inicial → Mueve los leads en el Kanban según progreso
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">📅 Nunca olvides una cita</p>
              <p className="text-sm text-muted-foreground">
                Usa el Calendario integrado → Sincroniza con Google Calendar → Recibe recordatorios automáticos
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-2">👥 Gestiona múltiples clientes</p>
              <p className="text-sm text-muted-foreground">
                Crea un cliente por cada negocio → Un bot único por cliente → Canales y conversaciones separadas por cliente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-accent/50 border-accent">
        <CardHeader>
          <CardTitle className="text-base">💡 Consejos para Aprovechar la Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>✓ <strong>Personaliza los bots:</strong> Cuanto más detallado sea el contexto, mejor responden los bots</li>
            <li>✓ <strong>Mantén actualizada la Base de Conocimiento:</strong> Agrega información según nuevos productos/servicios</li>
            <li>✓ <strong>Usa plantillas:</strong> Crea respuestas rápidas para preguntas repetitivas</li>
            <li>✓ <strong>Monitorea el Kanban:</strong> Revisa regularmente qué leads necesitan seguimiento</li>
            <li>✓ <strong>Configura Workflows:</strong> Automatiza tareas repetitivas para ahorrar tiempo</li>
            <li>✓ <strong>Usa Google Calendar:</strong> Sincroniza tus citas en un solo lugar</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}