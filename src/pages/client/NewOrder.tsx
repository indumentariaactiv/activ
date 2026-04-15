import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GarmentForm } from '../../components/orders/GarmentForm';
import type { GarmentData } from '../../components/orders/GarmentForm';

const NewOrder = () => {
  const [step, setStep] = useState(1);
  const [orderName, setOrderName] = useState('');
  const [orderItems, setOrderItems] = useState<GarmentData[]>([]);
  const [showGarmentForm, setShowGarmentForm] = useState(false);
  const [editingGarment, setEditingGarment] = useState<GarmentData | null>(null);
  const [loading, setLoading] = useState(false);
   const navigate = useNavigate();
   const { id } = useParams<{ id: string }>();

   useEffect(() => {
     if (id) fetchExistingOrder();
   }, [id]);

   const fetchExistingOrder = async () => {
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('orders')
         .select(`
           *,
           order_items (
             *,
             garment_types (name),
             order_item_sizes (*),
             order_item_persons (*)
           )
         `)
         .eq('id', id)
         .single();

       if (error) throw error;
       if (data) {
         // IMPORTANT: If the order is already confirmed or further, redirect to view-only mode
         if (data.status !== 'pending') {
           navigate(`/cliente/pedido/${id}`);
           return;
         }

         setOrderName(data.name);
         const mappedItems: GarmentData[] = data.order_items.map((item: any) => ({
           id: item.id,
           garment_type_id: item.garment_type_id,
           garment_type_name: item.garment_types.name,
           category: item.category,
           base_color: item.base_color,
           sleeve_type: item.sleeve_type,
           sleeve_color: item.sleeve_color,
           fabric_type: item.fabric_type,
           collar_type: item.collar_type,
           armhole_color: item.armhole_color,
           has_personalization: item.has_personalization,
           design_id: item.design_id,
           custom_design_url: item.custom_design_url,
           observations: item.notes || '',
           sizes: item.order_item_sizes.map((s: any) => ({ size: s.size, quantity: s.quantity })),
           persons: item.order_item_persons.map((p: any) => ({ 
             id: p.id, 
             size: p.size, 
             name: p.person_name, 
             number: p.person_number,
             role: p.role
           }))
         }));
         setOrderItems(mappedItems);
       }
     } catch (err) {
       console.error("Error fetching order for edit:", err);
     } finally {
       setLoading(false);
     }
   };

  // Temporary dummy handlers
  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmitOrder = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Sesión no encontrada");

      // 1. Create or Update the Order
      let orderData: any;
      if (id) {
        const { data: updateData, error: updateError } = await supabase
          .from('orders')
          .update({ name: orderName })
          .eq('id', id)
          .select()
          .single();
        if (updateError) throw updateError;
        orderData = updateData;
        
        // Clean up existing items to re-insert them (standard for draft editing)
        await supabase.from('order_items').delete().eq('order_id', id);
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('orders')
          .insert({
            client_id: authUser.id,
            name: orderName,
            status: 'draft'
          })
          .select()
          .single();
        if (insertError) throw insertError;
        orderData = insertData;
      }

      // 2. Insert Items sequentially to ensure references (allowed because order is draft)
      for (const item of orderItems) {
        const { data: itemData, error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderData.id,
            garment_type_id: item.garment_type_id,
            category: item.category,
            base_color: item.base_color,
            sleeve_type: item.sleeve_type,
            sleeve_color: item.sleeve_color,
            fabric_type: item.fabric_type,
            collar_type: item.collar_type,
            armhole_color: item.armhole_color,
            design_id: item.design_id,
            custom_design_url: item.custom_design_url,
            has_personalization: item.has_personalization,
            notes: item.observations
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // 3. Insert Sizes OR Persons
        if (item.has_personalization && item.persons.length > 0) {
          const personsToInsert = item.persons.map(p => ({
            order_item_id: itemData.id,
            size: p.size,
            person_name: p.name,
            person_number: p.number,
            role: p.role
          }));
          await supabase.from('order_item_persons').insert(personsToInsert);
        } else if (!item.has_personalization && item.sizes.length > 0) {
          const sizesToInsert = item.sizes
            .filter(s => s.quantity > 0)
            .map(s => ({
              order_item_id: itemData.id,
              size: s.size,
              quantity: s.quantity
            }));
          if (sizesToInsert.length > 0) {
            await supabase.from('order_item_sizes').insert(sizesToInsert);
          }
        }
      }

      // 4. Update Order to Confirmed
      const { error: finalError } = await supabase.from('orders').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      }).eq('id', orderData.id);

      if (finalError) throw finalError;

      // Success
      navigate('/cliente/dashboard');
    } catch (error: any) {
      console.error("Error detallado al guardar:", error);
      alert(`Error al guardar: ${error.message || "Verifica la consola para más detalles."}`);
    } finally {
      setLoading(false);
    }
  };

  const createDraftOrder = async () => {
    setLoading(true);
    setLoading(false);
    handleNext();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="mb-10 text-center">
        <p className="font-headline text-[var(--color-primary)] font-extrabold tracking-tighter uppercase text-sm mb-2">
          Paso {step} de 3
        </p>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
          {step === 1 && 'Información General'}
          {step === 2 && 'Agregar Prendas'}
          {step === 3 && 'Resumen Final'}
        </h1>
      </div>

      <div className="card p-6 md:p-10 mb-8">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                Nombre del Pedido
              </label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ej: Club Atlético Norte — Temporada 2025" 
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-[var(--color-on-surface-variant)]">Este nombre te ayudará a identificar el pedido en tu panel y exportaciones.</p>
            </div>
            
            <div className="flex justify-end mt-4">
              <button 
                onClick={createDraftOrder} 
                disabled={orderName.trim().length === 0 || loading}
                className="btn btn-primary"
              >
                Siguiente
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            {showGarmentForm ? (
              <GarmentForm 
                initialData={editingGarment || undefined}
                onSave={(data) => {
                  setOrderItems(prev => {
                    const exists = prev.find(p => p.id === data.id);
                    if (exists) return prev.map(p => p.id === data.id ? data : p);
                    return [...prev, data];
                  });
                  setShowGarmentForm(false);
                  setEditingGarment(null);
                }} 
                onCancel={() => { setShowGarmentForm(false); setEditingGarment(null); }} 
              />
            ) : (
              <>
                {orderItems.length === 0 ? (
                  <div className="text-center py-10 bg-[var(--color-surface-container-low)] rounded-xl border border-dashed border-[var(--color-outline-variant)]">
                    <span className="material-symbols-outlined mx-auto text-5xl text-[var(--color-outline-variant)]">apparel</span>
                    <p className="font-bold">Aún no hay prendas en este pedido.</p>
                    <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Agrega remeras, shorts o cualquier indumentaria necesaria para este pedido.</p>
                    
                    <button onClick={() => setShowGarmentForm(true)} className="btn btn-secondary mx-auto">
                      <span className="material-symbols-outlined text-[1.2rem]">add</span>
                      Agregar Prenda
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold">Prendas en el Pedido ({orderItems.length})</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {orderItems.map((item) => {
                        const totalUnits = item.has_personalization 
                          ? item.persons.length 
                          : item.sizes.reduce((acc, curr) => acc + curr.quantity, 0);

                        return (
                          <div key={item.id} className="flex justify-between items-center bg-[var(--color-surface-container-lowest)] p-4 rounded-xl border border-[var(--color-outline-variant)]/20 shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[var(--color-surface-container-high)] rounded-lg flex items-center justify-center text-[var(--color-on-surface-variant)]">
                                <span className="material-symbols-outlined">style</span>
                              </div>
                              <div>
                                <p className="font-bold">{item.garment_type_name}</p>
                                <p className="text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-widest">{item.category}</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center justify-end gap-3">
                              <p className="font-headline font-black text-xl text-[var(--color-primary)]">{totalUnits} <span className="text-xs font-body font-normal text-[var(--color-on-surface-variant)]">uni</span></p>
                              <button onClick={() => { setEditingGarment(item); setShowGarmentForm(true); }} className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors p-2">
                                <span className="material-symbols-outlined text-[1.2rem]">edit</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-4 flex justify-center">
                      <button onClick={() => setShowGarmentForm(true)} className="btn btn-tertiary">
                        <span className="material-symbols-outlined">add</span>
                        Agregar Otra Prenda
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between mt-8 pt-6 border-t border-[var(--color-outline-variant)]/20">
                  <button onClick={handlePrev} className="btn btn-tertiary">Atrás</button>
                  <button onClick={handleNext} disabled={orderItems.length === 0} className="btn btn-primary">
                    Resumen Final
                    <span className="material-symbols-outlined flex">arrow_forward</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div className="bg-[var(--color-surface-container-high)] p-4 rounded-lg text-center mb-6">
              <p className="font-bold text-[var(--color-tertiary)] flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                Revisión Final
              </p>
              <p className="text-sm mt-1">Este pedido se va a producir exactamente como está cargado. Revisá bien las cantidades, talles y diseños antes de confirmar.</p>
            </div>

            <div className="flex justify-between items-center border-b border-[var(--color-outline-variant)]/20 pb-4 mb-4">
              <h3 className="font-bold text-xl">Pedido: {orderName}</h3>
              <span className="status-chip ready">Listo para Confirmar</span>
            </div>

            <div className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="card p-0 overflow-hidden border border-[var(--color-outline-variant)]/20 shadow-none">
                  <div className="flex flex-col md:flex-row">
                    {/* Image Section - STANDARDIZED WITH ADMIN VIEW */}
                    <div className="w-full md:w-[150px] bg-[var(--color-surface-container-low)] flex flex-col items-center justify-center p-4 border-b md:border-b-0 md:border-r border-[var(--color-outline-variant)]/20">
                      {(item.custom_design_url || item.design_image_url) ? (
                        <>
                          <img 
                            src={item.custom_design_url || item.design_image_url} 
                            alt="Diseño Seleccionado" 
                            className="w-24 aspect-[4/5] object-contain rounded-xl shadow-lg border border-white/50 bg-white" 
                          />
                          <a href={item.custom_design_url || item.design_image_url} target="_blank" rel="noreferrer" className="mt-3 text-[10px] text-[var(--color-primary)] font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                            Ver Diseño <span className="material-symbols-outlined text-[0.8rem]">open_in_new</span>
                          </a>
                        </>
                      ) : (
                        <div className="w-24 aspect-[4/5] bg-[var(--color-surface-container-high)] rounded-xl flex flex-col items-center justify-center text-[var(--color-on-surface-variant)] border-2 border-dashed border-[var(--color-outline-variant)]/20 px-2 text-center">
                          <span className="material-symbols-outlined text-2xl mb-1">style</span>
                          <span className="text-[8px] font-black uppercase tracking-tighter">Sin Diseño Seleccionado</span>
                        </div>
                      )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 p-6">
                      <div className="mb-6">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-headline text-2xl font-black text-[var(--color-on-surface)]">{item.garment_type_name}</h4>
                          <span className="text-sm font-bold text-[var(--color-on-surface-variant)]">—</span>
                          <span className="text-sm font-black uppercase tracking-widest text-[var(--color-primary)]">{item.category}</span>
                          {item.sleeve_type && (
                            <>
                              <span className="text-sm font-bold text-[var(--color-on-surface-variant)]">—</span>
                              <span className="text-sm font-bold text-[var(--color-on-surface-variant)]">{item.sleeve_type}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-on-surface-variant)] font-medium">Configuración técnica seleccionada para esta prenda.</p>
                      </div>

                      <div className="bg-[var(--color-surface-container-lowest)] rounded-2xl border border-[var(--color-outline-variant)]/10 overflow-hidden">
                        {item.has_personalization ? (
                           <div className="p-4">
                             <div className="flex items-center justify-between mb-3 border-b border-[var(--color-outline-variant)]/10 pb-2">
                               <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Detalle Individual</p>
                               <span className="text-xs font-black text-[var(--color-primary)]">{item.persons.length} UNI</span>
                             </div>
                             <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                               {item.persons.map((p, pIdx) => (
                                 <div key={pIdx} className="bg-[var(--color-surface-container-high)] px-3 py-1.5 rounded-lg text-xs leading-none flex items-center gap-2 border border-[var(--color-outline-variant)]/5">
                                   <span className="font-headline font-black text-[var(--color-primary)]">{p.size}</span>
                                   <span className="font-bold">{p.name}</span>
                                   {p.number && <span className="opacity-50">#{p.number}</span>}
                                   {p.role && <span className="bg-[var(--color-primary-container)] text-[var(--color-primary)] text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{p.role}</span>}
                                 </div>
                               ))}
                             </div>
                           </div>
                        ) : (
                           <div className="p-4">
                             <div className="flex items-center justify-between mb-3 border-b border-[var(--color-outline-variant)]/10 pb-2">
                               <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Cantidades por Talle</p>
                               <span className="text-xs font-black text-[var(--color-primary)]">{item.sizes.reduce((a,c)=>a+c.quantity, 0)} UNI</span>
                             </div>
                             <div className="flex flex-wrap gap-3">
                               {item.sizes.filter(s => s.quantity > 0).map((s, sIdx) => (
                                 <div key={sIdx} className="bg-[var(--color-surface-container-highest)] px-4 py-2 rounded-xl flex flex-col items-center min-w-[50px] border border-[var(--color-outline-variant)]/10 shadow-sm">
                                   <span className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest mb-1">{s.size}</span>
                                   <span className="text-lg font-headline font-black text-[var(--color-primary)]">{s.quantity}</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                        )}
                      </div>

                      {item.observations && (
                        <div className="mt-4 pt-4 border-t border-[var(--color-outline-variant)]/10">
                           <p className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-[0.2em] mb-1">Observaciones / Pedido Especial</p>
                           <p className="text-[11px] font-headline font-semibold text-[var(--color-on-surface)] leading-relaxed">{item.observations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={handlePrev} disabled={loading} className="btn btn-tertiary">Volver a Prendas</button>
              <button 
                onClick={handleSubmitOrder} 
                disabled={loading}
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, #00c06a, #00a05a)' }}
              >
                {loading ? 'Confirmando...' : (
                  <>
                    <span className="material-symbols-outlined text-white">check_circle</span>
                    Confirmar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewOrder;
