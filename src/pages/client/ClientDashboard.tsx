import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

const ClientDashboard = () => {
  const { profile, user, isLoading: globalLoading } = useAppStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'production' | 'delivered'>('pending');
  const isMountedRef = useRef(true);

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
    // Reset mounted flag on mount
    isMountedRef.current = true;

    // If global loading is done and we have no user, we won't be fetching anything
    if (!globalLoading && !user) {
      if (isMountedRef.current) {
        setLoading(false);
      }
      return;
    }

    if (user) {
      fetchOrders();
    }

    // Cleanup: mark as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, [user, globalLoading]);

  const fetchOrders = async () => {
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
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setOrders(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      // alert is annoying if it's a silent transient error, using console first
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este pedido?')) return;
    
    try {
      const { error, count } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('id', orderId);

      if (error) throw error;
      
      // If no rows were affected, it means RLS blocked it or order doesn't exist
      if (count === 0) {
        alert('No tienes permiso para eliminar este pedido (puede que ya esté confirmado o en producción).');
        return;
      }

      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || 'Inténtalo de nuevo.'}`);
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
          <div className="flex flex-wrap gap-2 md:gap-4 border-b border-[var(--color-outline-variant)]/20 pb-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-bold text-sm uppercase tracking-wide border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              Borradores y Pendientes
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`px-4 py-2 font-bold text-sm uppercase tracking-wide border-b-2 transition-colors ${
                activeTab === 'production'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              En Producción
            </button>
            <button
              onClick={() => setActiveTab('delivered')}
              className={`px-4 py-2 font-bold text-sm uppercase tracking-wide border-b-2 transition-colors ${
                activeTab === 'delivered'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              }`}
            >
              Historial (Entregados)
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-[var(--color-surface-container-low)] rounded-2xl border border-dashed border-[var(--color-outline-variant)]">
               <span className="material-symbols-outlined text-4xl text-[var(--color-outline-variant)] mb-2">inbox</span>
               <p className="font-bold text-[var(--color-on-surface-variant)]">No hay pedidos en esta sección.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="card p-4 md:p-6 flex flex-row items-center justify-between hover:shadow-md transition-all border-l-4" style={{ 
                  borderLeftColor: order.status === 'confirmed' ? '#00c06a' : 
                                  order.status === 'in_production' ? 'var(--color-primary)' : 
                                  'var(--color-outline-variant)' 
                }}>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusChip(order.status)}
                      <span className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-headline text-lg md:text-xl font-bold truncate">{order.name}</h3>
                    <p className="text-[var(--color-on-surface-variant)] text-xs md:text-sm">
                      {order.order_items?.length || 0} prendas configuradas
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <Link to={order.status === 'draft' ? `/cliente/pedido/${order.id}/editar` : `/cliente/pedido/${order.id}`} className="btn px-3 py-1.5 md:px-4 text-xs bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] font-bold">
                      {order.status === 'draft' ? 'Continuar' : 'Ver'}
                    </Link>
                    
                    {['draft', 'confirmed', 'recibido'].includes((order.status || '').toLowerCase().trim()) && (
                      <button 
                        onClick={() => deleteOrder(order.id)}
                        className="p-2 text-[var(--color-error)] hover:bg-[var(--color-error-container)] rounded-full transition-colors"
                        title="Eliminar pedido"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
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
