import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoAltiv from '../../assets/logo.png';

const AdminOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState<Record<string, any>>({});
  const isMountedRef = useRef(true);

  const STANDARD_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', 'XXXXL', '5XL', 'XXXXXL', '6XL'];
  
  const getEffectiveSizes = () => {
    if (!order) return STANDARD_SIZES;
    
    const usedSizes = new Set<string>();
    order.order_items.forEach((item: any) => {
      item.order_item_sizes?.forEach((s: any) => { 
        if (s.quantity > 0 && s.size !== 'Cantidad' && s.size !== 'Cant.') {
          usedSizes.add(s.size.toString()); 
        }
      });
      item.order_item_persons?.forEach((p: any) => { 
        if (p.size !== 'Cantidad' && p.size !== 'Cant.') {
          usedSizes.add(p.size.toString()); 
        }
      });
    });

    // Strategy: Use STANDARD_SIZES as a base order, but only keep what's used or standard
    const allUsed = Array.from(usedSizes);
    const sorted = [...STANDARD_SIZES].filter(s => usedSizes.has(s) || STANDARD_SIZES.includes(s));
    
    // Add any non-standard sizes at the end
    const nonStandard = allUsed.filter(s => !STANDARD_SIZES.includes(s));
    
    return Array.from(new Set([...sorted, ...nonStandard]));
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Recibido';
      case 'in_production': return 'En Producción';
      case 'delivered': return 'Finalizado';
      default: return status;
    }
  };

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'in_production': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
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
          profiles (name, team_name, email),
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
        // FORCE REFRESH from server and await it
        await fetchOrderDetails();
      }
    }
  };

  const sendToProduction = async () => {
    if (updatingStatus) return;
    
    // Generate PDF and show preview
    const doc = await generateProductionPDF();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setShowPdfPreview(true);
  };

  const handlePreviewClick = async () => {
    const doc = await generateProductionPDF();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
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
    // Update local state immediately for UI responsiveness
    setOrder((prev: any) => ({
      ...prev,
      order_items: prev.order_items.map((item: any) => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));

    try {
      const { error } = await supabase
        .from('order_items')
        .update({ [field]: value })
        .eq('id', itemId);
      
      if (error) throw error;
    } catch (err: any) {
      console.error("Error updating item spec:", err);
      toast.error(`Error al actualizar: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleSpecChange = (itemId: string, field: string, value: string) => {
    // Just update UI state without DB call for smooth typing
    setOrder((prev: any) => ({
      ...prev,
      order_items: prev.order_items.map((item: any) => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSpecBlur = (itemId: string, field: string, value: string) => {
    // Save to DB on blur
    updateItemSpec(itemId, field, value);
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

  const getBase64Image = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error getting base64 image:", e);
      return null;
    }
  };

  const generateProductionPDF = async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const leftMargin = 40;
    const contentWidth = pageWidth - leftMargin * 2;
    
    // Helper for table header styling
    const headStyles: any = { fillColor: [0, 82, 204], textColor: 255, halign: 'center', fontStyle: 'bold', fontSize: 9 };

    // --- HEADER ---
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    
    // Header Grid (Main box)
    doc.rect(leftMargin, 40, contentWidth, 50);
    doc.line(leftMargin + 200, 40, leftMargin + 200, 90); // After Team Name
    doc.line(leftMargin + 400, 40, leftMargin + 400, 90); // After Logo
    doc.line(leftMargin + 500, 40, leftMargin + 500, 90); // Before Total

    // Date Divider
    doc.line(leftMargin + 400, 40, leftMargin + 400, 90);
    doc.line(leftMargin + 480, 40, leftMargin + 480, 90);

    // Team Name / Full Name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const shippingInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
    const clientDisplayName = shippingInfo?.full_name || order.profiles?.team_name || order.profiles?.name || 'SIN NOMBRE';
    doc.text(clientDisplayName.toUpperCase(), leftMargin + 10, 70, { maxWidth: 180 });

    // Logo (center)
    let logoData = logoAltiv;
    if (typeof logoAltiv === 'string') {
        logoData = await getBase64Image(logoAltiv);
    }

    try {
        if (logoData) {
            doc.addImage(logoData as string, 'PNG', leftMargin + 240, 48, 80, 35);
        } else {
            throw new Error("No logo data");
        }
    } catch (e) {
        doc.setFontSize(16);
        doc.text('ALTIV', leftMargin + 280, 70, { align: 'center' });
    }

    // Date (Cell)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date().toLocaleDateString('es-AR'), leftMargin + 440, 70, { align: 'center' });

    // Total Box (Exact match to image)
    doc.setFillColor(0, 82, 204); // Sturdier blue
    doc.rect(leftMargin + 480, 40, contentWidth - 480, 50, 'F');
    doc.setTextColor(255, 255, 255); // Explicit white
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    // Align center of the box: cell starts at 520, ends at 555. Center is 537.5
    doc.text(`${totalQuantity}`, 538, 72, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // --- SUMMARY TABLE ---
    const visibleSizes = dynamicSizes.filter(size =>
      order.order_items.some((item: any) =>
        item.has_personalization
          ? item.order_item_persons?.some((p: any) => p.size === size)
          : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
      )
    );

    const summaryHeaders = ['Prendas / Talles', ...visibleSizes, 'Totales'];
    
    // Grouping by garment type
    const groupedItems: Record<string, any[]> = {};
    order.order_items.forEach((item: any) => {
      const type = item.garment_types?.name || 'Otros';
      if (!groupedItems[type]) groupedItems[type] = [];
      groupedItems[type].push(item);
    });

    const summaryData: any[] = [];
    Object.entries(groupedItems).forEach(([type, items]) => {
      // For each item in the group
      items.forEach((item, idx) => {
        const quantities = visibleSizes.map((size: string) => {
          if (item.has_personalization) {
            return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
          }
          return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
        });

        // Calculate real total from DB records to catch "non-size" quantities
        let rowTotal = 0;
        if (item.has_personalization) {
          rowTotal = item.order_item_persons?.length || 0;
        } else {
          rowTotal = item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        }
        
        summaryData.push([
          items.length > 1 ? `${type} - ${item.category}` : type, 
          ...quantities.map(q => q || '-'), 
          rowTotal
        ]);
      });
    });

    autoTable(doc, {
      head: [summaryHeaders],
      body: summaryData,
      startY: 105,
      margin: { left: leftMargin, right: leftMargin },
      styles: { fontSize: 7, cellPadding: 3, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: 'center', fontStyle: 'bold', lineWidth: 0.5, lineColor: [200, 200, 200] },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 100 } }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 25;

    // --- ITEM SECTIONS ---
    for (let i = 0; i < order.order_items.length; i++) {
      const item = order.order_items[i];
      if (currentY > 700) { doc.addPage(); currentY = 50; }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 150, 243);
      // IDEM label styled like reference images
      doc.setFontSize(10);
      doc.setTextColor(200, 50, 50); // reddish for IDEM
      doc.text(`IDEM ${i + 1}: ${(item.garment_types?.name || '').toUpperCase()} - ${(item.category || '').toUpperCase()}`, leftMargin, currentY);
      doc.setTextColor(0);
      
      currentY += 10;

      const itemTypeName = (item.garment_types?.name || '').toLowerCase();
      const isItemMusculosa = itemTypeName.includes('musculosa');
      const isItemRemera = (itemTypeName.includes('remera') || itemTypeName.includes('camiseta')) && !isItemMusculosa;
      const isItemShort = itemTypeName.includes('short');
      const isItemCampera = itemTypeName.includes('campera');
      const isItemBuzo = itemTypeName.includes('buzo');
      const hasFicha = isItemRemera || isItemMusculosa || isItemShort || isItemCampera || isItemBuzo;

      if (hasFicha) {
        // Reference format: TELA [value]   CUELLO [value]   [color box]
        const gridX = leftMargin;
        const gridY = currentY;
        const cellW = 115;
        const cellH = 25;
        const labelCellW = 55;

        const drawLabelValueCell = (x: number, y: number, label: string, value: string, w: number) => {
          // Label cell (gray bg)
          doc.setFillColor(240, 240, 240);
          doc.rect(x, y, labelCellW, cellH, 'F');
          doc.setDrawColor(0);
          doc.setLineWidth(0.5);
          doc.rect(x, y, labelCellW, cellH);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text(label, x + labelCellW / 2, y + cellH / 2 + 2.5, { align: 'center' });
          // Value cell (white bg)
          doc.setFillColor(255, 255, 255);
          doc.rect(x + labelCellW, y, w, cellH, 'F');
          doc.rect(x + labelCellW, y, w, cellH);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          const displayValue = (value || '-').toUpperCase();
          doc.text(displayValue, x + labelCellW + w / 2, y + cellH / 2 + 2.5, { align: 'center', maxWidth: w - 4 });
        };

        // Determine which cells to show based on garment type
        if (isItemRemera) {
          // Row 1: TELA + CUELLO
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW);
          drawLabelValueCell(gridX + labelCellW + cellW, gridY, 'CUELLO', item.collar_type, cellW);
          // Row 2: MANGAS + COLOR MANGAS
          drawLabelValueCell(gridX, gridY + cellH, 'MANGAS', item.sleeve_type, cellW);
          if (item.sleeve_color) {
            drawLabelValueCell(gridX + labelCellW + cellW, gridY + cellH, 'COLOR MANGA', item.sleeve_color, cellW);
          }
          currentY += (cellH * 2) + 15;
        } else if (isItemMusculosa) {
          // Solo TELA
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW * 2);
          currentY += cellH + 15;
        } else if (isItemShort) {
          // TELA + BOLSILLOS (from observations/notes)
          const bolsillosVal = (() => {
            const obs = item.observations || item.notes || '';
            if (obs.includes('Con Bolsillos')) return 'Con Bolsillos';
            if (obs.includes('Sin Bolsillos')) return 'Sin Bolsillos';
            return '-';
          })();
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW);
          drawLabelValueCell(gridX + labelCellW + cellW, gridY, 'BOLSILLOS', bolsillosVal, cellW);
          currentY += cellH + 15;
        } else if (isItemCampera || isItemBuzo) {
          // ESTILO: Capucha / Cuello Alto / Cuello Redondo
          drawLabelValueCell(gridX, gridY, 'ESTILO', item.collar_type, cellW);
          currentY += cellH + 15;
        }

        // Design Image (right side)
        const imageUrl = item.custom_design_url || item.designs?.image_url;
        if (imageUrl) {
          const base64 = await getBase64Image(imageUrl);
          if (base64) {
            const imgX = gridX + (labelCellW + cellW) * 2 + 20;
            doc.addImage(base64, 'JPEG', imgX, gridY - 5, 70, 90);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('DISEÑO ADJUNTO', imgX, gridY + 95);
          }
        }
      }

      // Item Sizes Table
      let itemSizes = visibleSizes.filter(size => 
        item.has_personalization
          ? item.order_item_persons?.some((p: any) => p.size === size)
          : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
      );

      let itemHeaders = ['Talle', ...itemSizes];
      let itemQtys = ['Cant.', ...itemSizes.map(size => {
        if (item.has_personalization) return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
        return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
      })];

      // Handle items with no standard sizes (accessories/unitarios)
      if (itemSizes.length === 0) {
        const total = item.has_personalization 
          ? item.order_item_persons?.length || 0 
          : item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        
        itemHeaders = ['Detalle', 'Cantidad'];
        itemQtys = ['Unitario / Sin Talle', total.toString()];
      }

      autoTable(doc, {
        head: [itemHeaders],
        body: [itemQtys],
        startY: currentY,
        margin: { left: leftMargin, right: 200 }, // Leave space for image
        styles: { fontSize: 8, cellPadding: 5, halign: 'center', lineWidth: 0.5, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [26, 188, 156], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'bold', textColor: [60, 60, 60] },
        columnStyles: { 0: { halign: 'left', fillColor: [248, 248, 248] } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`NOTAS: ${(item.admin_comment || item.notes || 'SIN OBSERVACIONES').toUpperCase()}`, leftMargin, currentY);
      
      currentY += 40;
      
      // Personalization table if exists
      if (item.has_personalization && item.order_item_persons?.length > 0) {
        if (currentY > 650) { doc.addPage(); currentY = 50; }
        doc.text('PLANILLA DE ESTAMPADO INDIVIDUAL', leftMargin, currentY);
        currentY += 10;
        
        const pHeaders = ['Nº', 'Talle', 'Nombre'];
        const pBody = item.order_item_persons.map((p: any) => [p.person_number || '-', p.size, p.person_name || '-']);
        
        autoTable(doc, {
          head: [pHeaders],
          body: pBody,
          startY: currentY,
          margin: { left: leftMargin, right: leftMargin },
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 82, 204], textColor: 255 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 40;
      }
    }

    return doc;
  };

  const exportToPDF = async () => {
    const doc = await generateProductionPDF();
    doc.save(`ficha-produccion-${order.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    toast.success('PDF exportado correctamente');
  };

  if (loading) return <div className="p-12 text-center animate-pulse font-headline">Cargando pedido...</div>;
  if (!order) return <div className="p-12 text-center">Pedido no encontrado.</div>;

  const totalQuantity = order.order_items.reduce((sum: number, item: any) => {
    if (item.has_personalization) return sum + (item.order_item_persons?.length || 0);
    return sum + (item.order_item_sizes?.reduce((sub: number, s: any) => sub + (s.quantity || 0), 0) || 0);
  }, 0);

  return (
    <div className="max-w-[98%] mx-auto pb-[120px]">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate('/admin/dashboard', { replace: true })} className="text-[var(--color-primary)] text-xs font-bold flex items-center hover:underline bg-[var(--color-primary)]/5 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-xs mr-1">arrow_back</span>
          Volver al Panel
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)] opacity-50">Admin Order View v2.0</span>
      </div>

      {/* CABECERA COMPACTA CON DATOS DEL CLIENTE */}
      <div className="bg-white rounded-2xl p-4 mb-4 border border-[var(--color-outline-variant)]/20 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info Pedido */}
          <div className="flex flex-col border-r border-[var(--color-outline-variant)]/10 pr-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-1">Información del Pedido</span>
            <h1 className="font-headline text-xl font-black tracking-tight text-[var(--color-on-surface)] leading-tight">{order.name}</h1>
            <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusChipClass(order.status)}`}>
                    {getStatusLabel(order.status).toUpperCase()}
                </span>
                <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
                   {new Date(order.created_at).toLocaleDateString('es-AR')}
                </span>
            </div>
          </div>

          {/* Info Cliente */}
          <div className="flex flex-col border-r border-[var(--color-outline-variant)]/10 pr-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-1">Contacto del Cliente</span>
            <p className="font-bold text-sm text-[var(--color-on-surface)]">{order.profiles?.team_name || order.profiles?.name}</p>
            <div className="grid grid-cols-1 gap-1 mt-1 text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                <span className="material-symbols-outlined text-[14px]">mail</span>
                {order.profiles?.email || 'No especificado'}
              </div>
              <div className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
                <span className="material-symbols-outlined text-[14px]">call</span>
                {(() => {
                   const shipInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
                   return shipInfo?.phone || 'No especificado';
                })()}
              </div>
            </div>
          </div>

          {/* Logística y Propósito */}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-1">Logística y Producción</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[var(--color-on-surface-variant)] uppercase">Courier</span>
                <span className="font-bold">
                  {(() => {
                    const shipInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
                    return shipInfo?.preferred_carrier || '-';
                  })()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[var(--color-on-surface-variant)] uppercase">Propósito</span>
                <span className="font-bold">
                  {(() => {
                    const shipInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
                    return shipInfo?.order_purpose || '-';
                  })()}
                </span>
              </div>
              <div className="flex flex-col col-span-2 mt-1">
                <span className="text-[9px] font-bold text-[var(--color-on-surface-variant)] uppercase">Dirección de Envío</span>
                <span className="truncate">
                  {(() => {
                    const shipInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
                    return shipInfo?.shipping_address || '-';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Herramientas de Administración compactas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Subir Diseño */}
        <div className="bg-white rounded-xl p-4 border border-[var(--color-outline-variant)]/20 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">upload_file</span>
            Subir Diseño Adicional
          </h3>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAdminDesign(file);
            }}
            disabled={uploadingDesign}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[var(--color-primary)] file:text-white hover:file:bg-[var(--color-primary-container)]"
          />
        </div>

        {/* Comentario y Observación */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-[var(--color-outline-variant)]/20 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">comment</span>
            Comentario para Producción
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Ej: Entregar antes del 15/04"
              className="input-field py-1 text-xs flex-1"
              onKeyPress={(e) => e.key === 'Enter' && addAdminComment()}
            />
            <button
              onClick={addAdminComment}
              disabled={!adminComment.trim()}
              className="btn btn-secondary px-3 py-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
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

      {/* Timeline Tracker */}
      <div className="bg-white p-0 overflow-hidden mb-12 border border-gray-300">
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
          return (
          <div key={item.id} className="bg-white p-6 border border-gray-300 border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
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

                  {/* Ficha Técnica — condicional por tipo de prenda */}
            {(() => {
              const typeName = (item.garment_types?.name || '').toLowerCase();
              const isMusculosa = typeName.includes('musculosa');
              const isRem = (typeName.includes('remera') || typeName.includes('camiseta')) && !isMusculosa;
              const isShort = typeName.includes('short');
              const isCamp = typeName.includes('campera');
              const isBuzo = typeName.includes('buzo');
              const hasFicha = isRem || isMusculosa || isShort || isCamp || isBuzo;
              if (!hasFicha) return null;

              // Bolsillos value from notes/observations for shorts
              const bolsillosVal = (() => {
                const obs = item.observations || item.notes || '';
                if (obs.includes('Con Bolsillos')) return 'Con Bolsillos';
                if (obs.includes('Sin Bolsillos')) return 'Sin Bolsillos';
                return '—';
              })();

              return (
                <div className="mt-4 overflow-hidden border border-gray-300">
                  <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-300 flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Ficha Técnica</span>
                    {isRem && <span className="text-[9px] text-gray-400">— datos elegidos por el cliente + especificaciones de producción</span>}
                  </div>
                  <table className="w-full border-collapse text-sm">
                    <tbody>

                      {/* REMERA: Cuello (readonly client) + Tela (editable admin) + Manga (readonly) + Color Mangas (editable) */}
                      {isRem && (
                        <>
                          <tr className="border-b border-gray-300">
                            <td className="w-[15%] bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Escote / Cuello</td>
                            <td className="w-[35%] px-3 py-2 border-r border-gray-300">
                              <span className="font-black text-sm text-gray-800 uppercase">{item.collar_type || '—'}</span>
                              <span className="ml-2 text-[9px] text-gray-400 uppercase tracking-widest">(cliente)</span>
                            </td>
                            <td className="w-[15%] bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Tela</td>
                            <td className="w-[35%] px-2 py-1.5">
                              <input
                                className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-blue-400 font-bold text-sm placeholder-gray-300"
                                value={item.fabric_type || ''}
                                onChange={(e) => handleSpecChange(item.id, 'fabric_type', e.target.value)}
                                onBlur={(e) => handleSpecBlur(item.id, 'fabric_type', e.target.value)}
                                placeholder="Ej: MESH, SET..."
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Tipo de Manga</td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <span className="font-black text-sm text-gray-800 uppercase">{item.sleeve_type || '—'}</span>
                              <span className="ml-2 text-[9px] text-gray-400 uppercase tracking-widest">(cliente)</span>
                            </td>
                            <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Color Mangas</td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-blue-400 font-bold text-sm placeholder-gray-300"
                                value={item.sleeve_color || ''}
                                onChange={(e) => handleSpecChange(item.id, 'sleeve_color', e.target.value)}
                                onBlur={(e) => handleSpecBlur(item.id, 'sleeve_color', e.target.value)}
                                placeholder="Ej: AZUL, NEGRO..."
                              />
                            </td>
                          </tr>
                        </>
                      )}

                      {/* MUSCULOSA: Solo Tela (editable admin, sin opciones de cliente) */}
                      {isMusculosa && (
                        <tr>
                          <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Tela</td>
                          <td className="px-2 py-1.5" colSpan={3}>
                            <input
                              className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-blue-400 font-bold text-sm placeholder-gray-300"
                              value={item.fabric_type || ''}
                              onChange={(e) => handleSpecChange(item.id, 'fabric_type', e.target.value)}
                              onBlur={(e) => handleSpecBlur(item.id, 'fabric_type', e.target.value)}
                              placeholder="Ej: MESH, SET..."
                            />
                          </td>
                        </tr>
                      )}

                      {/* SHORT: Bolsillos (readonly client) + Tela (editable admin) */}
                      {isShort && (
                        <tr>
                          <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Bolsillos</td>
                          <td className="px-3 py-2 border-r border-gray-300">
                            <span className="font-black text-sm text-gray-800 uppercase">{bolsillosVal}</span>
                            <span className="ml-2 text-[9px] text-gray-400 uppercase tracking-widest">(cliente)</span>
                          </td>
                          <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Tela</td>
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-blue-400 font-bold text-sm placeholder-gray-300"
                              value={item.fabric_type || ''}
                              onChange={(e) => handleSpecChange(item.id, 'fabric_type', e.target.value)}
                              onBlur={(e) => handleSpecBlur(item.id, 'fabric_type', e.target.value)}
                              placeholder="Ej: MESH, SET..."
                            />
                          </td>
                        </tr>
                      )}

                      {/* CAMPERA: Estilo (readonly client) */}
                      {isCamp && (
                        <tr>
                          <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Estilo / Capucha</td>
                          <td className="px-3 py-2" colSpan={3}>
                            <span className="font-black text-sm text-gray-800 uppercase">{item.collar_type || '—'}</span>
                            <span className="ml-2 text-[9px] text-gray-400 uppercase tracking-widest">(cliente)</span>
                          </td>
                        </tr>
                      )}

                      {/* BUZO: Estilo (readonly client) */}
                      {isBuzo && (
                        <tr>
                          <td className="bg-gray-100 px-3 py-2 font-black uppercase text-[10px] border-r border-gray-300 text-gray-500 whitespace-nowrap">Estilo / Cuello</td>
                          <td className="px-3 py-2" colSpan={3}>
                            <span className="font-black text-sm text-gray-800 uppercase">{item.collar_type || '—'}</span>
                            <span className="ml-2 text-[9px] text-gray-400 uppercase tracking-widest">(cliente)</span>
                          </td>
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>
              );
            })()}


            <div className="mt-10">
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                <h4 className="font-headline text-md font-bold uppercase tracking-tight text-gray-700">Talles & Cantidades</h4>
              </div>
              
              <div className="overflow-hidden border border-gray-300">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="p-2 border-r border-gray-300 text-left font-black uppercase text-[9px] opacity-70">Talles</th>
                      {dynamicSizes.filter(size => {
                        if (item.has_personalization) return item.order_item_persons?.some((p: any) => p.size === size);
                        return item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0);
                      }).map(size => (
                        <th key={size} className="p-2 border-r border-gray-300 font-bold text-center bg-gray-50">{size}</th>
                      ))}
                      <th className="p-2 font-black text-center bg-gray-200">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border-r border-gray-300 font-bold bg-gray-50">Cantidad</td>
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
                          <td key={size} className="p-2 border-r border-gray-300 text-center font-bold text-[var(--color-primary)]">
                            {qty}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-black bg-gray-100">
                        {item.has_personalization ? (item.order_item_persons?.length || 0) : (item.order_item_sizes?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin Comment per Item */}
            <div className="mt-6 pt-6 border-t border-[var(--color-outline-variant)]/10">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)] mb-3">Comentario del Administrador para esta Prenda</h5>
              <textarea
                className="input-field py-2 text-xs w-full"
                placeholder="Ej: Prioridad alta, verificar colores, etc."
                value={item.admin_comment || ''}
                onChange={(e) => handleSpecChange(item.id, 'admin_comment', e.target.value)}
                onBlur={(e) => handleSpecBlur(item.id, 'admin_comment', e.target.value)}
                rows={2}
              />
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
                <div className="border border-gray-300 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="p-2 font-black uppercase text-[9px] opacity-70 border-r border-gray-300 w-16 text-center">Nº</th>
                        <th className="p-2 font-black uppercase text-[9px] opacity-70 border-r border-gray-300 w-16 text-center">Talle</th>
                        <th className="p-2 font-black uppercase text-[9px] opacity-70">Nombre a Estampar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {item.order_item_persons.map((p: any, pIdx: number) => {
                        const isShorts = item.garment_type_name?.toLowerCase().includes('pantalón') || item.garment_type_name?.toLowerCase().includes('short');
                        return (
                          <tr key={pIdx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-2 font-black text-lg text-[var(--color-primary)] border-r border-gray-300 text-center">
                              {p.person_number || '—'}
                            </td>
                            <td className="p-2 font-bold text-center border-r border-gray-300">
                              {p.size}
                            </td>
                            <td className="p-2 font-extrabold text-md uppercase tracking-tight text-gray-800">
                              {isShorts ? (
                                <span className="text-[10px] text-gray-400 italic font-black uppercase tracking-widest">Sin Nombre (Pantalón)</span>
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
            {item.notes && (
              <div className="mt-4 bg-gray-50 border border-gray-300 text-gray-700 p-3 text-xs">
                <span className="font-black uppercase text-[9px] opacity-70 mr-2">Observaciones Cliente:</span> {item.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>

      {/* BOTONES DE ACCIÓN AL FINAL */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-outline-variant)]/20 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-[var(--color-on-surface-variant)] opacity-60">Total Pedido</span>
              <span className="font-headline text-lg font-black text-[var(--color-primary)]">{totalQuantity} <span className="text-xs font-normal">prendas</span></span>
            </div>
            <div className="h-8 w-px bg-[var(--color-outline-variant)]/20 mx-2"></div>
            <button 
              onClick={handlePreviewClick}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition-all"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Vista Previa PDF
            </button>
            <button 
              onClick={exportToPDF}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Descargar PDF
            </button>
          </div>

          <div className="flex items-center gap-3">
            {order.status === 'confirmed' && (
              <button 
                onClick={confirmSendToProduction}
                disabled={updatingStatus}
                className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-[0.1em] flex items-center gap-2 bg-[var(--color-primary)] text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">{updatingStatus ? 'hourglass_empty' : 'factory'}</span>
                {updatingStatus ? 'Procesando...' : 'Enviar a Fábrica'}
              </button>
            )}
            {order.status === 'in_production' && (
              <button 
                onClick={finalizeOrder}
                disabled={updatingStatus}
                className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-[0.1em] flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">{updatingStatus ? 'hourglass_empty' : 'check_circle'}</span>
                {updatingStatus ? 'Procesando...' : 'Finalizar Pedido'}
              </button>
            )}
            {order.status === 'delivered' && (
              <div className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-[0.1em] flex items-center gap-2 bg-gray-100 text-gray-500 cursor-not-allowed">
                <span className="material-symbols-outlined">verified</span>
                Pedido Finalizado
              </div>
            )}
          </div>
        </div>
      </div>

      {showPdfPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 md:p-6">
          <div className="bg-white rounded-2xl w-full h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Vista Previa - Ficha de Producción</h2>
              <div className="flex gap-2">
                  <button 
                    onClick={exportToPDF}
                    className="btn btn-primary px-4 py-1.5 text-sm"
                  >
                    <span className="material-symbols-outlined mr-1 text-sm">download</span>
                    Descargar
                  </button>
                  <button 
                    onClick={() => {
                        setShowPdfPreview(false);
                        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                        setPdfUrl(null);
                    }}
                    className="text-gray-500 hover:text-gray-800 font-bold px-2 text-xl"
                  >
                    ×
                  </button>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden">
              {pdfUrl ? (
                <iframe 
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              ) : (
                <div className="p-12 text-center animate-pulse">Generando vista previa...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrderDetails;
