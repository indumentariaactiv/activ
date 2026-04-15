import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import logo from '../../assets/logo.png';

const AdminOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, name, status, created_at, confirmed_at, client_id,
          profiles (name, team_name),
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
      setOrder(data);
    } catch (err: any) {
      console.error("Error detallado en AdminOrderDetails:", err);
      alert(`Error cargando pedido: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    const loadingToast = toast.loading('Actualizando estado...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      
      setOrder((prev: any) => ({ ...prev, status: newStatus }));
      toast.success('Estado actualizado correctamente', { id: loadingToast });
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(`Error al actualizar estado: ${err.message || 'Error desconocido'}`, { id: loadingToast });
    }
  };

  const finalizeOrder = async () => {
    if (!window.confirm("¿Seguro que deseas marcar el pedido como FINALIZADO? Esta acción indica que el pedido ya fue entregado.")) return;
    await updateOrderStatus('delivered');
  };

  const exportToExcel = () => {
    if (!order) return;
    const wb = utils.book_new();
    
    let summaryData: any[] = [];
    const clientName = (order.profiles?.team_name || order.profiles?.name || '').toUpperCase();
    
    summaryData.push(['ALTIV - FICHA DE PRODUCCIÓN GLOBAL']);
    summaryData.push(['CLIENTE:', clientName, '', 'FECHA:', new Date().toLocaleDateString(), '', 'PEDIDO:', order.name.toUpperCase()]);
    summaryData.push([]);

    const usedSizesOnly = dynamicSizes.filter(size => {
      return order.order_items.some((item: any) => {
        if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
        return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
      });
    });

    summaryData.push(['RESUMEN DE PRENDAS Y TALLES']);
    summaryData.push(['Prenda / Categoría', ...usedSizesOnly, 'TOTAL']);

    order.order_items.forEach((item: any) => {
      let totalRow = 0;
      const row = [`${item.garment_types?.name} ${item.category}`.toUpperCase()];
      
      usedSizesOnly.forEach(size => {
        let qty = 0;
        if (item.has_personalization) {
          qty = item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
        } else {
          qty = item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
        }
        row.push(qty ? String(qty) : '');
        totalRow += qty;
      });
      row.push(String(totalRow));
      summaryData.push(row);
    });

    summaryData.push([]);
    summaryData.push(['LISTADO DE PERSONALIZACIÓN COMPLETO']);
    summaryData.push(['PRENDA', 'TALLE', 'NOMBRE', 'NÚMERO']);

    order.order_items.filter((item: any) => item.has_personalization).forEach((item: any) => {
      item.order_item_persons.forEach((p: any) => {
        summaryData.push([(item.garment_types?.name || '').toUpperCase(), (item.category || '').toUpperCase(), p.size, p.person_name || '', p.person_number || 'S/N']);
      });
    });

    const wsSummary = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, wsSummary, "RESUMEN GENERAL");

    order.order_items.forEach((item: any, idx: number) => {
      let itemData: any[] = [];
      itemData.push([`FICHA TÉCNICA DETALLADA: ${(item.garment_types?.name || '').toUpperCase()}`]);
      itemData.push(['CATEGORÍA:', (item.category || '').toUpperCase()]);
      itemData.push([]);
      
      itemData.push(['ESPECIFICACIONES']);
      itemData.push(['TELA:', item.fabric_type || 'SET', 'CUELLO:', item.collar_type || 'RIBB', 'SISA:', item.armhole_color || 'AL CUELLO']);
      itemData.push(['BASE:', item.base_color || '-', 'MANGAS:', item.sleeve_type || '-', 'COLOR MANGAS:', item.sleeve_color || '-']);
      itemData.push([]);
      
      const itemSizes = dynamicSizes.filter(size => {
        if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
        return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
      });

      itemData.push(['DISTRIBUCIÓN DE TALLES']);
      itemData.push(['TALLE', 'CANTIDAD']);
      let totalQty = 0;
      itemSizes.forEach(size => {
        let qty = 0;
        if (item.has_personalization) {
          qty = item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
        } else {
          qty = item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
        }
        itemData.push([size, qty]);
        totalQty += qty;
      });
      itemData.push(['TOTAL', totalQty]);
      itemData.push([]);

      if (item.has_personalization) {
        itemData.push(['LISTADO DE JUGADORES (PERSONALIZADO)']);
        itemData.push(['TALLE', 'NOMBRE', 'NÚMERO']);
        item.order_item_persons.forEach((p: any) => {
          itemData.push([p.size, p.person_name, p.person_number || '']);
        });
      }

      const wsItem = utils.aoa_to_sheet(itemData);
      utils.book_append_sheet(wb, wsItem, `PRENDA ${idx + 1}`);
    });

    writeFile(wb, `ORDEN_ALTIV_${order.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportToPDF = async () => {
    if (!order) return;
    
    // Helper to convert URL to base64
    const getBase64ImageFromUrl = async (imageUrl: string) => {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(reader.result as string), false);
          reader.addEventListener("error", () => reject(), false);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Error loading image for PDF:", e);
        return null;
      }
    };

    try {
      const doc = new jsPDF('l', 'mm', 'a4'); 
      
      const usedSizesOnly = dynamicSizes.filter(size => {
        return order.order_items.some((item: any) => {
          if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
          return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
        });
      });

      const totalGarments = order.order_items.reduce((acc: number, item: any) => {
        if (item.has_personalization) return acc + (item.order_item_persons?.length || 0);
        return acc + (item.order_item_sizes?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0);
      }, 0);

      // Header Global
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.rect(14, 10, 80, 15);
      doc.text(order.profiles?.team_name?.toUpperCase() || order.profiles?.name?.toUpperCase() || 'CLIENTE', 54, 20, { align: 'center' });
      
      doc.rect(94, 10, 110, 15);
      const logoData = await getBase64ImageFromUrl(logo);
      if (logoData) {
        doc.addImage(logoData, 'PNG', 134, 11, 30, 13);
      } else {
        doc.text('ALTIV PRODUCTION SHEET', 149, 20, { align: 'center' });
      }
      
      doc.rect(204, 10, 40, 15);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleDateString(), 224, 20, { align: 'center' });
      
      doc.setFillColor(0, 89, 187); // ALTIV Blue
      doc.rect(244, 10, 40, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text(String(totalGarments), 264, 21, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Summary Table
      const tableHead = [['Prendas / Talles', ...usedSizesOnly, 'Totales']];
      const tableBody = order.order_items.map((item: any) => {
        let totalRow = 0;
        const row = [`${item.garment_types?.name || 'Prenda'} ${item.category}`.toUpperCase()];
        usedSizesOnly.forEach(size => {
          let qty = 0;
          if (item.has_personalization) {
            qty = item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
          } else {
            qty = item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
          }
          row.push(qty ? String(qty) : '');
          totalRow += qty;
        });
        row.push(String(totalRow));
        return row;
      });

      autoTable(doc, {
        startY: 30,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 } }
      });

      let currentY = ((doc as any).lastAutoTable?.finalY || 40) + 15;

      // Per Garment Sheets
      for (const [idx, item] of order.order_items.entries()) {
        if (currentY > 160) { doc.addPage('l'); currentY = 20; }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 89, 187);
        doc.text(`item ${idx + 1}: ${item.garment_types?.name || ''} - ${item.category}`.toUpperCase(), 14, currentY);
        doc.setTextColor(0, 0, 0);

        // Details Table - NOW INCLUDES MANGAS & BASE
        const specs = [
          ['BASE', item.base_color || '-', 'TELA', item.fabric_type || 'SET', 'CUELLO', item.collar_type || 'RIBB'],
          ['MANGAS', item.sleeve_type || '-', 'COLOR MANGAS', item.sleeve_color || '-', 'SISA', item.armhole_color || 'AL CUELLO']
        ];
        
        autoTable(doc, {
          startY: currentY + 2,
          body: specs,
          theme: 'grid',
          tableWidth: 200, // Constrain width to avoid overlap with image on the right
          styles: { fontSize: 8, cellPadding: 2, fontStyle: 'bold' },
          columnStyles: { 
            0: { fillColor: [240, 240, 240], cellWidth: 25 },
            2: { fillColor: [240, 240, 240], cellWidth: 25 },
            4: { fillColor: [240, 240, 240], cellWidth: 25 }
          }
        });
        
        let tableFinalY = (doc as any).lastAutoTable?.finalY || currentY;

        // Image Attachment
        if (item.custom_design_url || item.designs?.image_url) {
          const imgData = await getBase64ImageFromUrl(item.custom_design_url || item.designs?.image_url);
          if (imgData) {
            // Place image to the right of the specs or below if too large
            try {
              doc.addImage(imgData, 'JPEG', 215, currentY - 5, 40, 50);
              doc.setFontSize(7);
              doc.text("DISEÑO ADJUNTO", 235, currentY + 47, { align: 'center' });
            } catch (e) {
              console.warn("Failed to add image to PDF:", e);
            }
          }
        }

        currentY = tableFinalY + 5;

        // Sizes/Persons List
        if (item.has_personalization && item.order_item_persons?.length > 0) {
          const personsData = item.order_item_persons.map((p: any) => [p.size, p.person_name, p.person_number || '']);
          autoTable(doc, {
            startY: currentY,
            head: [['Talle', 'Nombre', 'Número']],
            body: personsData,
            theme: 'striped',
            margin: { right: 100 }, // Space for image
            styles: { fontSize: 7 }
          });
          currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;
        } else {
          // Summary of sizes for non-personalized
          const itemSizes = dynamicSizes.filter(size => item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0));
          const sizeRowHead = ['Talle', ...itemSizes];
          const sizeRowData = ['Cant.', ...itemSizes.map(size => String(item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0))];

          autoTable(doc, {
            startY: currentY,
            head: [sizeRowHead],
            body: [sizeRowData],
            theme: 'grid',
            margin: { right: 100 },
            styles: { fontSize: 7, halign: 'center' },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
          });
          currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 15;
        }

        if (item.notes) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(`NOTAS: ${item.notes}`, 14, currentY - 10);
        }
      }

      doc.save(`PRODUCCION_ALTIV_${order.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Error al generar el PDF. Revisa la consola.");
    }
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

      // AUTOMATION: If status is 'confirmed', move to 'in_production'
      if (order?.status === 'confirmed') {
        await updateOrderStatus('in_production');
      }
    } catch (err) {
      console.error(err);
      alert('Error al actualizar ficha técnica');
    }
  };

  if (loading) return <div className="p-12 text-center animate-pulse font-headline">Cargando pedido...</div>;
  if (!order) return <div className="p-12 text-center">Pedido no encontrado.</div>;

  return (
    <div className="max-w-[95%] mx-auto pb-[100px]">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--color-primary)] text-sm font-bold flex items-center hover:underline">
          <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
          Volver al Panel
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] mb-2 block">Módulo de Producción Alta Gama</span>
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-[var(--color-on-surface)] leading-none">
            {order.name}
          </h1>
          <p className="text-xl text-[var(--color-on-surface-variant)] mt-2 font-medium">Cliente: <span className="text-[var(--color-on-surface)]">{order.profiles?.team_name || order.profiles?.name}</span></p>
        </div>
        <div className="flex flex-wrap gap-3">
          {order.status !== 'delivered' && (
            <button onClick={finalizeOrder} className="btn bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7] border text-xs px-4 py-2 hover:bg-[#2e7d32] hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Finalizar Pedido
            </button>
          )}
          <button onClick={exportToExcel} className="btn btn-secondary text-xs px-4 py-2">
            <span className="material-symbols-outlined text-sm">table_view</span>
            Excel
          </button>
          <button onClick={exportToPDF} className="btn btn-primary text-xs px-4 py-2">
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            PDF
          </button>
        </div>
      </div>

      {/* Timeline Tracker */}
      <div className="card p-0 overflow-hidden mb-12 border border-[var(--color-outline-variant)]/20 shadow-none">
        <div className="flex w-full">
            {[
                { key: 'confirmed', label: '1. RECIBIDO', icon: 'inbox' },
                { key: 'in_production', label: '2. PRODUCCIÓN', icon: 'settings' },
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      {item.order_item_persons.map((p: any, pIdx: number) => (
                        <tr key={pIdx} className="hover:bg-[var(--color-primary-container)]/5 transition-colors">
                          <td className="p-3 font-headline font-black text-xl text-[var(--color-primary)] bg-[var(--color-surface-container-lowest)] border-r border-[var(--color-outline-variant)]/10 w-20 text-center">
                            {p.person_number || '—'}
                          </td>
                          <td className="p-3 font-bold text-sm w-24 text-center border-r border-[var(--color-outline-variant)]/10">
                            <span className="bg-[var(--color-surface-container-high)] px-3 py-1 rounded-full">{p.size}</span>
                          </td>
                          <td className="p-3 font-headline font-extrabold text-lg uppercase tracking-tight text-[var(--color-on-surface)]">
                            {p.person_name}
                          </td>
                        </tr>
                      ))}
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
    </div>
  );
};

export default AdminOrderDetails;
