import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

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
  onSave: (garment: GarmentData) => void;
  onCancel: () => void;
}

export const GarmentForm: React.FC<GarmentFormProps> = ({ initialData, onSave, onCancel }) => {
  const [types, setTypes] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  
  const [selectedTypeId, setSelectedTypeId] = useState(initialData?.garment_type_id || '');
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || '');
  
  const [baseColor] = useState(initialData?.base_color || '');
  const [sleeveType, setSleeveType] = useState(initialData?.sleeve_type || '');
  const [sleeveColor] = useState(initialData?.sleeve_color || '');
  // Removed fabric, collar, armhole from Client view (Admin sets these)
  
  const [designMode, setDesignMode] = useState<'upload' | 'gallery'>('upload');
  const [selectedDesignId, setSelectedDesignId] = useState(initialData?.design_id || '');
  const [customDesignUrl, setCustomDesignUrl] = useState(initialData?.custom_design_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPersonalization, setHasPersonalization] = useState(initialData?.has_personalization || false);
  const [observations, setObservations] = useState(initialData?.observations || '');
  
  const [sizeGrid, setSizeGrid] = useState<SizeQuantity[]>(initialData?.sizes || []);
  const [persons, setPersons] = useState<PersonRow[]>(initialData?.persons || []);

  useEffect(() => {
    const fetchMaestros = async () => {
      try {
        console.log("GarmentForm - Init fetching masters...");
        
        // 1. Fetch Garment Types
        const { data: gData, error: gError } = await supabase
          .from('garment_types')
          .select('*')
          .order('name');
        
        if (gError) {
          console.error("GarmentForm - Error fetching garment_types:", gError.message, gError.details);
          // Don't throw, we have fallbacks below
        }

        if (gData && gData.length > 0) {
          console.log(`GarmentForm - Loaded ${gData.length} types from DB.`);
          setTypes(gData);
        } else {
          console.warn("GarmentForm - No types found in DB or access denied. Using industrial fallbacks.");
          setTypes([
            { id: '00000000-0000-0000-0000-000000000001', name: 'Remera Deportiva', categories: { 'Hombre': ['S', 'M', 'L', 'XL', 'XXL'], 'Mujer': ['XS', 'S', 'M', 'L', 'XL'], 'Niño': ['8', '10', '12', '14', '16'] } },
            { id: '00000000-0000-0000-0000-000000000002', name: 'Short', categories: { 'Hombre': ['S', 'M', 'L', 'XL'], 'Mujer': ['XS','S', 'M', 'L'], 'Niño': ['10', '12', '14'] } },
            { id: '00000000-0000-0000-0000-000000000003', name: 'Pantalón Largo', categories: { 'Hombre': ['S', 'M', 'L', 'XL'], 'Mujer': ['S', 'M', 'L'], 'Niño': ['10', '12', '14'] } }
          ]);
        }

        // 2. Fetch Designs Gallery
        const { data: dData, error: dError } = await supabase
          .from('designs')
          .select('*')
          .eq('active', true);
          
        if (dError) {
          console.error("GarmentForm - Error fetching designs catalog:", dError.message);
        }
        
        if (dData) {
          console.log(`GarmentForm - Loaded ${dData.length} designs.`);
          setGallery(dData);
        }
      } catch (err: any) {
        console.error("GarmentForm - Unexpected execution error:", err.message || err);
      }
    };
    
    fetchMaestros();
  }, []);

  // When type or category changes, reset grids if no initial data
  useEffect(() => {
    if (!initialData && selectedTypeId && selectedCategory) {
      const typeObj = types.find(t => t.id === selectedTypeId);
      if (typeObj && typeObj.categories[selectedCategory]) {
        const availableSizes = typeObj.categories[selectedCategory] as string[];
        setSizeGrid(availableSizes.map(s => ({ size: s, quantity: 0 })));
      }
    }
  }, [selectedTypeId, selectedCategory, types, initialData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('custom_designs').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('custom_designs').getPublicUrl(filePath);
      setCustomDesignUrl(data.publicUrl);
    } catch (error: any) {
      console.error(error);
      alert(`Error al subir archivo: ${error.message || "Verifica tu conexión y reintentá."}`);
    } finally {
      setUploading(false);
    }
  };

  const handleGridChange = (size: string, val: number) => {
    setSizeGrid(prev => prev.map(item => item.size === size ? { ...item, quantity: val } : item));
  };

  const currentTypeObj = types.find(t => t.id === selectedTypeId);
  const availableSizesForCategory = currentTypeObj && selectedCategory ? (currentTypeObj.categories[selectedCategory] as string[]) : [];

  const [newPersonSize, setNewPersonSize] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonNumber, setNewPersonNumber] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonQuantity, setNewPersonQuantity] = useState(1);

  const addPersonRow = () => {
    if (!newPersonName.trim()) return;
    
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
    onSave({
      id: initialData?.id || Date.now().toString(),
      garment_type_id: selectedTypeId,
      garment_type_name: currentTypeObj?.name || '',
      category: selectedCategory,
      base_color: baseColor,
      sleeve_type: sleeveType,
      sleeve_color: sleeveColor,
      has_personalization: hasPersonalization,
      design_id: designMode === 'gallery' ? selectedDesignId : undefined,
      design_image_url: designMode === 'gallery' ? gallery.find(d => d.id === selectedDesignId)?.image_url : undefined,
      custom_design_url: designMode === 'upload' ? customDesignUrl : undefined,
      observations,
      sizes: hasPersonalization ? [] : sizeGrid,
      persons: hasPersonalization ? persons : []
    });
  };

  const isRemera = currentTypeObj && currentTypeObj.name.toLowerCase().includes('remera');

  return (
    <div className="card p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 border-2 border-[var(--color-primary)]/20 shadow-lg relative">
      <h3 className="font-headline text-xl font-bold mb-6 border-b border-[var(--color-outline-variant)]/20 pb-4 flex justify-between items-center">
        {initialData ? 'Editar Prenda' : 'Configurador de Prenda'}
        {initialData && <span className="bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] uppercase font-bold px-2 py-1 rounded">Edición</span>}
      </h3>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Basic Selections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Tipo de Prenda</label>
            <select className="input-field" required value={selectedTypeId} onChange={e => { setSelectedTypeId(e.target.value); setSelectedCategory(''); }}>
              <option value="" disabled>Seleccione prenda...</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Género / Contextura</label>
            <select className="input-field" required disabled={!selectedTypeId} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="" disabled>Seleccione...</option>
              {currentTypeObj && Object.keys(currentTypeObj.categories).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Technical Attributes - HIDDEN FOR CLIENT per request */}
        {/*
        <div className="flex flex-col gap-4 bg-[var(--color-surface-container-lowest)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
          ...
        </div>
        */}

        {isRemera && (
          <div className="flex flex-col gap-2 bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/10">
            <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Tipo de Manga</label>
            <div className="flex flex-wrap gap-2">
              {['Manga Corta', 'Manga Larga', 'Sin Mangas'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSleeveType(type)}
                  className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition-all ${sleeveType === type ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 text-[var(--color-primary)]' : 'border-[var(--color-outline-variant)]/20 hover:border-[var(--color-outline-variant)]'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Design Upload / Gallery */}
        <div className="flex flex-col gap-4 p-5 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-primary)]/10">
           <label className="font-label text-xs uppercase font-bold text-[var(--color-on-surface-variant)] tracking-wider">Diseño a usar</label>
           
           <div className="flex gap-2 mb-2 p-1 bg-[var(--color-surface-container-high)] rounded-lg self-start">
             <button type="button" onClick={() => setDesignMode('upload')} className={`px-4 py-1 text-xs font-bold rounded-md transition-colors ${designMode === 'upload' ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow' : 'text-[var(--color-on-surface-variant)]'}`}>Subir Archivo</button>
             <button type="button" onClick={() => setDesignMode('gallery')} className={`px-4 py-1 text-xs font-bold rounded-md transition-colors ${designMode === 'gallery' ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow' : 'text-[var(--color-on-surface-variant)]'}`}>Catálogo Admin</button>
           </div>

           {designMode === 'upload' ? (
             <div className="flex flex-col gap-3">
                <input type="file" accept="image/*,.pdf" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn bg-[var(--color-surface-container-highest)] text-sm px-4 whitespace-nowrap w-full md:w-auto">
                    <span className="material-symbols-outlined">{uploading ? 'hourglass_empty' : 'upload_file'}</span>
                    {uploading ? 'Subiendo...' : 'Seleccionar PC/Móvil'}
                  </button>
                </div>
                
                {customDesignUrl && (
                  <div className="mt-2 bg-[var(--color-surface-container-lowest)] border p-2 rounded-lg flex items-center gap-4 animate-in fade-in zoom-in-95">
                    {customDesignUrl.match(/\.(jpeg|jpg|gif|png)$/i) || customDesignUrl.includes("supabase.co") ? (
                      <img src={customDesignUrl} alt="Preview" className="w-16 aspect-[4/5] object-contain rounded bg-white shadow-sm ring-1 ring-black/5" />
                    ) : (
                       <div className="w-16 aspect-[4/5] bg-[var(--color-primary-container)] text-[var(--color-primary)] rounded flex items-center justify-center">
                         <span className="material-symbols-outlined text-xl">description</span>
                       </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-primary)] font-bold flex items-center m-0">
                        <span className="material-symbols-outlined mr-1 text-[1rem]">check_circle</span> Diseño Listo
                      </p>
                      <a href={customDesignUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--color-on-surface-variant)] hover:underline truncate block w-full">{customDesignUrl}</a>
                    </div>
                  </div>
                )}
             </div>
           ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2">
                {gallery.filter(d => d.garment_type_id === selectedTypeId).length === 0 ? (
                  <p className="text-xs text-[var(--color-on-surface-variant)] col-span-full">
                    {selectedTypeId ? 'No hay diseños específicos en el catálogo para esta prenda.' : 'Selecciona un tipo de prenda para ver el catálogo.'}
                  </p>
                ) : (
                  gallery.filter(d => d.garment_type_id === selectedTypeId).map(d => (
                    <div key={d.id} onClick={() => setSelectedDesignId(d.id)} className={`group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${selectedDesignId === d.id ? 'border-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary-container)]' : 'border-transparent hover:border-[var(--color-outline-variant)] bg-[var(--color-surface)]'}`}>
                      <div className="aspect-[4/5] bg-white flex items-center justify-center">
                        <img src={d.image_url} alt={d.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="p-1 px-2 text-center bg-[var(--color-surface-container-highest)] border-t border-[var(--color-outline-variant)]/10">
                        <span className="text-[9px] font-black uppercase tracking-tighter block truncate">{d.name}</span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           )}
        </div>

        {/* Personalization Toggle */}
        {selectedCategory && availableSizesForCategory.length > 0 && (
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
                
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
                  {/* List of Persons with Scroll */}
                  <div className="overflow-hidden bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/20 shadow-sm">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[var(--color-surface-container-high)] z-10">
                          <tr className="border-b border-[var(--color-outline-variant)]/20">
                            <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Talle</th>
                            <th className="p-3 font-label text-[10px] uppercase font-black tracking-widest text-[var(--color-on-surface-variant)]">Nombre</th>
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
                                <td className="p-3 text-sm font-bold">{p.name}</td>
                                <td className="p-3 text-sm font-headline font-black text-center">{p.number || '-'}</td>
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

                  {/* Add Person Interface */}
                  <div className="bg-[var(--color-surface)] p-5 rounded-2xl border-2 border-[var(--color-primary)]/10 shadow-lg flex flex-col gap-4 sticky top-20">
                    <h5 className="font-bold text-sm text-center uppercase tracking-tight text-[var(--color-primary)]">Sumar Prenda Individual</h5>
                    
                    <div className="space-y-4">
                       <div>
                         <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">1. Seleccioná Talle</label>
                         <div className="flex flex-wrap justify-center gap-2">
                           {availableSizesForCategory.map(s => (
                             <button
                               key={s}
                               type="button"
                               onClick={() => setNewPersonSize(s)}
                               className={`min-w-[50px] py-2 rounded-lg border-2 font-bold transition-all text-xs ${newPersonSize === s || (!newPersonSize && s === availableSizesForCategory[0]) ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary)] shadow-md' : 'border-[var(--color-outline-variant)]/10 hover:border-[var(--color-primary)]/30 bg-[var(--color-surface-container-lowest)]'}`}
                             >
                               {s}
                             </button>
                           ))}
                         </div>
                       </div>

                       <div>
                         <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest">2. Nombre a Estampar</label>
                         <input id="new-person-name" type="text" className="input-field text-center font-bold" placeholder="NOMBRE" value={newPersonName} onChange={e => setNewPersonName(e.target.value.toUpperCase())} />
                         <div className="grid grid-cols-3 gap-3 mt-4">
                          <div className="col-span-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">3. Número</label>
                            <input type="text" className="input-field text-center font-headline font-black text-xl" placeholder="10" value={newPersonNumber} onChange={e => setNewPersonNumber(e.target.value)} />
                          </div>
                          <div className="col-span-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">4. Cantidad</label>
                            <input type="number" min="1" className="input-field text-center font-bold" value={newPersonQuantity} onChange={e => setNewPersonQuantity(parseInt(e.target.value) || 1)} />
                          </div>
                          <div className="col-span-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-on-surface-variant)] mb-2 block tracking-widest text-center">5. Función</label>
                            <input type="text" className="input-field text-[10px] h-[52px]" placeholder="Ej: Arquero" value={newPersonRole} onChange={e => setNewPersonRole(e.target.value)} />
                          </div>
                        </div>
                       </div>

                       <button 
                        type="button" 
                        onClick={addPersonRow} 
                        disabled={!newPersonName.trim()} 
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
                <h4 className="font-bold text-sm mb-4">Cantidades por Talle</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {sizeGrid.map(sg => (
                    <div key={sg.size} className="flex flex-col items-center bg-[var(--color-surface-container-lowest)] p-3 rounded-xl border border-[var(--color-surface-container-high)] shadow-sm hover:border-[var(--color-primary)]/30 transition-all">
                      <span className="font-headline font-extrabold text-lg bg-[var(--color-surface-container-high)] w-10 h-10 rounded-full flex items-center justify-center mb-2">{sg.size}</span>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field text-center font-bold text-lg p-2 max-w-[80px]"
                        value={sg.quantity || ''}
                        onChange={e => handleGridChange(sg.size, parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
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

        <div className="flex justify-between items-center gap-3 mt-10 pt-6 border-t border-[var(--color-outline-variant)]/20">
          <button type="button" onClick={onCancel} className="btn text-[var(--color-on-surface-variant)] font-bold">Descartar</button>
          
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary shadow-xl" style={{ background: 'linear-gradient(135deg, #00c06a, #00a05a)' }}>
              {initialData ? 'Guardar Cambios' : 'Terminar y Continuar'}
              <span className="material-symbols-outlined text-sm">check_circle</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
