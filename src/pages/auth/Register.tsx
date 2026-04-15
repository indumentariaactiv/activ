import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import logo from '../../assets/logo.png';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Step 1: Sign up in auth.users
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Small delay just to ensure Supabase trigger creates the profile
      await new Promise(resolve => setTimeout(resolve, 800));

      // Upate extra fields explicitly if there's team name (trigger already created the profile basic stuff)
      if (teamName.trim().length > 0) {
        await supabase.from('profiles').update({ team_name: teamName }).eq('id', authData.user.id);
      }
      
      // Assume success and redirect
      navigate('/cliente/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[100px] bg-[var(--color-primary-container)] opacity-20"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] rounded-full blur-[100px] bg-[var(--color-inverse-primary)] opacity-30"></div>
      
      <div className="w-full max-w-md card glass-panel relative z-10 p-8 sm:p-10 border border-[var(--color-outline-variant)] my-8">
        
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="ALTIV Logo" className="h-16 w-auto mb-4 drop-shadow-md" />
          <p className="text-[var(--color-on-surface-variant)] mt-1 font-medium text-center text-[10px] uppercase tracking-widest">Portal de Clientes</p>
        </div>

        {error && <div className="mb-4 bg-[var(--color-error-container)] text-[var(--color-on-error-container)] p-3 rounded-[var(--radius-default)] text-sm font-medium border border-[#ffb4ab]">{error}</div>}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10px] uppercase font-bold tracking-widest text-[var(--color-on-surface-variant)]">Nombre Completo</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10px] uppercase font-bold tracking-widest text-[var(--color-on-surface-variant)]">Email</label>
            <input 
              type="email" 
              required 
              className="input-field" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="juan@ejemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10px] uppercase font-bold tracking-widest text-[var(--color-on-surface-variant)]">Contraseña</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                minLength={6}
                className="input-field w-full pr-10" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 caracteres"
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

          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10px] uppercase font-bold tracking-widest text-[var(--color-on-surface-variant)]">Equipo / Club (Opcional)</label>
            <input 
              type="text" 
              className="input-field" 
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Club Atlético Norte"
            />
          </div>
          
          <button type="submit" disabled={loading} className="btn btn-primary mt-4 group relative overflow-hidden">
            {loading ? 'Procesando...' : 'Registrarse'}
            <span className="material-symbols-outlined text-[1.2rem] group-hover:translate-x-1 transition-transform">person_add</span>
          </button>
        </form>

        <div className="mt-8 text-center pt-4 border-t border-[var(--color-outline-variant)]/20">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            ¿Ya tienes cuenta? <Link to="/login" className="font-bold text-[var(--color-primary)] hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
