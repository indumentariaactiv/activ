import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import { Toaster } from 'react-hot-toast';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AppLayout from './components/layout/AppLayout';
import AuthGuard from './components/auth/AuthGuard';
import ClientDashboard from './pages/client/ClientDashboard';
import NewOrder from './pages/client/NewOrder';
import ClientOrderDetails from './pages/client/ClientOrderDetails';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrderDetails from './pages/admin/AdminOrderDetails';

function App() {
  const { setUser, setProfile, setLoading, isLoading } = useAppStore();
  const fetchingProfileFor = useRef<string | null>(null);
  // Track whether we've completed the initial auth check
  const initializedRef = useRef(false);

  useEffect(() => {
    // Use ONLY onAuthStateChange as the single source of truth.
    // Supabase v2 fires INITIAL_SESSION immediately on subscribe,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event, "| User:", session?.user?.id?.slice(0, 8) || 'none');

      if (event === 'SIGNED_OUT') {
        console.log("Auth - Cleaning up session states...");
        setUser(null);
        setProfile(null);
        fetchingProfileFor.current = null;
        setLoading(false);
        initializedRef.current = true;
        return;
      }

      const userId = session?.user?.id;

      if (userId) {
        setUser(session!.user);

        // Only fetch profile if we don't already have it for this user,
        // OR if this is the initial session check.
        const currentProfile = useAppStore.getState().profile;
        const profileAlreadyLoaded = currentProfile?.id === userId;

        if (!profileAlreadyLoaded && fetchingProfileFor.current !== userId) {
          await fetchProfile(userId);
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
      initializedRef.current = true;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setLoading]);

  const fetchProfile = async (userId: string, retries = 3) => {
    if (fetchingProfileFor.current === userId) return;
    fetchingProfileFor.current = userId;
    
    try {
      console.log(`Fetch - Attempting to load profile for: ${userId.slice(0, 8)} (Attempt ${4 - retries})`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116' && retries > 0) {
          console.log("Fetch - Profile not found yet, retrying in 1.5s...");
          fetchingProfileFor.current = null;
          await new Promise(r => setTimeout(r, 1500));
          return fetchProfile(userId, retries - 1);
        }
        throw error;
      };
      
      if (data) {
        console.log("Fetch - Profile loaded:", data.role);
        setProfile(data as any);
      }
    } catch (err: any) {
      console.error("Fetch - Failed to load profile:", err.message || err);
      // Don't null out the profile on TOKEN_REFRESHED failures if we already have one
      const currentProfile = useAppStore.getState().profile;
      if (!currentProfile) {
        setProfile(null);
      }
    } finally {
      fetchingProfileFor.current = null;
    }
  };

  return (
    <Router>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <p className="font-headline font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-widest text-xs">ALTIV Sistema</p>
          </div>
        </div>
      ) : (
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Client Routes */}
          <Route element={<AuthGuard allowedRole="cliente"><AppLayout /></AuthGuard>}>
            <Route path="/cliente/dashboard" element={<ClientDashboard />} />
            <Route path="/cliente/pedido/nuevo" element={<NewOrder />} />
            <Route path="/cliente/pedido/:id/editar" element={<NewOrder />} />
            <Route path="/cliente/pedido/:id" element={<ClientOrderDetails />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<AuthGuard allowedRole="admin"><AppLayout /></AuthGuard>}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/pedido/:id" element={<AdminOrderDetails />} />
          </Route>
          
          {/* Initial Redirect & Fallback */}
          <Route path="/" element={<Navigate to="/cliente/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      <Toaster position="top-right" />
    </Router>
  );
}

export default App;
