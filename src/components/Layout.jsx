import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, Bot, Radio, MessageSquare, UserPlus,
  BookOpen, Settings, ChevronLeft, ChevronRight, Zap, Menu, X, Plug, LogOut, Calendar as CalendarIcon,
  HelpCircle, CalendarCheck
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/bots', icon: Bot, label: 'Bots' },
  { to: '/channels', icon: Radio, label: 'Canales' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversaciones' },
  { to: '/leads-kanban', icon: UserPlus, label: 'Leads' },
  { to: '/workflows', icon: Zap, label: 'Workflows' },
  { to: '/calendar', icon: CalendarIcon, label: 'Calendario' },
  { to: '/availability', icon: CalendarCheck, label: 'Disponibilidad' },
  { to: '/knowledge', icon: BookOpen, label: 'Conocimiento' },
  { to: '/help', icon: HelpCircle, label: 'Ayuda' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

const clientNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bot', icon: Bot, label: 'Mi Bot' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversaciones' },
  { to: '/leads-kanban', icon: UserPlus, label: 'Leads' },
  { to: '/availability', icon: CalendarCheck, label: 'Disponibilidad' },
  { to: '/knowledge', icon: BookOpen, label: 'Conocimiento' },
  { to: '/integrations', icon: Plug, label: 'Integraciones' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

export default function Layout() {
  const { isAdmin, user } = useAuth();
  const navItems = isAdmin ? adminNavItems : clientNavItems;
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [needsHumanCount, setNeedsHumanCount] = useState(0);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchCount = async () => {
      try {
        const all = await base44.entities.Conversation.list('-last_message_at', 200);
        setNeedsHumanCount(all.filter(c => c.status === 'needs_human').length);
      } catch {}
    };

    fetchCount();
    pollingRef.current = setInterval(fetchCount, 30_000);
    return () => clearInterval(pollingRef.current);
  }, [isAdmin]);

  const Sidebar = ({ mobile = false }) => (
    <aside className={cn(
      "flex flex-col h-full bg-sidebar transition-all duration-300",
      mobile ? "w-64" : collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        collapsed && !mobile && "px-3 justify-center"
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div>
            <p className="font-syne font-bold text-white text-sm tracking-wide">STEN</p>
            <p className="text-sidebar-foreground text-xs">{isAdmin ? 'Admin Panel' : 'Bot Platform'}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
          const showBadge = isAdmin && to === '/conversations' && needsHumanCount > 0;
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group",
                collapsed && !mobile ? "justify-center px-2" : "",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "text-sidebar-foreground group-hover:text-primary")} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {needsHumanCount > 9 ? '9+' : needsHumanCount}
                  </span>
                )}
              </div>
              {(!collapsed || mobile) && <span className="text-sm font-medium">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {!mobile && (
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {/* User info */}
          {user && (
            <div className={cn(
              "flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg bg-sidebar-accent/50",
              collapsed ? "justify-center" : ""
            )}>
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user.full_name || 'Usuario'}</p>
                  <p className="text-[10px] text-sidebar-foreground truncate">{user.email}</p>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => base44.auth.logout()}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-red-500/20 text-sidebar-foreground hover:text-red-400 transition-all",
              collapsed ? "justify-center" : "px-3"
            )}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground hover:text-white transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col h-full">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-syne font-bold text-sm">STEN Platform</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}