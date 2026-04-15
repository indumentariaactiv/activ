import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import logo from '../../assets/logo.png';

const AppLayout = () => {
  const { profile } = useAppStore();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      console.log("Logout - Initiating hard sign out...");
      // 1. Clear store immediately
      const store = useAppStore.getState();
      store.setUser(null);
      store.setProfile(null);
      store.setLoading(true); 
      
      // 2. Sign out from Supabase (async)
      await supabase.auth.signOut().catch(console.error);
      
      // 3. Clear storage to prevent sticky sessions
      localStorage.clear(); 
      sessionStorage.clear();
      
      // 4. Force a hard refresh/replace to the login page
      window.location.replace('/login');
    } catch (err) {
      console.error("Logout failed:", err);
      window.location.href = '/login';
    }
  };

  const navItems = profile?.role === 'admin' 
    ? [
        { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/admin/maestros', icon: 'settings', label: 'Maestros' },
        { path: '/admin/catalog', icon: 'style', label: 'Catálogo' },
      ]
    : [
        { path: '/cliente/dashboard', icon: 'dashboard', label: 'Dashboard' },
        { path: '/cliente/pedido/nuevo', icon: 'add_circle', label: 'Nuevo Pedido', primary: true },
      ];

  return (
    <div className="bg-[var(--color-surface)] font-body text-[var(--color-on-surface)] min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-outline-variant)]/20 px-4 md:px-8 py-3 flex justify-between items-center h-16">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="ALTIV Logo" className="h-10 w-auto" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm transition-all
                    ${isActive 
                      ? 'bg-[var(--color-primary-container)]/10 text-[var(--color-primary)]' 
                      : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)]'
                    }`}
                >
                  <span className="material-symbols-outlined text-[1.2rem]">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <span className="border border-[var(--color-primary)] text-[var(--color-primary)] bg-white text-[10px] uppercase font-bold px-2 py-0.5 rounded hidden sm:inline-block shadow-sm">Admin View</span>
          )}
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm font-bold text-xs"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-10">
        <Outlet />
      </main>

    </div>
  );
};

export default AppLayout;
