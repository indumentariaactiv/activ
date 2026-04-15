import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: 'admin' | 'cliente';
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRole }) => {
  const { user, profile, isLoading } = useAppStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <p className="font-headline font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-widest text-xs">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Save the attempted location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRole && profile && profile.role !== allowedRole) {
    // If logged in but wrong role, send to their own dashboard
    const target = profile.role === 'admin' ? '/admin/dashboard' : '/cliente/dashboard';
    return <Navigate to={target} replace />;
  }

  // If we have a user but no profile, and we aren't loading, 
  // we might have a broken profile record. Don't trap in a loop.
  // Instead, allow the children to render (some components might handle missing profile)
  // or at least show the layout without role-specific content.
  if (user && !profile && allowedRole) {
     const logout = async () => {
       await supabase.auth.signOut();
       window.location.href = '/login';
     };

     return (
       <div className="flex flex-col items-center justify-center p-10 gap-6 min-h-[80vh] bg-[var(--color-surface)]">
         <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <div>
              <h2 className="font-headline font-bold text-lg">Verificando Perfil...</h2>
              <p className="text-sm text-[var(--color-on-surface-variant)] max-w-xs mx-auto">
                Estamos validando tus permisos de acceso. Si esto tarda demasiado, puede que tu sesión haya expirado.
              </p>
            </div>
         </div>

         <div className="flex gap-4">
           <button onClick={() => window.location.reload()} className="btn btn-tertiary">
             <span className="material-symbols-outlined text-[1.2rem]">refresh</span>
             Reintentar
           </button>
           <button onClick={logout} className="btn bg-[var(--color-error-container)] text-[var(--color-on-error-container)] border border-[#ffb4ab]">
             <span className="material-symbols-outlined text-[1.2rem]">logout</span>
             Cerrar Sesión
           </button>
         </div>
       </div>
     );
  }

  return <>{children}</>;
};

export default AuthGuard;
