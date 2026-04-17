import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: 'admin' | 'cliente';
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRole }) => {
  const { user, profile, isLoading } = useAppStore();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <p className="font-headline font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-widest text-xs">Sincronizando...</p>
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
       if (isLoggingOut) return;
       setIsLoggingOut(true);
       
       try {
         await supabase.auth.signOut();
         // Only navigate after successful logout
         window.location.href = '/login';
       } catch (err) {
         console.error("Logout error:", err);
         setIsLoggingOut(false);
         // Show error to user
         toast.error("No se pudo cerrar la sesión. Por favor intenta de nuevo.");
       }
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
           <button 
             onClick={() => window.location.reload()} 
             disabled={isLoggingOut}
             className="btn btn-tertiary disabled:opacity-50"
           >
             <span className="material-symbols-outlined text-[1.2rem]">refresh</span>
             Reintentar
           </button>
           <button 
             onClick={logout} 
             disabled={isLoggingOut}
             className="btn bg-[var(--color-error-container)] text-[var(--color-on-error-container)] border border-[#ffb4ab] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
           >
             {isLoggingOut ? (
               <>
                 <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                 <span>Cerrando...</span>
               </>
             ) : (
               <>
                 <span className="material-symbols-outlined text-[1.2rem]">logout</span>
                 <span>Cerrar Sesión</span>
               </>
             )}
           </button>
         </div>
       </div>
     );
  }

  return <>{children}</>;
};

export default AuthGuard;
