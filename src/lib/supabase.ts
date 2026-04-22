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
