import React, { useState, useEffect, useRef } from 'react';
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
  // Wait a brief period before showing "profile missing" screen
  // This prevents flashing during TOKEN_REFRESHED events
  const [showProfileError, setShowProfileError] = useState(false);
  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If user exists but profile is null, wait 3 seconds before showing error UI
  useEffect(() => {
    if (user && !profile && !isLoading) {
      profileTimerRef.current = setTimeout(() => {
        setShowProfileError(true);
      }, 4000);
    } else {
      setShowProfileError(false);
      if (profileTimerRef.current) {
        clearTimeout(profileTimerRef.current);
        profileTimerRef.current = null;
      }
    }

    return () => {
      if (profileTimerRef.current) {
        clearTimeout(profileTimerRef.current);
      }
    };
  }, [user, profile, isLoading]);

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

  // If we have a user but no profile: show a loading spinner briefly,
  // and only show the error/retry screen after the timeout
  if (user && !profile && allowedRole) {
    if (!showProfileError) {
      // Brief loading state — profile is likely arriving soon
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <p className="font-headline font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-widest text-xs">Cargando perfil...</p>
          </div>
        </div>
      );
    }

    // Only show the full error UI after the timeout
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
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }} 
              disabled={isLoggingOut}
              className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hove:bg-amber-100 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[1.2rem]">build</span>
              Reparar Conexión
            </button>
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
