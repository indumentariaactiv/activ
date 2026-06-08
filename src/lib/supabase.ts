import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

/**
 * Envelops a promise in a timeout to prevent infinite hanging.
 */
export const withTimeout = <T>(promise: Promise<T> | PromiseLike<T>, ms: number = 15000): Promise<T> => {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error('Tiempo de espera agotado. Verificá tu internet y reintentá.')), ms)
  );
  return Promise.race([promise as Promise<T>, timeoutPromise]);
};

/**
 * Translates common Supabase/Network errors into user-friendly messages.
 */
export const handleSupabaseError = (error: any): string => {
  if (!error) return 'Error desconocido.';
  
  const message = error.message || '';
  
  if (message.toLowerCase().includes('failed to fetch') || 
      message.toLowerCase().includes('networkerror') || 
      message.toLowerCase().includes('load failed')) {
    return 'No se pudo conectar con el servidor. Es muy probable que el proyecto de Supabase esté PAUSADO por inactividad o que no tengas internet.';
  }
  
  if (message.includes('JWT expired')) {
    return 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
  }

  if (message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }

  return message;
};
