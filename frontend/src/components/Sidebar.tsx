import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠', roles: ['ADMIN', 'AGENT'] },
  { to: '/tickets', label: 'Atendimentos', icon: '🎫', roles: ['ADMIN', 'AGENT'] },
  { to: '/sectors', label: 'Setores', icon: '🏢', roles: ['ADMIN'] },
  { to: '/users', label: 'Usuários', icon: '👥', roles: ['ADMIN'] },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-chatz-card border-r border-chatz-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-chatz-border">
        <h1 className="text-2xl font-bold text-chatz-primary">chatZ 🚀</h1>
        <p className="text-xs text-chatz-muted mt-1">Painel de atendimento</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-chatz-primary text-white'
                  : 'text-chatz-muted hover:text-chatz-text hover:bg-chatz-bg'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-chatz-border">
        <p className="text-xs text-chatz-muted text-center">
          chatZ v0.1.0
        </p>
      </div>
    </aside>
  );
}