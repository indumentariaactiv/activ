import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../lib/imageUtils';

interface Design {
  id: string;
  name: string;
  image_url: string;
  garment_type_id: string;
  active: boolean;
  garment_types?: {
    name: string;
  };
}

interface GarmentType {
  id: string;
  name: string;
}

const AdminCatalog = () => {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [types, setTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Image Editing State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);
  
  // Selection/Filter state
  const [filterTypeId, setFilterTypeId] = useState<string>('all');
  
  // Form state
  const [name, setName] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('garment_types').select('id, name').order('name');
      setTypes(tData || []);
      
      await fetchDesigns();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesigns = async () => {
    try {
      const { data, error } = await supabase
        .from('designs')
        .select(`
          *,
          garment_types (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDesigns(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result as string);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    setUploading(true);
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Error procesando recorte");

      const fileName = `catalog-${Date.now()}.jpg`;
      const filePath = `catalog/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('custom_designs')
        .upload(filePath, croppedImageBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('custom_designs').getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      setShowCropper(false);
    } catch (err: any) {
      alert(`Error al guardar recorte: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl || !selectedTypeId) return;

    try {
      const { error } = await supabase.from('designs').insert({
        name: name || 'Modelo sin nombre',
        image_url: imageUrl,
        garment_type_id: selectedTypeId,
        active: true
      });

      if (error) throw error;
      
      setIsModalOpen(false);
      setName('');
      setSelectedTypeId('');
      setImageUrl('');
      fetchDesigns();
    } catch (err: any) {
      alert(`Error al guardar diseño: ${err.message}`);
    }
  };

  const toggleActive = async (design: Design) => {
    try {
      const { error } = await supabase
        .from('designs')
        .update({ active: !design.active })
        .eq('id', design.id);
      
      if (error) throw error;
      fetchDesigns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este diseño del catálogo?')) return;
    try {
      const { error } = await supabase.from('designs').delete().eq('id', id);
      if (error) throw error;
      fetchDesigns();
    } catch (err) {
      alert('Error al eliminar diseño');
    }
  };

  const filteredDesigns = filterTypeId === 'all' 
    ? designs 
    : designs.filter(d => d.garment_type_id === filterTypeId);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="font-headline text-[var(--color-primary)] font-extrabold tracking-tighter uppercase text-sm mb-2">
            Gestión Visual de Modelos
          </p>
          <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight text-[var(--color-on-surface)] leading-none">
            Catálogo de Diseños
          </h1>
          <p className="text-[var(--color-on-surface-variant)] mt-2 font-medium">Controla las plantillas que los clientes pueden elegir para cada prenda.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] tracking-widest pl-1">Filtrar por Prenda</span>
            <select 
              className="input-field py-2 text-sm font-bold min-w-[200px]"
              value={filterTypeId}
              onChange={(e) => setFilterTypeId(e.target.value)}
            >
              <option value="all">TODAS LAS PRENDAS</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>)}
            </select>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="btn btn-primary h-[42px] mt-auto shadow-lg hover:shadow-[0_0_20px_var(--color-primary-container)]"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Cargar Nuevo Diseño
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse text-[var(--color-primary)]">
          <span className="material-symbols-outlined text-5xl mb-4">style</span>
          <p className="font-black uppercase tracking-widest">Cargando Catálogo de Alta Gama...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredDesigns.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-[var(--color-surface-container-low)] rounded-3xl border-2 border-dashed border-[var(--color-outline-variant)]/20">
              <span className="material-symbols-outlined text-4xl text-[var(--color-on-surface-variant)] mb-2">image_search</span>
              <p className="text-[var(--color-on-surface-variant)] font-bold">No hay diseños cargados para esta categoría.</p>
            </div>
          ) : (
            filteredDesigns.map(design => (
              <div key={design.id} className={`group card p-0 overflow-hidden border-2 transition-all duration-300 ${design.active ? 'border-transparent hover:border-[var(--color-primary)]' : 'border-dashed opacity-60 grayscale'}`}>
                <div className="relative aspect-[4/5] bg-white overflow-hidden">
                  <img 
                    src={design.image_url} 
                    alt={design.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleActive(design)} className="w-8 h-8 rounded-full bg-white/90 text-[var(--color-on-surface)] shadow-lg flex items-center justify-center hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[1rem]">{design.active ? 'visibility' : 'visibility_off'}</span>
                    </button>
                    <button onClick={() => handleDelete(design.id)} className="w-8 h-8 rounded-full bg-white/90 text-red-600 shadow-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[1rem]">delete</span>
                    </button>
                  </div>
                  {!design.active && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white px-3 py-1 rounded">Desactivado</span>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-[var(--color-surface-container-high)]">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-[var(--color-primary)] uppercase tracking-widest truncate">{design.garment_types?.name}</span>
                    <h3 className="font-bold text-sm truncate uppercase mt-0.5">{design.name}</h3>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal for New Design */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-surface)] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-[var(--color-outline-variant)]/20">
            <div className="p-6 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)]/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
                  <span className="material-symbols-outlined text-xl">upload</span>
                </span>
                <h2 className="font-headline text-xl font-black uppercase tracking-tight">Nueva Plantilla de Diseño</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              {/* Type Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] flex items-center gap-1.5 pl-1">
                  <span className="material-symbols-outlined text-[1rem]">apparel</span>
                  1. Tipo de Prenda Asociado
                </label>
                <select 
                  required 
                  className="input-field font-bold uppercase text-xs"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                >
                  <option value="" disabled>Seleccionar prenda...</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Name field */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] flex items-center gap-1.5 pl-1">
                  <span className="material-symbols-outlined text-[1rem]">label</span>
                  2. Nombre del Diseño
                </label>
                <input 
                  type="text" 
                  className="input-field font-bold" 
                  placeholder="Ej: Rayado Vertical v1" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Image Upload Area */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] flex items-center gap-1.5 pl-1">
                  <span className="material-symbols-outlined text-[1rem]">image</span>
                  3. Imagen de la Plantilla
                </label>
                
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />

                {!imageUrl ? (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-[4/5] w-full max-w-[200px] mx-auto rounded-2xl border-2 border-dashed border-[var(--color-outline-variant)] hover:border-[var(--color-primary)] transition-all flex flex-col items-center justify-center gap-2 group bg-[var(--color-surface-container-low)]"
                  >
                    <span className={`material-symbols-outlined text-4xl ${uploading ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`}>
                      {uploading ? 'sync' : 'cloud_upload'}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">
                      {uploading ? 'Procesando...' : 'Click para subir'}
                    </span>
                  </button>
                ) : (
                  <div className="relative aspect-[4/5] w-full max-w-[200px] mx-auto rounded-2xl overflow-hidden border-2 border-[var(--color-primary)] shadow-lg">
                    <img src={imageUrl} alt="Uploaded" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-[var(--color-primary)] py-1.5 text-center">
                       <span className="text-[9px] font-black text-white uppercase tracking-widest">Imagen Lista</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn flex-1 bg-[var(--color-surface-container-highest)] text-sm font-bold py-4"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={!imageUrl || !selectedTypeId || uploading}
                  className="btn btn-primary flex-1 shadow-[0_0_20px_var(--color-primary-container)] py-4" 
                  style={{ background: 'linear-gradient(135deg, #00c06a, #00a05a)' }}
                >
                  Confirmar y Guardar
                  <span className="material-symbols-outlined">check_circle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black p-4 md:p-10 animate-in fade-in">
          <div className="flex justify-between items-center text-white mb-6">
            <h2 className="font-headline text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">crop</span>
              Centrar Diseño (Formato 4:5)
            </h2>
            <div className="flex gap-4">
               <button onClick={() => setShowCropper(false)} className="px-6 py-2 rounded-full border border-white/20 text-white font-bold hover:bg-white/10 transition-colors">Cancelar</button>
               <button 
                onClick={handleCropSave} 
                disabled={uploading}
                className="px-8 py-2 rounded-full bg-white text-black font-black hover:bg-slate-200 transition-colors flex items-center gap-2"
               >
                 {uploading ? 'Guardando...' : 'Aplicar Recorte'}
                 <span className="material-symbols-outlined">done</span>
               </button>
            </div>
          </div>
          
          <div className="relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={4 / 5}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          
          <div className="mt-8 max-w-md mx-auto w-full flex flex-col gap-4 bg-slate-800/50 p-6 rounded-3xl backdrop-blur-xl border border-white/5">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-white">zoom_out</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-white"
              />
              <span className="material-symbols-outlined text-white">zoom_in</span>
            </div>
            <p className="text-[10px] text-white/40 text-center uppercase font-black tracking-widest">Desliza para agrandar · Arrastra para centrar</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCatalog;
