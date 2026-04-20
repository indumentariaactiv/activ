import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

const ClientDashboard = () => {
  const { profile, user, isLoading: globalLoading } = useAppStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'production' | 'delivered'>('pending');
  const isMountedRef = useRef(true);
  // Use a stable user ID for dependency tracking instead of the full user object
  const userId = user?.id;

  const filteredOrders = orders.filter(order => {
    const status = (order.status || '').toLowerCase().trim();
    if (activeTab === 'pending') {
      return ['draft', 'confirmed', 'recibido'].includes(status);
    }
    if (activeTab === 'production') {
      return ['in_production', 'produccion', 'producción'].includes(status);
    }
    if (activeTab === 'delivered') {
      return ['delivered', 'finalizado'].includes(status);
    }
    return false;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Stable fetch function that doesn't change between renders
  const fetchOrders = useCallback(async () => {
    const currentUserId = useAppStore.getState().user?.id;
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          name,
          status,
          created_at,
          order_items(id)
        `)
        .eq('client_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (isMountedRef.current) {
        setOrders(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      if (isMountedRef.current) {
        toast.error('Error al cargar pedidos. Intenta refrescar la página.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch on mount and when userId changes (not the full user object reference)
  useEffect(() => {
    if (globalLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [userId, globalLoading, fetchOrders]);

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este pedido?')) return;
    
    const toastId = toast.loading('Eliminando pedido...');
    
    try {
      const { error, count } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('id', orderId);

      if (error) throw error;
      
      // If no rows were affected, it means RLS blocked it or order doesn't exist
      if (count === 0) {
        toast.error('No tienes permiso para eliminar este pedido (puede que ya esté confirmado o en producción).', { id: toastId });
        return;
      }

      if (isMountedRef.current) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        toast.success('Pedido eliminado correctamente', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Error al eliminar: ${err.message || 'Inténtalo de nuevo.'}`, { id: toastId });
      console.error(err);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft': return <span className="px-3 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-full text-[10px] font-black uppercase tracking-widest">Borrador</span>;
      case 'confirmed': return <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-black uppercase tracking-widest">Confirmado</span>;
      case 'in_production': return <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-widest">En Producción</span>;
      case 'delivered': return <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-black uppercase tracking-widest">Entregado</span>;
      default: return <span className="px-3 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-full text-[10px] font-black uppercase tracking-widest">{status}</span>;
    }
  };

  return (
    <>
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="font-headline text-[var(--color-primary)] font-extrabold tracking-tighter uppercase text-sm mb-2">
            ¡Hola, {profile?.name?.split(' ')[0]}!
          </p>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
            Mis Pedidos
          </h1>
        </div>
        <Link to="/cliente/pedido/nuevo" className="btn btn-primary w-full md:w-auto shadow-lg hover:shadow-[0_0_20px_var(--color-primary-container)]">
          <span className="material-symbols-outlined">add_circle</span>
          Comenzar Pedido
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><span className="font-headline animate-pulse">Cargando pedidos...</span></div>
      ) : orders.length === 0 ? (
        <div className="card text-center p-12">
          <div className="w-16 h-16 bg-[var(--color-surface-container-high)] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[var(--color-primary)] text-3xl">inventory_2</span>
          </div>
          <h2 className="font-headline text-xl font-bold mb-2">No tienes pedidos aún</h2>
          <p className="text-[var(--color-on-surface-variant)] text-sm mb-6 max-w-md mx-auto">
            Comienza a cargar tu primer pedido de indumentaria desde el botón inferior o desde nuestro creador.
          </p>
          <Link to="/cliente/pedido/nuevo" className="btn btn-primary mx-auto">
            Comenzar Pedido
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Tabs for Order Categorization */}
          <div className="flex flex-wrap gap-3 md:gap-4 bg-[var(--color-surface-container-low)] rounded-full p-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
                activeTab === 'pending'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]'
              }`}
            >
              Borradores y Pendientes
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
                activeTab === 'production'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]'
              }`}
            >
              En Producción
            </button>
            <button
              onClick={() => setActiveTab('delivered')}
              className={`rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
                activeTab === 'delivered'
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]'
              }`}
            >
              Historial
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--color-surface-container-low)] p-10 text-center">
               <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)] mb-2">inbox</span>
               <p className="font-bold text-[var(--color-on-surface-variant)]">No hay pedidos en esta sección.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="rounded-[32px] border border-[var(--color-outline-variant)]/20 bg-white p-5 md:p-6 shadow-sm transition hover:shadow-md" style={{ 
                  borderLeftWidth: '6px',
                  borderLeftColor: order.status === 'confirmed' ? '#00c06a' : 
                                  order.status === 'in_production' ? 'var(--color-primary)' : 
                                  'var(--color-outline-variant)' 
                }}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        {getStatusChip(order.status)}
                        <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-on-surface-variant)]">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-headline text-xl font-bold truncate">{order.name}</h3>
                      <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
                        {order.order_items?.length || 0} prendas configuradas
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 items-start md:items-end">
                      <Link to={order.status === 'draft' ? `/cliente/pedido/${order.id}/editar?step=2` : `/cliente/pedido/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-outline-variant)]/50 bg-[var(--color-surface-container-highest)] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white">
                        {order.status === 'draft' ? 'Continuar' : 'Ver'}
                      </Link>
                      {['draft', 'confirmed', 'recibido'].includes((order.status || '').toLowerCase().trim()) && (
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="inline-flex items-center justify-center rounded-full p-2 text-[var(--color-error)] hover:bg-[var(--color-error-container)] transition-colors"
                          title="Eliminar pedido"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ClientDashboard;
