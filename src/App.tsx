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
    let isSubscribed = true;

    // Safety fallback: if auth takes too long, force unlock after 3s
    const timeoutId = setTimeout(() => {
      if (useAppStore.getState().isLoading) {
        console.warn("Auth initialization timed out. Forcing app unlock.");
        setLoading(false);
      }
    }, 3000);

    const handleSession = async (session: any, event: string) => {
      if (!isSubscribed) return;
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
        setUser(session.user);

        // Only fetch profile if we don't already have it for this user
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
    };

    // 1. Manually fetch the initial session to prevent race conditions or missing events
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Auth - getSession error:", error);
        setLoading(false);
      } else {
        handleSession(session, 'MANUAL_INITIAL_SESSION');
      }
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      await handleSession(session, event);
    });

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutId);
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
        if (error.code === 'PGRST116') {
          if (retries > 0) {
            console.log("Fetch - Profile not found yet, retrying in 1.5s...");
            fetchingProfileFor.current = null;
            await new Promise(r => setTimeout(r, 1500));
            return fetchProfile(userId, retries - 1);
          } else {
            console.warn("Fetch - Profile not found after retries. Attempting to create fallback profile...");
            // Create a fallback profile using session data or defaults
            const sessionStr = sessionStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
            let fullName = 'Usuario';
            if (sessionStr) {
               try {
                 const sessionData = JSON.parse(sessionStr);
                 if (sessionData?.user?.user_metadata?.full_name) {
                    fullName = sessionData.user.user_metadata.full_name;
                 }
               } catch(e) {}
            }
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                name: fullName,
                role: 'cliente'
              })
              .select('*')
              .single();

            if (!insertError && newProfile) {
              console.log("Fetch - Fallback profile created successfully.");
              setProfile(newProfile as any);
              return; // Success, bail out
            }
          }
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
