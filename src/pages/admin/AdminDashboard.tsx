import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AdminDashboard = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'delivered'>('active');

  useEffect(() => {
    fetchGlobalOrders();
  }, []);

  const fetchGlobalOrders = async () => {
    try {
      // Fetch orders and join with profiles to get client info
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (name, team_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error("Error fetching admin orders:", err);
      // We don't alert here to avoid blocking, just show error in UI
    } finally {
      setLoading(false);
    }
  };


  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'confirmed': return 'Recibido';
      case 'in_production': return 'Producción';
      case 'delivered': return 'Finalizado';
      default: return status;
    }
  };

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-50 text-gray-600 border-gray-200';
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
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('active')}
              className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'active' ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'}`}
            >
              En Curso / Activos
              {activeTab === 'active' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--color-primary)] rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('delivered')}
              className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'delivered' ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'}`}
            >
              Finalizados / Entregados
              {activeTab === 'delivered' && <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--color-primary)] rounded-t-full"></div>}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--color-surface-container-lowest)] border-b border-[var(--color-outline-variant)]/10">
                <th className="p-4 font-label text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-black">Cliente / Equipo</th>
                <th className="p-4 font-label text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-black">Pedido</th>
                <th className="p-4 font-label text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-black">Fecha</th>
                <th className="p-4 font-label text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-black">Estado Actual</th>
                <th className="p-4 font-label text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] font-black text-right">Acción Recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-surface-container-low)]">
              {loading ? (
                <tr><td colSpan={5} className="p-12 text-center">
                    <div className="w-8 h-8 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-2"></div>
                    <span className="font-bold text-xs uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cargando datos...</span>
                </td></tr>
              ) : orders.filter(o => activeTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered').length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-[var(--color-on-surface-variant)]">No existen pedidos en esta categoría.</td></tr>
              ) : (
                orders
                  .filter(o => activeTab === 'active' ? o.status !== 'delivered' : o.status === 'delivered')
                  .map((o) => (
                  <tr key={o.id} className="hover:bg-[var(--color-surface-container-lowest)] transition-colors group">
                    <td className="p-4">
                      <p className="font-bold text-sm group-hover:text-[var(--color-primary)] transition-colors">{o.profiles?.team_name || o.profiles?.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">{o.profiles?.team_name ? o.profiles.name : 'Individual'}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-sm">{o.name}</p>
                      <p className="text-[9px] text-[var(--color-on-surface-variant)] truncate max-w-[150px]">ID: {o.id.split('-')[0]}...</p>
                    </td>
                    <td className="p-4 text-xs font-semibold text-[var(--color-on-surface-variant)]">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusChipClass(o.status)} ${o.status === 'confirmed' ? 'animate-pulse-received !bg-blue-600 !text-white !border-transparent' : ''}`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-50 ${o.status === 'confirmed' ? 'hidden' : ''}`}></span>
                        {o.status === 'confirmed' ? 'NUEVO PEDIDO' : getStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link to={`/admin/pedido/${o.id}`} className="btn btn-tertiary px-4 py-2 text-xs border border-[var(--color-outline-variant)]/30 hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all">
                        {o.status === 'confirmed' ? (
                            <>
                                <span className="material-symbols-outlined text-[1.1rem]">edit_note</span>
                                Cargar Ficha Técnica
                            </>
                        ) : o.status === 'in_production' ? (
                            <>
                                <span className="material-symbols-outlined text-[1.1rem]">print</span>
                                Ver & Imprimir
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[1.1rem]">visibility</span>
                                Ver Detalles
                            </>
                        )}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
