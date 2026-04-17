import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const AdminOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const isMountedRef = useRef(true);

  const STANDARD_SIZES = ['4', '6', '8', '10', '12', '14', '16', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL'];
  
  const getEffectiveSizes = () => {
    if (!order) return STANDARD_SIZES;
    
    const usedSizes = new Set<string>();
    order.order_items.forEach((item: any) => {
      item.order_item_sizes?.forEach((s: any) => { if (s.quantity > 0) usedSizes.add(s.size.toString()); });
      item.order_item_persons?.forEach((p: any) => { usedSizes.add(p.size.toString()); });
    });

    const merged = Array.from(new Set([...STANDARD_SIZES, ...Array.from(usedSizes)]));
    return merged;
  };

  const dynamicSizes = getEffectiveSizes();

  useEffect(() => {
    // Reset mounted flag on mount
    isMountedRef.current = true;
    
    fetchOrderDetails();

    // Cleanup: mark as unmounted and reset updating status
    return () => {
      isMountedRef.current = false;
      setUpdatingStatus(false);
    };
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, name, status, created_at, confirmed_at, client_id,
          profiles (name, team_name),
          client_shipping_info (full_name, phone, shipping_address, preferred_carrier, order_purpose),
          admin_comments (comment, created_at, admin_id),
          admin_designs (design_url, file_name, created_at),
          order_items (
            *,
            garment_types (name),
            designs (image_url),
            order_item_sizes (size, quantity),
            order_item_persons (size, person_name, person_number)
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setOrder(data);
      }
    } catch (err: any) {
      console.error("Error detallado en AdminOrderDetails:", err);
      if (isMountedRef.current) {
        alert(`Error cargando pedido: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (updatingStatus) return; // Prevent multiple simultaneous updates
    
    setUpdatingStatus(true);
    const loadingToast = toast.loading('Actualizando estado...');
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      
      if (isMountedRef.current) {
        setOrder((prev: any) => ({ ...prev, status: newStatus }));
        toast.success('Estado actualizado correctamente', { id: loadingToast });
      }
    } catch (err: any) {
      console.error("Error updating status:", err);
      if (isMountedRef.current) {
        toast.error(`Error al actualizar estado: ${err.message || 'Error desconocido'}`, { id: loadingToast });
      }
    } finally {
      if (isMountedRef.current) {
        setUpdatingStatus(false);
      }
    }
  };

  const sendToProduction = async () => {
    if (updatingStatus) return;
    
    // Show PDF preview modal first
    setShowPdfPreview(true);
  };

  const confirmSendToProduction = async () => {
    setShowPdfPreview(false);
    await updateOrderStatus('in_production');
  };

  const finalizeOrder = async () => {
    if (!window.confirm("¿Seguro que deseas marcar el pedido como FINALIZADO? Esta acción indica que el pedido ya fue entregado.")) return;
    await updateOrderStatus('delivered');
  };

  const updateItemSpec = async (itemId: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ [field]: value })
        .eq('id', itemId);
      
      if (error) throw error;
      
      setOrder((prev: any) => ({
        ...prev,
        order_items: prev.order_items.map((item: any) => 
          item.id === itemId ? { ...item, [field]: value } : item
        )
      }));
    } catch (err) {
      console.error(err);
      alert('Error al actualizar ficha técnica');
    }
  };

  const addAdminComment = async () => {
    if (!adminComment.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { error } = await supabase
        .from('admin_comments')
        .insert({
          order_id: id,
          admin_id: user.id,
          comment: adminComment.trim()
        });

      if (error) throw error;

      setAdminComment('');
      fetchOrderDetails(); // Refresh to show new comment
      toast.success('Comentario agregado');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al agregar comentario');
    }
  };

  const uploadAdminDesign = async (file: File) => {
    setUploadingDesign(true);
    const loadingToast = toast.loading('Subiendo diseño...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const fileExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const cleanName = Math.random().toString(36).substring(2, 10);
      const fileName = `${Date.now()}-${cleanName}.${fileExt}`;
      const filePath = `admin_designs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('custom_designs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('custom_designs')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('admin_designs')
        .insert({
          order_id: id,
          admin_id: user.id,
          design_url: urlData.publicUrl,
          file_name: file.name
        });

      if (dbError) throw dbError;

      fetchOrderDetails(); // Refresh to show new design
      toast.success('Diseño subido correctamente', { id: loadingToast });
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al subir diseño: ${err.message}`, { id: loadingToast });
    } finally {
      setUploadingDesign(false);
    }
  };

  if (loading) return <div className="p-12 text-center animate-pulse font-headline">Cargando pedido...</div>;
  if (!order) return <div className="p-12 text-center">Pedido no encontrado.</div>;

  const totalQuantity = order.order_items.reduce((sum: number, item: any) => {
    if (item.has_personalization) return sum + (item.order_item_persons?.length || 0);
    return sum + (item.order_item_sizes?.reduce((sub: number, s: any) => sub + (s.quantity || 0), 0) || 0);
  }, 0);

  return (
    <div className="max-w-[95%] mx-auto pb-[100px]">
      <div className="mb-6">
        <button onClick={() => navigate('/admin/dashboard', { replace: true })} className="text-[var(--color-primary)] text-sm font-bold flex items-center hover:underline">
          <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
          Volver al Panel
        </button>
      </div>

      <div className="card p-6 mb-8 border border-[var(--color-outline-variant)]/20 shadow-sm bg-white">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-primary)]">Ficha de Producción</p>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">{order.name}</h1>
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-[var(--color-on-surface-variant)]">
              <div><span className="font-bold text-[var(--color-on-surface)]">Cliente:</span> {order.profiles?.team_name || order.profiles?.name}</div>
              <div><span className="font-bold text-[var(--color-on-surface)]">Fecha:</span> {new Date(order.created_at).toLocaleDateString('es-AR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
              <div><span className="font-bold text-[var(--color-on-surface)]">Estado:</span> {order.status === 'confirmed' ? 'Recibido' : order.status === 'in_production' ? 'En producción' : order.status === 'delivered' ? 'Finalizado' : order.status}</div>
              <div><span className="font-bold text-[var(--color-on-surface)]">Total prendas:</span> {totalQuantity}</div>
              {order.client_shipping_info?.[0] && (
                <>
                  <div><span className="font-bold text-[var(--color-on-surface)]">Propósito:</span> {order.client_shipping_info[0].order_purpose}</div>
                  <div><span className="font-bold text-[var(--color-on-surface)]">Courier:</span> {order.client_shipping_info[0].preferred_carrier}</div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:items-end">
            <div className="inline-flex items-center rounded-full bg-[var(--color-primary-container)] px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[var(--color-primary)]">
              {order.status === 'confirmed' ? 'Recibido' : order.status === 'in_production' ? 'En producción' : order.status === 'delivered' ? 'Finalizado' : order.status}
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              {order.status === 'confirmed' && (
                <button 
                  onClick={sendToProduction} 
                  disabled={updatingStatus}
                  className={`btn text-xs px-4 py-2 transition-all ${
                    updatingStatus 
                      ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-700 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {updatingStatus ? 'hourglass_empty' : 'factory'}
                  </span>
                  {updatingStatus ? 'Enviando...' : 'Enviar a Fábrica'}
                </button>
              )}
              {order.status === 'in_production' && (
                <button 
                  onClick={finalizeOrder} 
                  disabled={updatingStatus}
                  className={`btn text-xs px-4 py-2 transition-all ${
                    updatingStatus 
                      ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                      : 'bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7] border hover:bg-[#2e7d32] hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {updatingStatus ? 'hourglass_empty' : 'check_circle'}
                  </span>
                  {updatingStatus ? 'Finalizando...' : 'Finalizar Pedido'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Information & Admin Tools */}
      {order.client_shipping_info?.[0] && (
        <div className="card p-6 mb-8 border border-[var(--color-outline-variant)]/20 shadow-sm">
          <h2 className="font-headline text-xl font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--color-primary)]">person</span>
            Información del Cliente
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-bold text-[var(--color-on-surface)]">Nombre:</span>
              <p className="text-[var(--color-on-surface-variant)]">{order.client_shipping_info[0].full_name}</p>
            </div>
            <div>
              <span className="font-bold text-[var(--color-on-surface)]">Teléfono:</span>
              <p className="text-[var(--color-on-surface-variant)]">{order.client_shipping_info[0].phone}</p>
            </div>
            <div>
              <span className="font-bold text-[var(--color-on-surface)]">Courier:</span>
              <p className="text-[var(--color-on-surface-variant)]">{order.client_shipping_info[0].preferred_carrier}</p>
            </div>
            <div className="md:col-span-2">
              <span className="font-bold text-[var(--color-on-surface)]">Dirección:</span>
              <p className="text-[var(--color-on-surface-variant)]">{order.client_shipping_info[0].shipping_address}</p>
            </div>
            <div>
              <span className="font-bold text-[var(--color-on-surface)]">Propósito:</span>
              <p className="text-[var(--color-on-surface-variant)]">{order.client_shipping_info[0].order_purpose}</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Tools */}
      <div className="card p-6 mb-8 border border-[var(--color-outline-variant)]/20 shadow-sm">
        <h2 className="font-headline text-xl font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--color-primary)]">admin_panel_settings</span>
          Herramientas de Administración
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Design Upload */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Subir Diseño (si cliente no lo tiene)
            </h3>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAdminDesign(file);
              }}
              disabled={uploadingDesign}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:bg-[var(--color-primary-container)]"
            />
            {uploadingDesign && <p className="text-xs text-[var(--color-primary)]">Subiendo...</p>}
          </div>

          {/* Admin Comments */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">comment</span>
              Comentarios para Producción
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Ej: Entregar antes del 15/04"
                className="input-field flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addAdminComment()}
              />
              <button
                onClick={addAdminComment}
                disabled={!adminComment.trim()}
                className="btn btn-secondary px-4"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Display Admin Designs */}
        {order.admin_designs && order.admin_designs.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--color-outline-variant)]/10">
            <h4 className="font-bold text-sm mb-3">Diseños Subidos por Admin:</h4>
            <div className="flex flex-wrap gap-4">
              {order.admin_designs.map((design: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 bg-[var(--color-surface-container-low)] p-3 rounded-lg">
                  <img src={design.design_url} alt={design.file_name} className="w-12 h-12 object-cover rounded" />
                  <div>
                    <p className="text-xs font-bold">{design.file_name}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">
                      {new Date(design.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <a href={design.design_url} target="_blank" rel="noreferrer" className="text-[var(--color-primary)]">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display Admin Comments */}
        {order.admin_comments && order.admin_comments.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--color-outline-variant)]/10">
            <h4 className="font-bold text-sm mb-3">Comentarios para Producción:</h4>
            <div className="space-y-3">
              {order.admin_comments.map((comment: any, idx: number) => (
                <div key={idx} className="bg-[var(--color-surface-container-low)] p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-[var(--color-primary)]">
                      {comment.profiles?.name || 'Admin'}
                    </span>
                    <span className="text-xs text-[var(--color-on-surface-variant)]">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm">{comment.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Tracker */}
      <div className="card p-0 overflow-hidden mb-12 border border-[var(--color-outline-variant)]/20 shadow-none">
        <div className="flex w-full">
            {[
                { key: 'confirmed', label: '1. RECIBIDO', icon: 'inbox' },
                { key: 'in_production', label: '2. EN FÁBRICA', icon: 'factory' },
                { key: 'delivered', label: '3. FINALIZADO', icon: 'verified' }
            ].map((phase, i, arr) => {
                const isPast = arr.findIndex(a => a.key === order.status) >= i;
                const isActive = order.status === phase.key;
                
                return (
                    <div key={phase.key} className={`flex-1 flex flex-col items-center py-4 border-r last:border-0 border-[var(--color-outline-variant)]/10 transition-all ${isActive ? 'bg-[var(--color-primary-container)]/10' : ''}`}>
                        <span className={`material-symbols-outlined ${isPast ? 'text-[var(--color-primary)]' : 'text-[var(--color-outline-variant)]'} ${isActive ? 'scale-125 animate-pulse' : ''}`}>
                            {phase.icon}
                        </span>
                        <p className={`text-[10px] font-black mt-2 tracking-widest ${isPast ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-outline-variant)]'}`}>
                            {phase.label}
                        </p>
                        {isActive && <div className="mt-1 w-1 h-1 rounded-full bg-[var(--color-primary)]"></div>}
                    </div>
                )
            })}
        </div>
      </div>

      <div className="space-y-6">
        {order.order_items.map((item: any) => {
          const isRemera = item.garment_types?.name.toLowerCase().includes('remera');
          return (
          <div key={item.id} className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-2 mb-3">
               <h3 className="font-headline text-xl font-bold">{item.garment_types?.name}</h3>
               <span className="border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white text-[10px] uppercase font-black px-4 py-0.5 rounded-full shadow-sm">
                 {item.category || 'Categoría no definida'}
               </span>
            </div>
            { (item.custom_design_url || item.designs?.image_url) && (
              <div className="flex items-center gap-4 my-3">
                <img src={item.custom_design_url || item.designs?.image_url} alt="Diseño" className="w-24 aspect-[4/5] object-contain rounded border border-[var(--color-outline-variant)]/20 shadow-sm bg-white" />
                <a href={item.custom_design_url || item.designs?.image_url} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-primary)] font-bold hover:underline">
                  Ver Diseño <span className="material-symbols-outlined text-xs align-middle">open_in_new</span>
                </a>
              </div>
            )}
            
            {/* Ficha Técnica / Especificaciones Admin */}
            <div className="bg-[var(--color-surface-container-low)] p-5 rounded-2xl border-2 border-[var(--color-primary)]/10 my-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[var(--color-primary)]">fact_check</span>
                <h4 className="font-headline text-sm font-black uppercase tracking-widest text-[var(--color-primary)]">Ficha Técnica de Producción</h4>
              </div>
              
              <div className={`grid grid-cols-1 md:grid-cols-2 ${isRemera ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                {(isRemera || item.garment_types?.name.toLowerCase().includes('short')) && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Tipo de Tela</label>
                    <select 
                      className="input-field py-1.5 text-xs font-bold" 
                      value={item.fabric_type || ''} 
                      onChange={(e) => updateItemSpec(item.id, 'fabric_type', e.target.value)}
                    >
                      <option value="">Seleccionar tela...</option>
                      <option value="Microfibra Deportiva">Microfibra Deportiva</option>
                      <option value="Set de Poliéster">Set de Poliéster</option>
                      <option value="Algodón Premium">Algodón Premium</option>
                      <option value="DryFit Honeycomb">DryFit Honeycomb</option>
                      <option value="Polisap">Polisap</option>
                    </select>
                  </div>
                )}
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Tipo de Cuello</label>
                  <select 
                    className="input-field py-1.5 text-xs font-bold" 
                    value={item.collar_type || ''} 
                    onChange={(e) => updateItemSpec(item.id, 'collar_type', e.target.value)}
                  >
                    <option value="">Seleccionar cuello...</option>
                    <option value="Cuello Redondo">Cuello Redondo</option>
                    <option value="Cuello en V">Cuello en V</option>
                    <option value="Cuello Polo">Cuello Polo</option>
                    <option value="Cuello Chomba">Cuello Chomba</option>
                    <option value="Escote V Profundo">Escote V Profundo</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Color de Sisa / Detalles</label>
                  <input 
                    type="text" 
                    className="input-field py-1.5 text-xs" 
                    placeholder="Ej: Rojo / Igual al diseño" 
                    value={item.armhole_color || ''} 
                    onBlur={(e) => updateItemSpec(item.id, 'armhole_color', e.target.value)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrder((prev: any) => ({
                        ...prev,
                        order_items: prev.order_items.map((it: any) => it.id === item.id ? { ...it, armhole_color: val } : it)
                      }));
                    }}
                  />
                </div>

                {isRemera && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Manga (Tipo)</label>
                    <select 
                      className="input-field py-1.5 text-xs font-bold" 
                      value={item.sleeve_type || ''} 
                      onChange={(e) => updateItemSpec(item.id, 'sleeve_type', e.target.value)}
                    >
                      <option value="">Sin definir...</option>
                      <option value="Manga Corta">Manga Corta</option>
                      <option value="Manga Larga">Manga Larga</option>
                      <option value="Sin Mangas">Sin Mangas</option>
                    </select>
                  </div>
                )}
              </div>

              {/* COLORS SECTION - NEW */}
              <div className="mt-6 pt-6 border-t border-[var(--color-outline-variant)]/10">
                <h5 className="text-[10px] font-black uppercase tracking-tighter text-[var(--color-on-surface-variant)] mb-4">Especificación Cromática de Producción</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Color Base / Principal</label>
                     <div className="flex flex-wrap gap-2 mb-2">
                        {['Blanco', 'Negro', 'Azul Marino', 'Rojo', 'Amarillo', 'Verde'].map(c => (
                          <button key={c} onClick={() => updateItemSpec(item.id, 'base_color', c)} className={`text-[9px] px-2 py-1 rounded border font-bold ${item.base_color === c ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white border-[var(--color-outline-variant)]/20 hover:border-[var(--color-primary)]'}`}>{c}</button>
                        ))}
                     </div>
                     <input 
                        type="text" 
                        className="input-field py-1.5 text-xs" 
                        placeholder="Otro color personalizado..." 
                        value={item.base_color || ''} 
                        onBlur={(e) => updateItemSpec(item.id, 'base_color', e.target.value)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrder((prev: any) => ({
                            ...prev,
                            order_items: prev.order_items.map((it: any) => it.id === item.id ? { ...it, base_color: val } : it)
                          }));
                        }}
                      />
                   </div>

                   <div className="space-y-3">
                     <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest">Color de Mangas / Detalles Adic.</label>
                     <div className="flex flex-wrap gap-2 mb-2">
                        {['Blanco', 'Negro', 'Gris', 'Cian', 'Naranja', 'Violeta'].map(c => (
                          <button key={c} onClick={() => updateItemSpec(item.id, 'sleeve_color', c)} className={`text-[9px] px-2 py-1 rounded border font-bold ${item.sleeve_color === c ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white border-[var(--color-outline-variant)]/20 hover:border-[var(--color-primary)]'}`}>{c}</button>
                        ))}
                     </div>
                     <input 
                        type="text" 
                        className="input-field py-1.5 text-xs" 
                        placeholder="Ej: Manga derecha Roja, Izq Blanca..." 
                        value={item.sleeve_color || ''} 
                        onBlur={(e) => updateItemSpec(item.id, 'sleeve_color', e.target.value)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrder((prev: any) => ({
                            ...prev,
                            order_items: prev.order_items.map((it: any) => it.id === item.id ? { ...it, sleeve_color: val } : it)
                          }));
                        }}
                      />
                   </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="mt-10">
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-[var(--color-primary)] rounded-full"></div>
                  <h4 className="font-headline text-lg font-extrabold uppercase tracking-tight text-[var(--color-on-surface)]">Mapa de Talles & Cantidades</h4>
                </div>
                <div className="bg-[var(--color-inverse-surface)] text-[var(--color-inverse-on-surface)] px-5 py-2 rounded-2xl text-xs font-black shadow-xl shadow-black/20 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  Total: {item.has_personalization ? (item.order_item_persons?.length || 0) : (item.order_item_sizes?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0)} Prendas
                </div>
              </div>

              <div className="overflow-hidden border border-[var(--color-outline-variant)]/20 rounded-2xl bg-white shadow-xl">
                <div className="flex bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)]/20">
                  {dynamicSizes.filter(size => {
                    if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
                    return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
                  }).map(size => (
                    <div key={size} className="flex-1 min-w-[60px] text-center py-2 text-[10px] font-black uppercase tracking-widest border-r border-[var(--color-outline-variant)]/10 last:border-r-0">
                      {size}
                    </div>
                  ))}
                </div>
                <div className="flex items-end">
                  {dynamicSizes.filter(size => {
                    if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
                    return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
                  }).map(size => {
                    let qty = 0;
                    if (item.has_personalization) {
                      qty = item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
                    } else {
                      qty = item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
                    }
                    
                    return (
                      <div key={size} className="flex-1 min-w-[60px] text-center py-4 border-r border-[var(--color-outline-variant)]/10 last:border-r-0 hover:bg-[var(--color-primary-container)]/5 transition-colors">
                        <span className="text-2xl font-headline font-black text-[var(--color-on-surface)]">
                          {qty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {item.has_personalization && item.order_item_persons?.length > 0 && (
              <div className="mt-14">
                <div className="flex items-center gap-4 mb-6">
                  <h4 className="font-headline text-md font-extrabold uppercase tracking-tight flex items-center gap-2">
                    <span className="w-10 h-10 rounded-full bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] flex items-center justify-center">
                      <span className="material-symbols-outlined">format_list_bulleted</span>
                    </span>
                    Planilla de Estampado Individual
                  </h4>
                  <div className="h-px flex-1 bg-[var(--color-outline-variant)]/20"></div>
                </div>
                
                <div className="overflow-hidden border border-[var(--color-outline-variant)]/20 rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)]/20">
                        <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)] border-r border-[var(--color-outline-variant)]/10">Nº</th>
                        <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)] border-r border-[var(--color-outline-variant)]/10">Talle</th>
                        <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Nombre a Estampar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-outline-variant)]/10">
                      {item.order_item_persons.map((p: any, pIdx: number) => {
                        const isShorts = item.garment_type_name?.toLowerCase().includes('pantalón') || item.garment_type_name?.toLowerCase().includes('short');
                        return (
                          <tr key={pIdx} className="hover:bg-[var(--color-primary-container)]/5 transition-colors">
                            <td className="p-3 font-headline font-black text-xl text-[var(--color-primary)] bg-[var(--color-surface-container-lowest)] border-r border-[var(--color-outline-variant)]/10 w-20 text-center">
                              {p.person_number || '—'}
                            </td>
                            <td className="p-3 font-bold text-sm w-24 text-center border-r border-[var(--color-outline-variant)]/10">
                              <span className="bg-[var(--color-surface-container-high)] px-3 py-1 rounded-full">{p.size}</span>
                            </td>
                            <td className="p-3 font-headline font-extrabold text-lg uppercase tracking-tight text-[var(--color-on-surface)]">
                              {isShorts ? (
                                <span className="text-[10px] text-[var(--color-on-surface-variant)]/30 italic font-black uppercase tracking-widest">Sin Nombre (Pantalón)</span>
                              ) : (
                                p.person_name || '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
            {item.notes && (
              <div className="mt-4 bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] p-3 rounded text-sm">
                <strong>Obs:</strong> {item.notes}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Vista Previa - Ficha de Producción</h2>
              <button 
                onClick={() => setShowPdfPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-auto">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-600 mb-4">
                  Esta es la ficha de producción que se enviará a la fábrica. Revisa que toda la información sea correcta.
                </p>
                
                {/* PDF Preview Content - Simplified version */}
                <div className="bg-white p-6 rounded border shadow-sm">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">ALTIV - FICHA DE PRODUCCIÓN</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      Cliente: {order.profiles?.team_name || order.profiles?.name} | 
                      Fecha: {new Date().toLocaleDateString()} | 
                      Pedido: {order.name}
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="font-bold text-gray-900 mb-3">RESUMEN DE PRENDAS Y TALLES</h4>
                    <table className="w-full border-collapse border border-gray-300 text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-2 text-left">Prenda / Categoría</th>
                          {dynamicSizes.filter(size => 
                            order.order_items.some((item: any) =>
                              item.has_personalization
                                ? item.order_item_persons?.some((p: any) => p.size === size)
                                : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
                            )
                          ).map(size => (
                            <th key={size} className="border border-gray-300 p-2 text-center">{size}</th>
                          ))}
                          <th className="border border-gray-300 p-2 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.order_items.map((item: any) => {
                          const sizesRow = dynamicSizes.filter(size => 
                            order.order_items.some((item: any) =>
                              item.has_personalization
                                ? item.order_item_persons?.some((p: any) => p.size === size)
                                : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
                            )
                          ).map((size: string) => {
                            const qty = item.has_personalization
                              ? item.order_item_persons?.filter((p: any) => p.size === size).length || 0
                              : item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
                            return qty;
                          });
                          const rowTotal = sizesRow.reduce((sum: number, value: number) => sum + value, 0);
                          return (
                            <tr key={item.id}>
                              <td className="border border-gray-300 p-2 font-medium">
                                {item.garment_types?.name} {item.category}
                              </td>
                              {sizesRow.map((qty: number, idx: number) => (
                                <td key={idx} className="border border-gray-300 p-2 text-center">{qty || '-'}</td>
                              ))}
                              <td className="border border-gray-300 p-2 text-center font-bold">{rowTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-4">
                    <p><strong>Total de prendas:</strong> {totalQuantity}</p>
                    <p className="mt-2">Esta ficha incluye toda la información técnica necesaria para la producción.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button 
                onClick={() => setShowPdfPreview(false)}
                className="btn btn-secondary px-6 py-2"
              >
                Revisar Después
              </button>
              <button 
                onClick={confirmSendToProduction}
                disabled={updatingStatus}
                className="btn btn-primary px-6 py-2 disabled:opacity-50"
              >
                {updatingStatus ? 'Enviando...' : 'Confirmar y Enviar a Fábrica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrderDetails;
