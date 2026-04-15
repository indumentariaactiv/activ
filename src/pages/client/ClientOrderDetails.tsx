import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

const ClientOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && user) fetchOrderDetails();
  }, [id, user]);

  const fetchOrderDetails = async () => {
    try {
      console.log("ClientOrderDetails - Fetching for ID:", id);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            garment_types (name),
            sizes:order_item_sizes (size, quantity),
            persons:order_item_persons (size, person_name, person_number)
          )
        `)
        .eq('id', id)
        .eq('client_id', user?.id)
        .single();
        
      if (error) {
        console.error("ClientOrderDetails - Supabase Error:", error.message, error.details);
        throw error;
      }
      
      if (!data) {
        console.warn("ClientOrderDetails - Order not found or access denied.");
        navigate('/cliente/dashboard');
        return;
      }
      
      console.log("ClientOrderDetails - Data loaded successfully");
      setOrder(data);
    } catch (err: any) {
      console.error("ClientOrderDetails - Execution Error:", err.message || err);
      if (err.code !== 'PGRST116') {
        alert("Error al cargar los detalles del pedido.");
      }
      navigate('/cliente/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 gap-4 bg-[var(--color-surface)] min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      <p className="font-headline font-bold text-[var(--color-primary)] animate-pulse uppercase tracking-widest text-xs">Cargando detalles...</p>
    </div>
  );
  
  if (!order) return null;

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-extrabold break-words">{order.name}</h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm mt-1">Pedido registrado el {new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <Link to="/cliente/dashboard" className="btn btn-secondary text-sm hidden md:flex">
          <span className="material-symbols-outlined">arrow_back</span>
          Volver al Inicio
        </Link>
      </div>

      <div className="card p-6 md:p-8 border-t-4 border-[var(--color-primary)]">
        <h3 className="font-headline text-xl font-bold mb-6 border-b border-[var(--color-outline-variant)]/20 pb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--color-primary)]">inventory_2</span>
          Desglose de Prendas
        </h3>

        <div className="space-y-6">
          {order.order_items.map((item: any) => {
             const isPersonalized = item.has_personalization;
             // Use safety fallbacks and aliases correctly
             const sizes = item.sizes || [];
             const persons = item.persons || [];
             const itemsCount = isPersonalized ? persons.length : sizes.reduce((acc: number, s: any) => acc + (s.quantity || 0), 0);
             const itemTypeName = item.garment_types?.name || item.garment_type_name || 'Prenda';

             return (
               <div key={item.id} className="card p-5 border border-[var(--color-outline-variant)]/20 shadow-none bg-[var(--color-surface-container-low)]">
                  <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <p className="font-bold font-headline text-lg uppercase tracking-tight">{itemTypeName}</p>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface)] bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/30 px-2 py-1 rounded inline-block mt-1 shadow-sm">{item.category}</span>
                    </div>

                    {item.custom_design_url && (
                      <div className="flex flex-col items-center gap-1 bg-white p-1 rounded-lg shadow-sm border border-[var(--color-outline-variant)]/10">
                        <img src={item.custom_design_url} alt="Diseño Adjunto" className="w-16 h-16 object-cover rounded" />
                        <a href={item.custom_design_url} target="_blank" rel="noreferrer" className="text-[9px] text-[var(--color-primary)] font-bold hover:underline mb-1">
                          Ver Original
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-outline-variant)]/10 mb-4">
                    <div>
                       <p className="text-[var(--color-on-surface-variant)] mb-0.5 uppercase tracking-wider font-bold text-[9px]">Color Base</p>
                       <p className="font-bold">{item.base_color || '-'}</p>
                    </div>
                    {item.sleeve_type && item.sleeve_type !== 'Sin Mangas' && (
                       <div>
                         <p className="text-[var(--color-on-surface-variant)] mb-0.5 uppercase tracking-wider font-bold text-[9px]">Mangas</p>
                         <p className="font-bold">{item.sleeve_type} {item.sleeve_color ? `(${item.sleeve_color})` : ''}</p>
                       </div>
                    )}
                    <div>
                       <p className="text-[var(--color-on-surface-variant)] mb-0.5 uppercase tracking-wider font-bold text-[9px]">Cant. Total</p>
                       <p className="font-bold text-[var(--color-primary)]">{itemsCount} unidades</p>
                    </div>
                  </div>

                  <div>
                     <h5 className="font-bold text-xs uppercase text-[var(--color-on-surface-variant)] tracking-widest mb-2 border-b border-[var(--color-outline-variant)]/10 pb-1">
                       {isPersonalized ? 'Plantel Personalizado' : 'Distribución de Talles'}
                     </h5>
                     
                     {isPersonalized ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs bg-white rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/10">
                            <thead className="bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)]">
                              <tr>
                                <th className="p-2 font-bold uppercase tracking-wider">Talle</th>
                                <th className="p-2 font-bold uppercase tracking-wider">Nombre</th>
                                <th className="p-2 font-bold uppercase tracking-wider text-right pr-4">Nº</th>
                              </tr>
                            </thead>
                            <tbody>
                              {persons.map((p: any, i: number) => (
                                <tr key={i} className="border-b border-[var(--color-outline-variant)]/5 last:border-0 hover:bg-[var(--color-primary-container)]/5 transition-colors">
                                  <td className="p-2 font-black font-headline text-md text-[var(--color-primary)] w-16">{p.size}</td>
                                  <td className="p-2 font-semibold uppercase">{p.person_name}</td>
                                  <td className="p-2 text-right font-black text-lg pr-4 text-[var(--color-on-surface)]">{p.person_number || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                     ) : (
                        <div className="flex flex-wrap gap-2">
                           {sizes.filter((s: any) => s.quantity > 0).map((s: any, i: number) => (
                             <div key={i} className="bg-white px-4 py-2 rounded-xl text-xs border border-[var(--color-outline-variant)]/20 shadow-sm flex flex-col items-center min-w-[50px]">
                               <span className="text-[9px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest mb-1">{s.size}</span>
                               <span className="text-lg font-headline font-black text-[var(--color-primary)]">{s.quantity}</span>
                             </div>
                           ))}
                        </div>
                     )}
                  </div>

                  {item.notes && (
                     <div className="mt-4 pt-4 border-t border-[var(--color-outline-variant)]/10 text-left">
                        <p className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-[0.2em] mb-1">Observaciones / Pedido Especial</p>
                        <p className="text-[11px] font-headline font-semibold text-[var(--color-on-surface)] leading-relaxed">{item.notes}</p>
                     </div>
                  )}
               </div>
             );
          })}
        </div>
      </div>
      
      <div className="mt-6 flex justify-center md:hidden">
         <Link to="/cliente/dashboard" className="btn btn-secondary w-full">Volver al Inicio</Link>
      </div>
    </div>
  );
};

export default ClientOrderDetails;
