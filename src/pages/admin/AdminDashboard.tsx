import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AdminDashboard = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'active' | 'delivered'>('active');
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mounted flag on mount
    isMountedRef.current = true;
    
    fetchGlobalOrders();

    // Cleanup: mark as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchGlobalOrders = async () => {
    if (isMountedRef.current) {
      setLoading(true);
      setError('');
    }

    try {
      // Fetch orders and join with profiles to get client info (only confirmed and above)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (name, team_name, email),
          client_shipping_info (*)
        `)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setOrders(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching admin orders:", err);
      if (isMountedRef.current) setError('No se pudieron cargar los pedidos. Intenta actualizar.');
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };


  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Recibido';
      case 'in_production': return 'En Producción';
      case 'delivered': return 'Finalizado';
      default: return status;
    }
  };

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_production': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
            Panel de Gestión
          </h1>
          <p className="text-[var(--color-on-surface-variant)] mt-1">Control de pedidos y estados de fabricación.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={fetchGlobalOrders} className="btn btn-tertiary">
                <span className="material-symbols-outlined text-[1.2rem]">refresh</span>
                Actualizar
            </button>
        </div>
      </div>

      <div className="card shadow-[var(--shadow-ambient)] border border-[var(--color-outline-variant)]/20 overflow-hidden">
        <div className="bg-[var(--color-surface-container-low)] px-6 pt-4 border-b border-[var(--color-outline-variant)]/20">
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setActiveTab('active')}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]'}`}
            >
              En Curso / Activos
            </button>
            <button 
              onClick={() => setActiveTab('delivered')}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${activeTab === 'delivered' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]'}`}
            >
              Finalizados / Entregados
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">Cargando pedidos...</p>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-[var(--color-error)]/20 bg-[var(--color-error-container)] p-8 text-center text-[var(--color-error)]">
              {error}
            </div>
          ) : orders.filter(o => activeTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered').length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--color-surface-container-low)] p-10 text-center">
              <p className="text-sm font-semibold text-[var(--color-on-surface-variant)]">No existen pedidos en esta categoría.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {orders
                .filter(o => activeTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered')
                .map((o) => (
                  <div key={o.id} className="group rounded-[28px] border border-[var(--color-outline-variant)]/20 bg-white p-6 shadow-sm transition hover:shadow-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] border ${getStatusChipClass(o.status)}`}>
                            {getStatusLabel(o.status)}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)]">{new Date(o.created_at).toLocaleDateString()}</span>
                        </div>
                        <h2 className="font-headline text-xl font-bold text-[var(--color-on-surface)] truncate">{o.name}</h2>
                        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
                          {(Array.isArray(o.client_shipping_info) ? o.client_shipping_info[0]?.full_name : o.client_shipping_info?.full_name) || o.profiles?.team_name || o.profiles?.name || 'Cliente sin nombre'} · ID {o.id.split('-')[0]}
                        </p>
                        
                        <div className="mt-4 flex flex-col gap-3 items-start">
                          <Link to={`/admin/pedido/${o.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-outline-variant)]/50 bg-[var(--color-surface-container-high)] px-4 py-2 text-sm font-bold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white">
                            <span className="material-symbols-outlined text-base">visibility</span>
                            {o.status === 'confirmed' ? 'Cargar Ficha' : o.status === 'in_production' ? 'Ver Producción' : 'Ver Detalles'}
                          </Link>
                          <span className="text-[11px] text-[var(--color-on-surface-variant)]">{o.status === 'confirmed' ? 'Pedido listo para ficha técnica' : o.status === 'in_production' ? 'En la línea de producción' : 'Pedido finalizado'}</span>
                        </div>
                      </div>

                      <div className="lg:col-span-1 border-l border-[var(--color-outline-variant)]/20 pl-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                          <div className="space-y-1.5 pt-2 border-t border-[var(--color-outline-variant)]/10 col-span-2">
                             <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-[var(--color-primary)] opacity-60">person</span>
                                <span className="font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] text-[9px]">Datos de Contacto</span>
                             </div>
                              <div className="grid grid-cols-2 gap-y-1">
                                 {(() => {
                                   const shipInfo = Array.isArray(o.client_shipping_info) ? o.client_shipping_info[0] : o.client_shipping_info;
                                   return (
                                     <>
                                       <div className="flex gap-1"><span className="font-bold">Nombre:</span> <span>{shipInfo?.full_name || o.profiles?.team_name || o.profiles?.name || '-'}</span></div>
                                       <div className="flex gap-1"><span className="font-bold">Email:</span> <span className="truncate">{o.profiles?.email || '-'}</span></div>
                                       <div className="flex gap-1"><span className="font-bold">Teléfono:</span> <span>{shipInfo?.phone || '-'}</span></div>
                                       <div className="flex gap-1"><span className="font-bold">Courier:</span> <span>{shipInfo?.preferred_carrier || '-'}</span></div>
                                     </>
                                   );
                                 })()}
                              </div>
                           </div>
                          
                          <div className="space-y-1.5 pt-2 border-t border-[var(--color-outline-variant)]/10 col-span-2">
                             <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-[var(--color-primary)] opacity-60">local_shipping</span>
                                <span className="font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] text-[9px]">Logística y Propósito</span>
                             </div>
                              {(() => {
                                 const shipInfo = Array.isArray(o.client_shipping_info) ? o.client_shipping_info[0] : o.client_shipping_info;
                                 return (
                                   <>
                                     <div className="truncate"><span className="font-bold">Dirección:</span> {shipInfo?.shipping_address || '-'}</div>
                                     <div><span className="font-bold">Propósito:</span> {shipInfo?.order_purpose || '-'}</div>
                                   </>
                                 );
                              })()}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
