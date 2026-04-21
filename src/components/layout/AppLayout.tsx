import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.png';
import { usePWAInstall } from '../../hooks/usePWAInstall';


const AppLayout = () => {
  const { profile } = useAppStore();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isInstallable, handleInstall } = usePWAInstall();


  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent duplicate clicks
    
    try {
      setIsLoggingOut(true);
      console.log("Logout - Initiating hard sign out...");
      const store = useAppStore.getState();
      store.setUser(null);
      store.setProfile(null);
      
      await supabase.auth.signOut().catch(console.error);
      localStorage.clear(); 
      sessionStorage.clear();
      window.location.replace('/login');
    } catch (err) {
      console.error("Logout failed:", err);
      setIsLoggingOut(false); // Reset state on error
      toast.error("Error al cerrar sesión. Intenta de nuevo.");
    }
  };

  const navItems = profile?.role === 'admin' 
    ? [
        { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
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
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary-container)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white transition-all shadow-sm font-bold text-xs"
            >
              <span className="material-symbols-outlined text-lg">download_for_offline</span>
              <span>Instalar App</span>
            </button>
          )}
          {profile?.role === 'admin' && (

            <span className="border border-[var(--color-primary)] text-[var(--color-primary)] bg-white text-[10px] uppercase font-bold px-2 py-0.5 rounded hidden sm:inline-block shadow-sm">Admin View</span>
          )}
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Saliendo...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">logout</span>
                <span className="hidden sm:inline">Salir</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-10 pb-28 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-surface)]/95 backdrop-blur-lg border-t border-[var(--color-outline-variant)]/20 px-6 py-2 flex justify-around items-center z-50 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-all rounded-xl active:scale-95
                ${isActive 
                  ? 'text-[var(--color-primary)]' 
                  : 'text-[var(--color-on-surface-variant)] hover:text-gray-900'
                }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[var(--color-primary-container)] text-[var(--color-primary)] shadow-sm' : ''}`}>
                <span className="material-symbols-outlined text-[1.5rem]">{item.icon}</span>
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'font-black' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
        {isInstallable && (
          <button 
            onClick={handleInstall}
            className="flex flex-col items-center gap-1 px-4 py-2 transition-all rounded-xl active:scale-95 text-[var(--color-primary)]"
          >
            <div className="p-1.5 rounded-xl bg-[var(--color-primary)] text-white shadow-lg animate-bounce">
              <span className="material-symbols-outlined text-[1.5rem]">download_for_offline</span>
            </div>
            <span className="text-[10px] font-black tracking-wide">Instalar</span>
          </button>
        )}
      </nav>


    </div>
  );
};

export default AppLayout;
