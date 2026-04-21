import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export interface PersonRow {
  id: string; // temp id for ui iteration
  size: string;
  name: string;
  number: string;
  role?: string; // New field for arquero, libero, dt, etc.
}

export interface SizeQuantity {
  size: string;
  quantity: number;
}

export interface GarmentData {
  id: string; 
  garment_type_id: string;
  garment_type_name: string;
  category: string; // Gender
  base_color?: string;
  sleeve_type?: string;
  sleeve_color?: string;
  fabric_type?: string;
  collar_type?: string;
  armhole_color?: string;
  has_personalization: boolean;
  design_id?: string;
  design_image_url?: string; // Cache the gallery image URL for summary
  custom_design_url?: string;
  observations: string;
  sizes: SizeQuantity[];
  persons: PersonRow[];
}

interface GarmentFormProps {
  initialData?: GarmentData;
  types: any[];
  onSave: (garment: GarmentData) => void;
  onCancel: () => void;
}

export const GarmentForm: React.FC<GarmentFormProps> = ({ initialData, types, onSave, onCancel }) => {
  const [selectedTypeId, setSelectedTypeId] = useState(initialData?.garment_type_id || '');
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || '');
  
  const [baseColor] = useState(initialData?.base_color || '');
  const [sleeveType, setSleeveType] = useState(initialData?.sleeve_type || '');
  const [sleeveColor] = useState(initialData?.sleeve_color || '');
  const [collarType, setCollarType] = useState(initialData?.collar_type || '');
  const [pockets, setPockets] = useState(initialData?.observations.includes('Con Bolsillos') ? 'Con Bolsillos' : (initialData?.observations.includes('Sin Bolsillos') ? 'Sin Bolsillos' : ''));
  // Removed fabric, armhole from Client view (Admin sets these)
  
  const [customDesignUrl, setCustomDesignUrl] = useState(initialData?.custom_design_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPersonalization, setHasPersonalization] = useState(initialData?.has_personalization || false);
  const [observations, setObservations] = useState(() => {
    let obs = initialData?.observations || '';
    if (obs.startsWith('Con Bolsillos - ')) obs = obs.replace('Con Bolsillos - ', '');
    if (obs.startsWith('Sin Bolsillos - ')) obs = obs.replace('Sin Bolsillos - ', '');
    return obs;
  });
  
  const [sizeGrid, setSizeGrid] = useState<SizeQuantity[]>(initialData?.sizes || []);
  const [persons, setPersons] = useState<PersonRow[]>(initialData?.persons || []);
  const [singleQuantity, setSingleQuantity] = useState<number>(initialData?.sizes?.[0]?.quantity || 0);

  // For "otros" (bolso, botinero, bandera): auto-select the single category
  useEffect(() => {
    if (!selectedTypeId) return;
    const typeObj = types.find(t => t.id === selectedTypeId);
    if (!typeObj) return;
    const typeName = typeObj.name.toLowerCase();
    const isOtros = ['bandera', 'bolso', 'botinero'].some(k => typeName.includes(k));
    if (isOtros) {
      const firstCat = Object.keys(typeObj.categories)[0] || 'Cantidad';
      setSelectedCategory(firstCat);
    }
  }, [selectedTypeId, types]);

  // When type or category changes, reset grids if no initial data
  useEffect(() => {
    if (!initialData && selectedTypeId && selectedCategory) {
      const typeObj = types.find(t => t.id === selectedTypeId);
      if (!typeObj) return;

      const availableSizes = typeObj.categories[selectedCategory] as string[];
      const typeName = typeObj.name.toLowerCase();
      const noSizeMode = ['bandera', 'bolso', 'botinero'].some(keyword => typeName.includes(keyword));

      if (noSizeMode) {
        setSizeGrid([]);
        setSingleQuantity(0);
        return;
      }

      if (availableSizes) {
        setSizeGrid(availableSizes.map(s => ({ size: s, quantity: 0 })));
      }
    }
  }, [selectedTypeId, selectedCategory, types, initialData]);

  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('El servidor tardó demasiado. Verificá tu conexión y reintentá.')), ms)
      )
    ]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Verificar sesión activa ANTES de subir — evita cuelgue en Vercel
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Tu sesión expiró. Recargá la página e iniciá sesión nuevamente.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading('Subiendo archivo...');
    
    try {
      const fileExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const cleanName = Math.random().toString(36).substring(2, 10);
      const fileName = `${Date.now()}-${cleanName}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      console.log('Starting upload to storage:', filePath);
      
      const { error: uploadError } = await withTimeout(
        supabase.storage.from('custom_designs').upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        }),
        30000 // 30 seconds for non-compressed images
      );

      if (uploadError) {
        console.error('Supabase storage error:', uploadError);
        throw uploadError;
      }
      
      const { data: urlData } = supabase.storage.from('custom_designs').getPublicUrl(filePath);
      if (!urlData?.publicUrl) throw new Error('No se pudo generar la URL pública del archivo.');

      console.log('Upload successful:', urlData.publicUrl);
      setCustomDesignUrl(urlData.publicUrl);
      toast.success('Archivo subido correctamente', { id: loadingToast });
    } catch (error: any) {
      console.error('Upload catch error:', error);
      const errorMsg = error.message === 'Failed to fetch' 
        ? 'Error de conexión. Verificá tu internet e intentá de nuevo.'
        : error.message || 'Error desconocido al subir.';
      toast.error(`Error: ${errorMsg}`, { id: loadingToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
    }
  };


  const handleGridChange = (size: string, val: number) => {
    setSizeGrid(prev => prev.map(item => item.size === size ? { ...item, quantity: val } : item));
  };

  const currentTypeObj = types.find(t => t.id === selectedTypeId);
  const availableSizesForCategory = currentTypeObj && selectedCategory ? (currentTypeObj.categories[selectedCategory] as string[]) : [];
  const productName = currentTypeObj?.name.toLowerCase() || '';
  const isRemera = productName.includes('remera');
  const isShorts = productName.includes('short');
  const isMusculosa = productName.includes('musculosa');
  const isCampera = productName.includes('campera');
  const isBuzo = productName.includes('buzo');
  const isBandera = productName.includes('bandera');
  const isBolsoDeportivo = productName.includes('bolso deportivo');
  const isBolsoPaletero = productName.includes('bolso paletero');
  const isBotinero = productName.includes('botinero');
  const isBolso = isBolsoDeportivo || isBolsoPaletero || isBotinero;
  const noSizesMode = isBandera || isBolso;
  // "Otros": accesorios que no necesitan selector de género
  const isOtros = isBandera || isBolso;

  const [newPersonSize, setNewPersonSize] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonNumber, setNewPersonNumber] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonQuantity, setNewPersonQuantity] = useState(1);

  const addPersonRow = () => {
    const requiresName = !isShorts && selectedCategory !== 'Unisex';
    if (requiresName && !newPersonName.trim()) return;
    
    const qty = Math.max(1, newPersonQuantity);
    const newRows: any[] = [];
    
    for (let i = 0; i < qty; i++) {
        newRows.push({ 
            id: `${Date.now()}-${i}`, 
            size: newPersonSize || (availableSizesForCategory[0] || ''), 
            name: newPersonName.trim().toUpperCase(), 
            number: newPersonNumber.trim(),
            role: newPersonRole.trim()
        });
    }

    setPersons(prev => [...prev, ...newRows]);
    setNewPersonName('');
    setNewPersonNumber('');
    setNewPersonRole('');
    setNewPersonQuantity(1);
    // Optionally focus the name input again
    setTimeout(() => document.getElementById('new-person-name')?.focus(), 0);
  };

  const removePersonRow = (id: string) => {
    setPersons(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validación: verificar que hay talles/cantidad seleccionados
    if (!hasPersonalization && !noSizesMode) {
      const hasSizes = sizeGrid.some(sg => sg.quantity > 0);
      if (!hasSizes) {
        alert('Por favor, selecciona al menos un talle con cantidad mayor a 0');
        return;
      }
    } else if (hasPersonalization && persons.length === 0) {
      alert('Por favor, agrega al menos una prenda a la lista de personalizados');
      return;
    }

    const selectedFabricType = '';
    const finalObservations = (isShorts && pockets) ? `${pockets} - ${observations}` : observations;
    const finalSizes = hasPersonalization
      ? []
      : noSizesMode
        ? [{ size: 'Cantidad', quantity: singleQuantity }]
        : sizeGrid;

    onSave({
      id: initialData?.id || Date.now().toString(),
      garment_type_id: selectedTypeId,
      garment_type_name: currentTypeObj?.name || '',
      category: selectedCategory,
      base_color: baseColor,
      sleeve_type: sleeveType,
      sleeve_color: sleeveColor,
      collar_type: (isRemera || isCampera || isBuzo || isBandera) ? collarType : undefined,
      fabric_type: selectedFabricType,
      has_personalization: hasPersonalization,
      design_id: undefined,
      design_image_url: undefined,
      custom_design_url: customDesignUrl,
      observations: finalObservations,
      sizes: finalSizes,
      persons: hasPersonalization ? persons : []
    });
  };

  return (
    <div className="card p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 border-2 border-[var(--color-primary)]/20 shadow-lg relative">
      <h3 className="font-headline text-xl font-bold mb-6 border-b border-[var(--color-outline-variant)]/20 pb-4 flex justify-between items-center">
        {initialData ? 'Editar Prenda' : 'Configurador de Prenda'}
        {initialData && <span className="bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] uppercase font-bold px-2 py-1 rounded">Edición</span>}
      </h3>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Basic Selections */}
        <div className={`grid gap-4 ${isOtros ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          <div className="flex flex-col gap-2">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Tipo de Prenda</label>
            <select className="input-field h-14 md:h-12 text-base md:text-sm font-bold md:font-normal cursor-pointer" required value={selectedTypeId} onChange={e => { setSelectedTypeId(e.target.value); setSelectedCategory(''); }}>
              <option value="" disabled>Seleccione prenda...</option>
              {/* Prendas principales */}
              <optgroup label="Prendas">
                {types.filter(t => !['Bandera', 'Bolso Deportivo', 'Bolso Paletero', 'Botinero'].includes(t.name)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              {/* Otros */}
              <optgroup label="Otros">
                {types.filter(t => ['Bandera', 'Bolso Deportivo', 'Bolso Paletero', 'Botinero'].includes(t.name)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Ocultar selector de género para accesorios — se auto-selecciona */}
          {!isOtros && (
            <div className="flex flex-col gap-2">
              <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Género / Contextura</label>
              <select className="input-field h-14 md:h-12 text-base md:text-sm font-bold md:font-normal cursor-pointer" required disabled={!selectedTypeId} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="" disabled>Seleccione...</option>
                {currentTypeObj && Object.keys(currentTypeObj.categories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Technical Attributes - HIDDEN FOR CLIENT per request */}
        {/*
        <div className="flex flex-col gap-4 bg-[var(--color-surface-container-lowest)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
          ...
        </div>
        */}

        {isRemera && (
          <div className="flex flex-col gap-4 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <div className="flex flex-col gap-2">
              <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Tipo de Manga</label>
              <div className="flex flex-wrap gap-2">
                {['Manga Corta', 'Manga Larga', 'Sin Mangas'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSleeveType(type)}
                    className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${sleeveType === type ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary)]' : 'border-[var(--color-outline-variant)]/20 hover:border-[var(--color-outline-variant)] opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Tipo de Cuello</label>
              <div className="flex flex-wrap gap-2">
                {['Cuello Redondo', 'Escote en V'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCollarType(type)}
                    className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${collarType === type ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] shadow-sm' : 'border-[var(--color-outline-variant)]/20 hover:border-[var(--color-outline-variant)] opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isMusculosa && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Información</label>
            <p className="text-sm text-[var(--color-on-surface-variant)]">Musculosa sin opciones de diseño adicionales</p>
          </div>
        )}

        {(isCampera || isBuzo) && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Estilo de Prenda</label>
            <div className="flex flex-wrap gap-2">
              {(isCampera ? ['Capucha', 'Cuello Alto'] : ['Capucha', 'Cuello Redondo']).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCollarType(type)}
                  className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${collarType === type ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] shadow-sm' : 'border-[var(--color-outline-variant)]/20 hover:border-[var(--color-outline-variant)] opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {isShorts && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Bolsillos</label>
            <div className="flex flex-wrap gap-2">
              {['Con Bolsillos', 'Sin Bolsillos'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPockets(type)}
                  className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${pockets === type ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] shadow-sm' : 'border-[var(--color-outline-variant)]/20 hover:border-[var(--color-outline-variant)] opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {isBandera && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Medida</label>
            <select className="input-field" value={collarType} onChange={e => setCollarType(e.target.value)}>
              <option value="" disabled>Seleccione medida...</option>
              {['1m x 1.5m', '2m x 1.5m', '3m x 1.5m', '4m x 1.5m', '5m x 1.5m'].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        {isBolso && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Cantidad de Unidades</label>
            <input
              type="tel"
              inputMode="numeric"
              min="1"
              className="input-field text-center font-bold text-lg p-3 h-14 w-full"
              value={singleQuantity}
              onChange={e => setSingleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              placeholder="1"
            />
          </div>
        )}

        {/* Design Upload */}
        <div className="flex flex-col gap-4 p-5 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-primary)]/10">
           <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Diseño a usar</label>
           
           <div className="flex flex-col gap-3">
              <input type="file" accept="image/*,.pdf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <div className="flex flex-col md:flex-row items-center gap-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn bg-white border-2 border-dashed border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-container)]/20 text-sm px-6 py-3 whitespace-nowrap w-full md:w-auto font-black shadow-sm">
                  <span className="material-symbols-outlined">{uploading ? 'hourglass_empty' : 'upload_file'}</span>
                  {uploading ? 'Subiendo...' : 'Subir Archivo de Prenda'}
                </button>
              </div>
              
              {customDesignUrl && (
                <div className="mt-2 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/20 p-4 rounded-xl flex items-start sm:items-center gap-4 sm:gap-6 animate-in fade-in zoom-in-95 shadow-sm">
                  {customDesignUrl.match(/\.(jpeg|jpg|gif|png)$/i) || customDesignUrl.includes("supabase.co") ? (
                    <img src={customDesignUrl} alt="Preview" className="w-20 sm:w-32 aspect-[4/5] object-cover rounded-lg bg-white shadow-md ring-1 ring-black/5 flex-shrink-0" />
                  ) : (
                     <div className="w-20 sm:w-32 aspect-[4/5] bg-[var(--color-primary-container)] text-[var(--color-primary)] rounded-lg flex items-center justify-center shadow-inner flex-shrink-0">
                       <span className="material-symbols-outlined text-3xl sm:text-4xl">description</span>
                     </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm text-[var(--color-primary)] font-black flex items-start sm:items-center m-0 uppercase tracking-widest break-words leading-tight">
                      <span className="material-symbols-outlined mr-2 text-[1.2rem] flex-shrink-0 shrink-0 relative top-[2px] sm:top-0">check_circle</span> 
                      <span>Diseño Cargado</span>
                    </p>
                    <p className="text-[11px] sm:text-xs text-[var(--color-on-surface-variant)] mt-2 leading-relaxed">Este archivo se enviará a producción con tu pedido.</p>
                  </div>
                </div>
              )}
           </div>
        </div>

        {/* Personalization Toggle */}
        {selectedCategory && availableSizesForCategory.length > 0 && !noSizesMode && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4 bg-[var(--color-surface-container-low)] p-4 rounded-lg">
              <div>
                <span className="font-bold block">¿Llevan Nombre y/o Número individual?</span>
                <span className="text-xs text-[var(--color-on-surface-variant)]">Estampados dorsales personalizados</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={hasPersonalization} onChange={() => setHasPersonalization(!hasPersonalization)} />
                <div className="w-11 h-6 bg-[var(--color-outline-variant)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[var(--color-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            {hasPersonalization ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">Lista de Nombres (Plantel)</h4>
                  <span className="text-xs bg-[var(--color-surface-container-high)] px-3 py-1 rounded-full font-bold">{persons.length} prendas añadidas</span>
                </div>
                
                <div className="flex flex-col lg:grid lg:grid-cols-[1fr_350px] gap-6 items-start">
                  
                  {/* List of Persons with Scroll (Appears second on mobile, left on desktop) */}
                  <div className="order-2 lg:order-1 overflow-hidden bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/20 shadow-sm w-full">
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[var(--color-surface-container-high)] z-10">
                          <tr className="border-b border-[var(--color-outline-variant)]/20">
                            <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Talle</th>
                            {!isShorts && <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Nombre</th>}
                            <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)] text-center">Nº</th>
                            <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Función</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-outline-variant)]/10">
                          {persons.length === 0 ? (
                            <tr><td colSpan={5} className="text-center p-10 text-sm text-[var(--color-on-surface-variant)] italic">No cargaste prendas aún. Usá el panel de la derecha para sumar.</td></tr>
                          ) : (
                            [...persons].reverse().map(p => (
                              <tr key={p.id} className="hover:bg-[var(--color-surface-container-highest)]/50 transition-colors">
                                <td className="p-3 text-sm font-black text-[var(--color-primary)]">{p.size}</td>
                                {!isShorts && <td className="p-3 text-sm font-bold">{p.name}</td>}
                                <td className="p-3 text-sm font-headline font-black text-center text-[var(--color-primary)]">{p.number || '-'}</td>
                                <td className="p-3 text-[10px] uppercase font-bold text-[var(--color-on-surface-variant)]">{p.role || '-'}</td>
                                <td className="p-3 text-right">
                                  <button type="button" onClick={() => removePersonRow(p.id)} className="text-[var(--color-error)] hover:bg-[var(--color-error-container)] p-1.5 rounded-full transition-colors">
                                    <span className="material-symbols-outlined text-[1.2rem]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Person Interface (Appears first on mobile, right on desktop) */}
                  <div className="order-1 lg:order-2 bg-[var(--color-surface)] w-full p-5 rounded-2xl border-2 border-[var(--color-primary)]/10 shadow-lg flex flex-col gap-4 sticky top-20">
                    <h5 className="font-bold text-sm text-center uppercase tracking-tight text-[var(--color-primary)]">Sumar Prenda Individual</h5>
                    
                    <div className="space-y-4">
                       <div>
                         <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">1. Seleccioná Talle</label>
                         <div className="grid grid-cols-4 sm:grid-cols-5 md:flex md:flex-wrap justify-center gap-2">
                           {availableSizesForCategory.map(s => (
                             <button
                               key={s}
                               type="button"
                               onClick={() => setNewPersonSize(s)}
                               className={`min-w-[52px] min-h-[44px] px-2 py-2 rounded-lg border-2 font-bold transition-all text-sm ${newPersonSize === s || (!newPersonSize && s === availableSizesForCategory[0]) ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)] shadow-md' : 'border-[var(--color-outline-variant)]/10 hover:border-[var(--color-primary)]/30 bg-[var(--color-surface-container-lowest)]'}`}
                             >
                               {s}
                             </button>
                           ))}
                         </div>
                       </div>

                       {!isShorts && (
                         <div>
                           <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest">2. Nombre a Estampar</label>
                           <input id="new-person-name" type="text" className="input-field h-14 md:h-12 text-center font-bold text-lg md:text-base" placeholder="NOMBRE" value={newPersonName} onChange={e => setNewPersonName(e.target.value.toUpperCase())} />
                           {selectedCategory === 'Unisex' && (
                             <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-1">Nombre opcional para prendas Unisex.</p>
                           )}
                         </div>
                       )}
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                          <div className="col-span-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">{isShorts ? '2.' : '3.'} Número</label>
                            <input type="tel" inputMode="numeric" maxLength={3} className="input-field h-14 md:h-12 text-center font-headline font-black text-2xl md:text-xl px-1 sm:px-2" placeholder="10" value={newPersonNumber} onChange={e => setNewPersonNumber(e.target.value)} />
                          </div>
                          <div className="col-span-1 border-[var(--color-outline-variant)]">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">{isShorts ? '3.' : '4.'} Cantidad</label>
                            <select className="input-field h-14 md:h-12 text-center font-bold text-lg md:text-base cursor-pointer !pr-2 font-headline" style={{ textAlignLast: 'center' }} value={newPersonQuantity} onChange={e => setNewPersonQuantity(parseInt(e.target.value) || 1)}>
                              {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">{isShorts ? '4.' : '5.'} Función</label>
                            <input type="text" className="input-field h-14 md:h-12 text-sm text-center md:text-left" placeholder="Ej: Arquero" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} />
                          </div>
                        </div>

                       <button 
                        type="button" 
                        onClick={addPersonRow} 
                        disabled={!isShorts && selectedCategory !== 'Unisex' && !newPersonName.trim()} 
                        className="btn w-full bg-[var(--color-primary)] text-[var(--color-on-primary)] font-black py-4 rounded-xl shadow-lg hover:shadow-[0_0_20px_var(--color-primary-container)] disabled:opacity-50 transition-all mt-2"
                        style={{ background: 'linear-gradient(135deg, var(--color-primary), #00a05a)' }}
                       >
                        AGREGAR A LA LISTA
                        <span className="material-symbols-outlined">add_circle</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-bold text-sm mb-4">{noSizesMode ? 'Cantidad' : 'Cantidades por Talle'}</h4>
                {noSizesMode ? (
                  <div className="max-w-xs bg-[var(--color-surface-container-lowest)] p-4 rounded-xl border border-[var(--color-outline-variant)]/20 shadow-sm">
                    <label className="font-label text-xs uppercase tracking-widest text-[var(--color-on-surface-variant)] block mb-2">Unidades</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      min="0"
                      className="input-field text-center font-bold text-lg p-3 h-14 w-full"
                      value={singleQuantity}
                      onChange={e => setSingleQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className={`grid gap-3 ${(productName.includes('pantal') || sizeGrid.length > 10) ? 'grid-cols-[repeat(auto-fill,minmax(72px,1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(60px,1fr))]'} justify-center sm:justify-start`}>
                      {sizeGrid.map(sg => (
                        <div key={sg.size} className={`flex flex-col items-center bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-outline-variant)]/20 shadow-sm hover:border-[var(--color-primary)]/50 transition-all ${(productName.includes('pantal') || sizeGrid.length > 10) ? 'py-3 px-2 w-[68px]' : 'py-2 px-2 w-[68px]'}`}>
                          <span className={`font-headline font-black text-[var(--color-on-surface)] mb-2 px-2 py-1.5 bg-gray-100 rounded-md whitespace-nowrap text-center w-full block ${(productName.includes('pantal') || sizeGrid.length > 10) ? 'text-sm' : 'text-base min-w-[32px]'}`}>{sg.size}</span>
                          <select 
                            className="input-field text-center font-bold text-lg p-1 sm:p-2 w-full appearance-none m-0 rounded-lg cursor-pointer !pr-2 bg-white"
                            style={{ textAlignLast: 'center' }}
                            value={sg.quantity}
                            onChange={e => handleGridChange(sg.size, parseInt(e.target.value) || 0)}
                          >
                            {Array.from({ length: 100 }, (_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    {/* Total automático */}
                    <div className="bg-[var(--color-primary-container)] border-2 border-[var(--color-primary)] rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-[var(--color-primary)]">TOTAL PRENDAS:</span>
                      <span className="font-headline font-black text-2xl text-[var(--color-primary)]">{sizeGrid.reduce((sum, sg) => sum + (sg.quantity || 0), 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Excepciones General */}
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[var(--color-outline-variant)]/20">
          <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">
            OBSERVACIONES / EXCEPCIONES PARA ESTE TIPO DE PRENDA
          </label>
          <textarea 
            className="input-field resize-none" 
            rows={2} 
            placeholder="Ej: El arquero (L) lleva el buzo en otro color."
            value={observations}
            onChange={e => setObservations(e.target.value)}
          ></textarea>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between sm:items-center gap-4 mt-10 pt-6 border-t border-[var(--color-outline-variant)]/20">
          <button type="button" onClick={onCancel} className="btn text-[var(--color-on-surface-variant)] font-bold w-full sm:w-auto">Descartar</button>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button type="submit" className="btn btn-primary shadow-xl w-full sm:w-auto justify-center" style={{ background: 'linear-gradient(135deg, #00c06a, #00a05a)' }}>
              {initialData ? 'Guardar Cambios' : 'Confirmar Prenda al Pedido'}
              <span className="material-symbols-outlined text-sm">{initialData ? 'check_circle' : 'add_task'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
