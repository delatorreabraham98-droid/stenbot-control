import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClientNav({ groups, location, collapsed, mobile, onNavigate }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isActive = (to) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  const renderItem = ({ to, icon: Icon, label }) => {
    const active = isActive(to);
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group",
          collapsed && !mobile ? "justify-center px-2" : "",
          active
            ? "bg-sidebar-accent text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "text-sidebar-foreground group-hover:text-primary")} />
        {(!collapsed || mobile) && <span className="text-sm font-medium">{label}</span>}
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => {
        // Grupo colapsable (Avanzado)
        if (group.collapsible) {
          const hasActive = group.items.some(i => isActive(i.to));
          return (
            <div key={gi}>
              {(!collapsed || mobile) && (
                <button
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className={cn(
                    "w-full flex items-center gap-2 mx-2 px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold rounded-lg transition-colors",
                    hasActive ? "text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  )}
                >
                  {advancedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>{group.label}</span>
                </button>
              )}
              {(advancedOpen || hasActive || (collapsed && !mobile)) && (
                <div>{group.items.map(renderItem)}</div>
              )}
            </div>
          );
        }

        // Grupo simple con etiqueta
        return (
          <div key={gi}>
            {group.label && (!collapsed || mobile) && (
              <p className="px-5 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            {group.items.map(renderItem)}
          </div>
        );
      })}
    </div>
  );
}