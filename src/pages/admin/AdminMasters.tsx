import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface CategorySizes {
  [key: string]: string[];
}

interface GarmentType {
  id: string;
  name: string;
  categories: CategorySizes;
}

const AdminMasters = () => {
  const [types, setTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<GarmentType | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<CategorySizes>({ 'Hombre': ['S', 'M', 'L', 'XL'], 'Mujer': ['S', 'M', 'L'], 'Niño': ['10', '12', '14'] });

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('garment_types').select('*').order('name');
      if (error) throw error;
      setTypes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (type?: GarmentType) => {
    if (type) {
      setEditingType(type);
      setName(type.name);
      setCategories(type.categories);
    } else {
      setEditingType(null);
      setName('');
      setCategories({ 'Hombre': ['S', 'M', 'L', 'XL'], 'Mujer': ['S', 'M', 'L'], 'Niño': ['10', '12', '14'] });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, categories };

    try {
      if (editingType) {
        const { error } = await supabase.from('garment_types').update(payload).eq('id', editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('garment_types').insert(payload);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchTypes();
    } catch (err) {
      alert("Error al guardar tipo de prenda");
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar este tipo de prenda?")) return;
    try {
      const { error } = await supabase.from('garment_types').delete().eq('id', id);
      if (error) throw error;
      fetchTypes();
    } catch (err) {
      alert("Error al eliminar. Puede que existan pedidos asociados a este tipo.");
    }
  };

  const updateCategorySizes = (cat: string, sizesStr: string) => {
    const sizes = sizesStr.split(',').map(s => s.trim()).filter(s => s !== '');
    setCategories(prev => ({ ...prev, [cat]: sizes }));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="font-headline text-[var(--color-primary)] font-extrabold tracking-tighter uppercase text-sm mb-2">
            Administración del Sistema
          </p>
          <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight text-[var(--color-on-surface)] leading-none">
            Maestros de Prendas
          </h1>
          <p className="text-[var(--color-on-surface-variant)] mt-2 font-medium">Configura los tipos de indumentaria y talles disponibles.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary shadow-lg hover:shadow-[0_0_20px_var(--color-primary-container)]">
          <span className="material-symbols-outlined">add_circle</span>
          Nuevo Tipo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20 animate-pulse text-[var(--color-primary)] font-black">Cargando maestros...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {types.map(type => (
            <div key={type.id} className="card p-6 border-t-4 border-t-[var(--color-primary)] hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-headline text-xl font-bold group-hover:text-[var(--color-primary)] transition-colors">{type.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => handleOpenModal(type)} className="p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-primary-container)]/10 hover:text-[var(--color-primary)] rounded-full transition-all">
                    <span className="material-symbols-outlined text-[1.2rem]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(type.id)} className="p-2 text-[var(--color-error)] hover:bg-[var(--color-error-container)] rounded-full transition-all">
                    <span className="material-symbols-outlined text-[1.2rem]">delete</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {Object.entries(type.categories).map(([cat, sizes]) => (
                  <div key={cat} className="bg-[var(--color-surface-container-high)] p-2 rounded-lg">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] block mb-1">{cat}</span>
                    <div className="flex flex-wrap gap-1">
                      {sizes.map(s => <span key={s} className="bg-white px-2 py-0.5 rounded text-[10px] font-bold border border-[var(--color-outline-variant)]/10">{s}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[var(--color-outline-variant)]/20">
            <div className="p-6 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline-variant)]/20 flex justify-between items-center">
              <h2 className="font-headline text-xl font-black uppercase tracking-tight">
                {editingType ? 'Editar Tipo' : 'Nueva Prenda'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="material-symbols-outlined text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)]">close</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Nombre de la Prenda</label>
                <input required type="text" className="input-field font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Remera Entrenamiento" />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] block mb-2">Talles por Categoría (Separados por coma)</label>
                {['Hombre', 'Mujer', 'Niño'].map(cat => (
                  <div key={cat} className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--color-primary)]">{cat}</span>
                    <input 
                      type="text" 
                      className="input-field text-sm" 
                      value={categories[cat]?.join(', ') || ''} 
                      onChange={e => updateCategorySizes(cat, e.target.value)}
                      placeholder="S, M, L, XL..."
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn flex-1 bg-[var(--color-surface-container-highest)] text-sm font-bold">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1 shadow-lg" style={{ background: 'linear-gradient(135deg, #00c06a, #00a05a)' }}>
                  Guardar
                  <span className="material-symbols-outlined">save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMasters;
