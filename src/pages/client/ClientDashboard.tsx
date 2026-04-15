import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

const ClientDashboard = () => {
  const { profile, user, isLoading: globalLoading } = useAppStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If global loading is done and we have no user, we won't be fetching anything
    if (!globalLoading && !user) {
      setLoading(false);
      return;
    }

    if (user) {
      fetchOrders();
    }
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
      setOrders(data || []);
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      // alert is annoying if it's a silent transient error, using console first
    } finally {
      setLoading(false);
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
        <div className="flex flex-col gap-4">
          {orders.map(order => (
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
                
                <button 
                  onClick={() => deleteOrder(order.id)}
                  className="p-2 text-[var(--color-error)] hover:bg-[var(--color-error-container)] rounded-full transition-colors"
                  title="Eliminar pedido"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default ClientDashboard;
