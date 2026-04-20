import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { GarmentForm } from '../../components/orders/GarmentForm';
import type { GarmentData } from '../../components/orders/GarmentForm';
import toast from 'react-hot-toast';

const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const KIDS_SIZES = ['4', '6', '8', '10', '12', '14', '16'];
const UNISEX_PANTALON_SIZES = [...KIDS_SIZES, ...STANDARD_SIZES];

const GARMENT_TYPE_FALLBACKS = [
  { id: 'rem-0001', name: 'Remeras', categories: { Hombre: STANDARD_SIZES, Mujer: STANDARD_SIZES, Niño: KIDS_SIZES } },
  { id: 'short-0002', name: 'Short', categories: { Hombre: STANDARD_SIZES, Mujer: STANDARD_SIZES, Niño: KIDS_SIZES } },
  { id: 'musculosa-0003', name: 'Musculosas', categories: { Hombre: STANDARD_SIZES, Mujer: STANDARD_SIZES } },
  { id: 'campera-0004', name: 'Camperas', categories: { Hombre: STANDARD_SIZES, Mujer: STANDARD_SIZES, Niño: KIDS_SIZES } },
  { id: 'buzo-0005', name: 'Buzos', categories: { Hombre: STANDARD_SIZES, Mujer: STANDARD_SIZES, Niño: KIDS_SIZES } },
  { id: 'pantalon-0006', name: 'Pantalón Largo', categories: { Unisex: UNISEX_PANTALON_SIZES } },
  { id: 'bandera-0007', name: 'Bandera', categories: { Cantidad: ['Cantidad'] } },
  { id: 'bolso-deportivo-0008', name: 'Bolso Deportivo', categories: { Cantidad: ['Cantidad'] } },
  { id: 'bolso-paletero-0009', name: 'Bolso Paletero', categories: { Cantidad: ['Cantidad'] } },
  { id: 'botinero-0010', name: 'Botinero', categories: { Cantidad: ['Cantidad'] } }
];

const resolveTypeTemplate = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes('remera')) return GARMENT_TYPE_FALLBACKS[0];
  if (key.includes('short')) return GARMENT_TYPE_FALLBACKS[1];
  if (key.includes('musculosa')) return GARMENT_TYPE_FALLBACKS[2];
  if (key.includes('campera')) return GARMENT_TYPE_FALLBACKS[3];
  if (key.includes('buzo')) return GARMENT_TYPE_FALLBACKS[4];
  if (key.includes('pantal')) return GARMENT_TYPE_FALLBACKS[5];
  if (key.includes('bandera')) return GARMENT_TYPE_FALLBACKS[6];
  if (key.includes('paletero')) return GARMENT_TYPE_FALLBACKS[8];
  if (key.includes('botinero')) return GARMENT_TYPE_FALLBACKS[9];
  if (key.includes('bolso') && key.includes('deportivo')) return GARMENT_TYPE_FALLBACKS[7];
  return GARMENT_TYPE_FALLBACKS.find(item => key.includes(item.name.toLowerCase())) || GARMENT_TYPE_FALLBACKS[0];
};

