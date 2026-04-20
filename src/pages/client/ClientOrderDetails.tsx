import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

const ClientOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: globalLoading } = useAppStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mounted flag on mount
    isMountedRef.current = true;

    // If auth state finished and no user, we can't fetch but shouldn't hang
    if (!globalLoading && !user) {
      if (isMountedRef.current) {
        setLoading(false);
      }
      navigate('/login', { replace: true });
      return;
    }

    if (id && user) {
      fetchOrderDetails();
    }

    // Cleanup: mark as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, [id, user, globalLoading]);

  const fetchOrderDetails = async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client_shipping_info (*),
          order_items (
            *,
            garment_types (name),
            designs (image_url),
            sizes:order_item_sizes (size, quantity),
            persons:order_item_persons (size, person_name, person_number, role)
          )
        `)
        .eq('id', id)
        .eq('client_id', user?.id)
        .single();
        
      if (error) throw error;
      if (!data) {
        navigate('/cliente/dashboard', { replace: true });
        return;
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setOrder(data);
      }
    } catch (err: any) {
      console.error("Error loading order:", err);
      if (isMountedRef.current) {
        toast.error("No se pudo cargar el pedido.");
      }
      navigate('/cliente/dashboard', { replace: true });
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const confirmOrder = async () => {
    if (!window.confirm("¿Seguro que quieres enviar el pedido? Una vez enviado no lo podrás editar más.")) return;
    
    if (isMountedRef.current) {
      setIsConfirming(true);
    }
    const loadingToast = toast.loading('Enviando pedido...');
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', id);
        
      if (error) throw error;
      
      if (isMountedRef.current) {
        toast.success("¡Pedido enviado correctamente!", { id: loadingToast });
        setOrder({...order, status: 'confirmed'});
        // Navigate back to dashboard after 1.5s
        setTimeout(() => {
          if (isMountedRef.current) {
            navigate('/cliente/dashboard', { replace: true });
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      if (isMountedRef.current) {
        toast.error(`Error al confirmar: ${err.message || 'Intenta de nuevo'}`, { id: loadingToast });
        setIsConfirming(false);
      }
    } finally {
      if (isMountedRef.current && !isMountedRef.current) {
        setIsConfirming(false);
      }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 bg-[var(--color-surface)] min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-[var(--color-primary-container)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
    </div>
  );
  
  if (!order) return null;

  const status = (order.status || '').toLowerCase().trim();
  const isEditable = !['confirmed', 'recibido', 'in_production', 'produccion', 'producción', 'delivered', 'finalizado'].includes(status);

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6 bg-white p-8 rounded-[32px] border border-[var(--color-outline-variant)]/10 shadow-sm relative overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)] opacity-[0.03] rounded-bl-full -mr-16 -mt-16"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]">Revisión Técnica de Pedido</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              (order.status === 'draft' || order.status === 'confirmed') ? 'bg-orange-100 text-orange-700' : 
              order.status === 'in_production' ? 'bg-blue-100 text-blue-700' : 
              'bg-green-100 text-green-700'
            }`}>
              {(order.status === 'draft' || order.status === 'confirmed') ? 'En Desarrollo' : order.status === 'in_production' ? 'Produciendo' : 'Finalizado'}
            </span>
          </div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight leading-none text-[var(--color-on-surface)] uppercase">{order.name}</h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm mt-3 font-medium">Iniciado el {new Date(order.created_at).toLocaleDateString()}</p>
        </div>

        <div className="flex flex-col items-end gap-4 relative z-10">
          <img src="/src/assets/logo.png" alt="Company Logo" className="h-10 w-auto opacity-80" />
          <div className="flex gap-3">
            <Link to="/cliente/dashboard" className="btn btn-secondary text-xs h-10">
              <span className="material-symbols-outlined text-[1.1rem]">arrow_back</span>
              Dashboard
            </Link>

          </div>
        </div>
      </div>

      {/* Client Information */}
      {order.client_shipping_info && (
        <div className="bg-white rounded-3xl p-6 border border-[var(--color-outline-variant)]/20 shadow-xl shadow-gray-100/50 mb-8">
          <h2 className="font-headline text-lg font-extrabold uppercase tracking-tight mb-4">Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-bold">Nombre:</span> {order.client_shipping_info.full_name}
            </div>
            <div>
              <span className="font-bold">Teléfono:</span> {order.client_shipping_info.phone}
            </div>
            <div>
              <span className="font-bold">Correo Electrónico:</span> {order.client_shipping_info.email}
            </div>
            <div>
              <span className="font-bold">Dirección:</span> {order.client_shipping_info.shipping_address}
            </div>
            <div>
              <span className="font-bold">Courier:</span> {order.client_shipping_info.preferred_carrier}
            </div>
            <div>
              <span className="font-bold">Propósito:</span> {order.client_shipping_info.order_purpose}
            </div>
          </div>
        </div>
      )}

      {/* Main Technical Summary */}
      <div className="space-y-10">
        {order.order_items.map((item: any) => {
          const isPersonalized = item.has_personalization;
          const sizes = item.sizes || [];
          const persons = item.persons || [];
          const itemsCount = isPersonalized ? persons.length : sizes.reduce((acc: number, s: any) => acc + (s.quantity || 0), 0);
          const itemTypeName = item.garment_types?.name || 'Prenda';
          const isShorts = itemTypeName.toLowerCase().includes('pantalon') || itemTypeName.toLowerCase().includes('pantalón');

          return (
            <div key={item.id} className="bg-white rounded-3xl overflow-hidden border border-[var(--color-outline-variant)]/20 shadow-xl shadow-gray-100/50">
              {/* Card Header (Industrial Look) */}
              <div className="bg-[var(--color-surface-container-low)] p-6 border-b border-[var(--color-outline-variant)]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--color-primary)] text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-[var(--color-primary-container)]/30">
                    {itemsCount}
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-black uppercase tracking-tight">{itemTypeName}</h3>
                    <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">{item.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="text-right hidden sm:block">
                     <p className="text-[9px] font-black text-[var(--color-on-surface-variant)] uppercase tracking-widest">Estado</p>
                     <p className="text-xs font-bold text-[var(--color-primary)] uppercase">OK - REVISÓ TÉCNICO</p>
                   </div>
                   {(item.custom_design_url || item.designs?.image_url) && (
                     <div className="bg-white p-1 rounded-xl border border-[var(--color-outline-variant)]/10 shadow-sm group relative">
                       <img src={item.custom_design_url || item.designs?.image_url} alt="Ref" className="w-14 h-14 object-cover rounded-lg" />
                       <a href={item.custom_design_url || item.designs?.image_url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-white text-[10px] font-bold">VER</a>
                     </div>
                   )}
                </div>
              </div>

              <div className="p-6 md:p-8">
                {/* Secondary Specs Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8 bg-[var(--color-surface-container-lowest)] p-4 rounded-2xl border border-[var(--color-outline-variant)]/5">
                  {item.sleeve_type && item.garment_types?.name?.toLowerCase().includes('remera') && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Tipo Manga</span>
                      <p className="font-bold text-sm uppercase">{item.sleeve_type} {item.sleeve_color ? `(${item.sleeve_color})` : ''}</p>
                    </div>
                  )}
                  {item.collar_type && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Tipo Cuello</span>
                      <p className="font-bold text-sm uppercase">{item.collar_type}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Cantidad total</span>
                    <p className="font-bold text-sm uppercase">{itemsCount} prendas</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--color-outline-variant)]/10 overflow-hidden">
                  {isPersonalized ? (
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)]/10">
                        <tr>
                          <th className="p-4 font-black uppercase tracking-widest text-[9px] w-20">Talle</th>
                          {!isShorts && <th className="p-4 font-black uppercase tracking-widest text-[9px]">Nombre a Estampar</th>}
                          <th className="p-4 font-black uppercase tracking-widest text-[9px] text-center w-24">Número</th>
                          <th className="p-4 font-black uppercase tracking-widest text-[9px]">Función / Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-outline-variant)]/5">
                        {persons.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-black text-lg text-[var(--color-primary)]">{p.size}</td>
                            {!isShorts && <td className="p-4 font-extrabold uppercase text-sm tracking-tight">{p.person_name || '-'}</td>}
                            <td className="p-4 text-center font-black text-2xl font-headline italic">{p.person_number || '-'}</td>
                            <td className="p-4 text-[10px] font-bold uppercase text-[var(--color-on-surface-variant)]">{p.role || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6">
                      <p className="text-[9px] font-black text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Curva de Talles</p>
                      <div className="flex flex-wrap gap-4">
                        {sizes.filter((s: any) => s.quantity > 0).map((s: any, i: number) => (
                          <div key={i} className="bg-[var(--color-surface)] px-6 py-4 rounded-2xl border-2 border-[var(--color-outline-variant)]/10 flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-1">{s.size}</span>
                            <span className="text-3xl font-black font-headline text-[var(--color-primary)]">{s.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Notes (Optional) */}
                {item.notes && (
                  <div className="mt-8 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                    <div className="flex gap-3">
                      <span className="material-symbols-outlined text-orange-400">info</span>
                      <div>
                        <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest mb-1">Indicaciones Especiales</p>
                        <p className="text-xs font-medium text-orange-900 leading-relaxed">{item.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission CTA Block */}
      {isEditable && (
        <div className="mt-16 sticky bottom-6 z-50 animate-in slide-in-from-bottom-5 duration-700">
           <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] p-8 rounded-[40px] shadow-2xl shadow-[var(--color-primary)]/20 flex flex-col items-center gap-6 max-w-2xl mx-auto backdrop-blur-xl">
             <div className="text-center">
                <h2 className="font-headline text-3xl font-black uppercase tracking-tight text-[var(--color-primary)]">¿Todo listo?</h2>
                <p className="text-sm text-[var(--color-on-surface-variant)] mt-2 font-medium">Revisá bien los talles y nombres. No podrá haber cambios después.</p>
             </div>
             
             <div className="flex flex-col sm:flex-row gap-4 w-full">
               <button 
                onClick={confirmOrder}
                disabled={isConfirming}
                className="btn btn-primary w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-md uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
               >
                 {isConfirming ? 'Enviando...' : (
                   <>
                    Confirmar y Enviar Pedido
                    <span className="material-symbols-outlined">send</span>
                   </>
                 )}
               </button>
             </div>
           </div>
        </div>
      )}
      
      {!isEditable && (
        <div className="mt-12 p-8 bg-blue-50 border border-blue-100 rounded-[40px] text-center max-w-2xl mx-auto">
           <span className="material-symbols-outlined text-4xl text-blue-600 mb-4">verified</span>
           <h3 className="font-headline text-2xl font-black uppercase text-blue-900">Pedido Recibido</h3>
           <p className="text-blue-700 font-medium mt-2">Tu pedido ha sido bloqueado y ya se encuentra en nuestro sistema administrativo para ser procesado.</p>
        </div>
      )}
    </div>
  );
};

export default ClientOrderDetails;
