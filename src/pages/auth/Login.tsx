import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import logo from '../../assets/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setLoading: setGlobalLoading, profile, user, isLoading: isGlobalLoading } = useAppStore();

  useEffect(() => {
    // Clear any stale loading state when hitting the login page
    setGlobalLoading(false);
  }, [setGlobalLoading]);

  // Redirection Watcher: Once App.tsx loads the profile (or fails to), we navigate
  useEffect(() => {
    // Scenario A: Profile found successfully
    if (profile) {
      console.log("Login - Profile detected, navigating to:", profile.role);
      if (profile.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/cliente/dashboard');
      }
      return;
    }

    // Scenario B: User is logged in, but global loading has finished without finding a profile
    // This often happens for newly registered users where the trigger is slightly slow.
    if (user && !isGlobalLoading && !profile) {
      console.log("Login - User logged in but no profile found. Using safety fallback to client dashboard.");
      navigate('/cliente/dashboard');
    }

    // Fail-safe: If global loading finished and we are still here, reset local loading state
    if (!isGlobalLoading && loading) {
       setLoading(false);
    }
  }, [profile, user, isGlobalLoading, navigate, loading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log("Login - Attempting sign in...");
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      console.log("Login - Auth successful, waiting for global state...");
      // We don't call navigate here. 
      // onAuthStateChange in App.tsx will fire, fetch profile,
      // and then the useEffect above will redirect us.
      
    } catch (err: any) {
      console.error("Login - Error:", err.message);
      setError(err.message || 'Error inesperado al iniciar sesión.');
      setLoading(false);
    }
    // Note: setLoading(false) for the local state is intentionally OMITTED 
    // on success to keep the "Ingresando..." button state until navigation occurs.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[100px] bg-[var(--color-primary-container)] opacity-20"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full blur-[100px] bg-[var(--color-inverse-primary)] opacity-30"></div>
      
      <div className="w-full max-w-md card glass-panel relative z-10 p-8 sm:p-10 border border-[var(--color-outline-variant)]">
        
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="ALTIV Logo" className="h-20 w-auto mb-4 drop-shadow-md" />
          <p className="text-[var(--color-on-surface-variant)] mt-1 font-medium tracking-widest uppercase text-[10px]">Orders Portal</p>
        </div>

        {error && <div className="mb-4 bg-[var(--color-error-container)] text-[var(--color-on-error-container)] p-3 rounded-[var(--radius-default)] text-sm font-medium border border-[#ffb4ab]">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">Email</label>
            <input 
              type="email" 
              required 
              className="input-field" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="input-field w-full pr-10" 
                placeholder="********" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[var(--color-primary)] focus:outline-none"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="btn btn-primary mt-2 group relative overflow-hidden">
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            <span className="material-symbols-outlined text-[1.2rem] group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            ¿No tienes cuenta? <Link to="/register" className="font-bold text-[var(--color-primary)] hover:underline">Regístrate aquí</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