const NewOrder = () => {
  const [step, setStep] = useState(1);
  const [orderName, setOrderName] = useState('');
  const [orderItems, setOrderItems] = useState<GarmentData[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [preferredCarrier, setPreferredCarrier] = useState('');
  const [orderPurpose, setOrderPurpose] = useState('');
  const [showGarmentForm, setShowGarmentForm] = useState(false);
  const [editingGarment, setEditingGarment] = useState<GarmentData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const SHIPPING_CARRIERS = ['OCA', 'Andreani', 'Via Cargo'];
  const ORDER_PURPOSES = ['Deporte', 'Basquet', 'Tenis', 'Padel', 'Voley', 'Egresados Primaria', 'Egresados Secundaria', 'Grupos', 'Peñas'];
  
  // Maestros globales para el formulario
  const [garmentTypes, setGarmentTypes] = useState<any[]>([]);

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mounted flag on mount
    isMountedRef.current = true;
    
    fetchMaestros();
    if (id) fetchExistingOrder();

    // Cleanup: mark as unmounted
    return () => {
      isMountedRef.current = false;
    };
  }, [id]);

  const fetchMaestros = async () => {
    try {
      // 1. Fetch Garment Types
      const { data: gData } = await supabase
        .from('garment_types')
        .select('*')
        .order('name');
      
      if (gData && gData.length > 0) {
        const updatedGData = gData.map(g => {
          const template = resolveTypeTemplate(g.name || '');
          return {
            ...g,
            name: template?.name || g.name,
            categories: template?.categories || g.categories || {},
          };
        });
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setGarmentTypes(updatedGData);
        }
      } else {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setGarmentTypes(GARMENT_TYPE_FALLBACKS);
        }
      }
    } catch (err: any) {
      console.error("Error fetching masters:", err);
      if (isMountedRef.current) {
        toast.error('No se pudieron cargar los tipos de prendas. Usando valores por defecto.');
        setGarmentTypes(GARMENT_TYPE_FALLBACKS);
      }
    }
  };

   const fetchExistingOrder = async () => {
     if (isMountedRef.current) {
       setLoading(true);
     }
     try {
       const { data, error } = await supabase
         .from('orders')
         .select(`
           *,
           client_shipping_info (*),
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
         const status = (data.status || '').toLowerCase().trim();
         const LOCKED_STATUSES = ['confirmed', 'recibido', 'in_production', 'produccion', 'producción', 'delivered', 'finalizado'];
         
         if (LOCKED_STATUSES.includes(status)) {
           if (isMountedRef.current) {
             toast.error(`Pedido bloqueado para edición (Estado: ${data.status})`);
           }
           navigate(`/cliente/pedido/${id}`, { replace: true });
           return;
         }

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

         const shippingInfo = data.client_shipping_info?.[0] || {};
         
         // Only update state if component is still mounted
         if (isMountedRef.current) {
           setOrderName(data.name);
           setFullName(shippingInfo.full_name || '');
           setPhone(shippingInfo.phone || '');
           setEmail(shippingInfo.email || '');
           setShippingAddress(shippingInfo.shipping_address || '');
           setPreferredCarrier(shippingInfo.preferred_carrier || '');
           setOrderPurpose(shippingInfo.order_purpose || '');
           setOrderItems(mappedItems);
           const missingShipping = !shippingInfo.full_name || !shippingInfo.phone || !shippingInfo.email || !shippingInfo.shipping_address || !shippingInfo.preferred_carrier || !shippingInfo.order_purpose;
           const queryStep = searchParams.get('step');
           if (queryStep === '2') {
             setStep(2);
           } else {
             setStep(missingShipping ? 1 : 2);
           }
         }
       }
     } catch (err: any) {
       console.error("Error fetching order for edit:", err);
       if (isMountedRef.current) {
         toast.error("No se pudo cargar el pedido para editar.");
       }
       navigate('/cliente/dashboard', { replace: true });
     } finally {
       // Only update state if component is still mounted
       if (isMountedRef.current) {
         setLoading(false);
       }
     }
   };

  // Temporary dummy handlers
  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleSubmitOrder = async () => {
    if (!orderName.trim() || !fullName.trim() || !phone.trim() || !email.trim() || !shippingAddress.trim() || !preferredCarrier.trim() || !orderPurpose.trim()) {
      toast.error('Completa todos los datos personales del pedido antes de guardar.');
      setStep(1);
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Guardando pedido...');
    
    try {
    // Usar getSession() en lugar de getUser() para evitar llamadas a red que pueden colgar
    const { data: { session } } = await supabase.auth.getSession();
    const authUser = session?.user;
    if (!authUser) throw new Error("Sesión no encontrada. Por favor, recargá la página.");

      // 1. Create or Update the Order
      let orderData: any;
      if (id) {
        const { data: updateData, error: updateError } = await supabase
          .from('orders')
          .update({ 
            name: orderName,
            status: 'draft' // Promote legacy 'pending' to 'draft' standard
          })
          .eq('id', id)
          .select()
          .single();
        if (updateError) throw updateError;
        orderData = updateData;
        
        // Update or insert shipping info for the existing order
        const { error: shippingError } = await supabase
          .from('client_shipping_info')
          .upsert({
            order_id: orderData.id,
            client_id: authUser.id,
            full_name: fullName,
            phone,
            email,
            shipping_address: shippingAddress,
            preferred_carrier: preferredCarrier,
            order_purpose: orderPurpose
          }, { onConflict: 'order_id' });
        if (shippingError) throw shippingError;
        
        // Clean up existing items to re-insert them (standard for draft editing)
        await supabase.from('order_items').delete().eq('order_id', id);
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('orders')
          .insert({
            client_id: authUser.id,
            name: orderName,
            status: 'draft' // Standard draft status
          })
          .select()
          .single();
        if (insertError) throw insertError;
        orderData = insertData;

        const { error: shippingError } = await supabase
          .from('client_shipping_info')
          .insert({
            order_id: orderData.id,
            client_id: authUser.id,
            full_name: fullName,
            phone,
            email,
            shipping_address: shippingAddress,
            preferred_carrier: preferredCarrier,
            order_purpose: orderPurpose
          });
        if (shippingError) throw shippingError;
      }

      // 2. Group items by fabric type respecting ficha rules:
      // - Remera + Short misma tela → 1 ficha
      // - Remera + Short distinta tela → 2 fichas
      // - Remera + Campera → siempre 2 fichas (Campera en ficha separada)
      
      interface FabricGroupDef {
        id: number;
        fabric: string;
        garmentTypes: string[];
      }

      const fabricGroups: FabricGroupDef[] = [];
      const itemsWithFabricGroup: any[] = [];

      for (const item of orderItems) {
        const typeName = item.garment_type_name?.toLowerCase() || '';
        const isCampera = typeName.includes('campera');
        const isRemera = typeName.includes('remera');
        const isShort = typeName.includes('short');
        const isMusculosa = typeName.includes('musculosa');
        const fabricKey = item.fabric_type || 'sin-tela';

        // Regla: Campera siempre va en ficha separada
        if (isCampera) {
          const newGroupId = fabricGroups.length + 1;
          fabricGroups.push({ id: newGroupId, fabric: fabricKey, garmentTypes: ['Campera'] });
          itemsWithFabricGroup.push({ ...item, fabric_group: newGroupId });
        } 
        // Regla: Remera + Short pueden compartir ficha si tienen misma tela
        else if (isRemera || isShort || isMusculosa) {
          let existingGroup = fabricGroups.find(
            g => g.fabric === fabricKey && !g.garmentTypes.includes('Campera')
          );
          if (existingGroup) {
            itemsWithFabricGroup.push({ ...item, fabric_group: existingGroup.id });
          } else {
            const newGroupId = fabricGroups.length + 1;
            fabricGroups.push({ id: newGroupId, fabric: fabricKey, garmentTypes: [typeName] });
            itemsWithFabricGroup.push({ ...item, fabric_group: newGroupId });
          }
        } 
        // Para otras prendas: agrupar por tela
        else {
          let existingGroup = fabricGroups.find(g => g.fabric === fabricKey);
          if (existingGroup) {
            itemsWithFabricGroup.push({ ...item, fabric_group: existingGroup.id });
          } else {
            const newGroupId = fabricGroups.length + 1;
            fabricGroups.push({ id: newGroupId, fabric: fabricKey, garmentTypes: [typeName] });
            itemsWithFabricGroup.push({ ...item, fabric_group: newGroupId });
          }
        }
      }

      // 3. Insert items sequentially with correct fabric_group assignment
      for (const item of itemsWithFabricGroup) {
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
              notes: item.observations,
              fabric_group: item.fabric_group // Use the calculated fabric_group
            })
            .select()
            .single();

          if (itemError) throw itemError;

          // 4. Insert Sizes OR Persons
          if (item.has_personalization && item.persons.length > 0) {
            const personsToInsert = item.persons.map((p: any) => ({
              order_item_id: itemData.id,
              size: p.size,
              person_name: p.name,
              person_number: p.number,
              role: p.role
            }));
            await supabase.from('order_item_persons').insert(personsToInsert);
          } else if (!item.has_personalization && item.sizes.length > 0) {
            const sizesToInsert = item.sizes
              .filter((s: any) => s.quantity > 0)
              .map((s: any) => ({
                order_item_id: itemData.id,
                size: s.size,
                quantity: s.quantity
              }));
            if (sizesToInsert.length > 0) {
              await supabase.from('order_item_sizes').insert(sizesToInsert);
            }
          }
      }

      // 4. Success -> Redirect to the high-fidelity summary page
      toast.success('Pedido guardado correctamente', { id: loadingToast });
      if (isMountedRef.current) {
        navigate(`/cliente/pedido/${orderData.id}`, { replace: true });
      }
    } catch (error: any) {
      console.error("Error detallado al guardar:", error);
      toast.error(`Error al guardar: ${error.message || "Verifica la consola para más detalles."}`, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const createDraftOrder = async () => {
    const missingFields = [];
    if (!orderName.trim()) missingFields.push('Nombre del Pedido');
    if (!fullName.trim()) missingFields.push('Nombre del Cliente');
    if (!phone.trim()) missingFields.push('Teléfono');
    if (!email.trim()) missingFields.push('Correo Electrónico');
    if (!shippingAddress.trim()) missingFields.push('Dirección');
    if (!preferredCarrier.trim()) missingFields.push('Courier');
    if (!orderPurpose.trim()) missingFields.push('Propósito');

    if (missingFields.length > 0) {
      toast.error(`Completa los campos: ${missingFields.join(', ')}`);
      return;
    }

    handleNext();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="mb-10 text-center">
        <p className="font-headline text-[var(--color-primary)] font-extrabold tracking-tighter uppercase text-sm mb-2">
          Paso {step} de 2
        </p>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
          {step === 1 && 'Información General'}
          {step === 2 && 'Agregar Prendas'}
        </h1>
      </div>

      <div className="card p-6 md:p-10 mb-8">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="flex flex-col gap-2">
                <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Club Atlético Empalme"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                  Teléfono
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: 11 1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="Ej: contacto@club.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                  Courier preferido
                </label>
                <select
                  className="input-field"
                  value={preferredCarrier}
                  onChange={(e) => setPreferredCarrier(e.target.value)}
                >
                  <option value="">Seleccionar courier...</option>
                  {SHIPPING_CARRIERS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                Dirección de envío
              </label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Calle, número, localidad, provincia"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label text-xs uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)]">
                Propósito del pedido
              </label>
              <select
                className="input-field"
                value={orderPurpose}
                onChange={(e) => setOrderPurpose(e.target.value)}
              >
                <option value="">Seleccionar propósito...</option>
                {ORDER_PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={handlePrev} disabled className="btn btn-tertiary opacity-50">Atrás</button>
              <button 
                onClick={createDraftOrder} 
                disabled={loading}
                className="btn btn-primary"
              >
                Continuar con Prendas
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
                types={garmentTypes}
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
                  <button onClick={handleSubmitOrder} disabled={orderItems.length === 0 || loading} className="btn btn-primary">
                    {loading ? 'Guardando...' : 'Ver Resumen Final'}
                    <span className="material-symbols-outlined flex">arrow_forward</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default NewOrder;
