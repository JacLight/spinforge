import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Rocket, Key, BarChart3, User, LogOut, Menu, X } from 'lucide-react';
import { clearSession, getCurrentSession, customerAuth } from '../services/customerAuth';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sites', label: 'Sites', icon: Globe },
  { to: '/deployments', label: 'Deployments', icon: Rocket },
  { to: '/tokens', label: 'API Tokens', icon: Key },
  { to: '/usage', label: 'Usage', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: User },
];

export function CustomerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const session = getCurrentSession();

  const handleLogout = async () => {
    if (session.authToken) await customerAuth.logout(session.authToken);
    clearSession();
    navigate('/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow border border-gray-200"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className={`fixed inset-y-0 left-0 w-64 bg-white/90 backdrop-blur-sm border-r border-gray-200 z-40 flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <div>
              <div className="font-semibold text-gray-900">SpinForge</div>
              <div className="text-xs text-gray-500">Customer Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-gray-500">Signed in as</div>
            <div className="text-sm font-medium text-gray-900 truncate">{session.email || '—'}</div>
            <div className="text-xs text-gray-400 truncate font-mono">{session.customerId || ''}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="md:ml-64 min-h-screen">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
