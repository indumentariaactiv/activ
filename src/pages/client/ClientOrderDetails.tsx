import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoAltiv from '../../assets/logo.png';

const ClientOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: globalLoading } = useAppStore();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  // Use stable user ID for dependency tracking
  const userId = user?.id;

  const STANDARD_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', 'XXXXL', '5XL', 'XXXXXL', '6XL'];

  const getEffectiveSizes = () => {
    if (!order) return STANDARD_SIZES;
    const usedSizes = new Set<string>();
    order.order_items.forEach((item: any) => {
      item.order_item_sizes?.forEach((s: any) => {
        if (s.quantity > 0 && s.size !== 'Cantidad' && s.size !== 'Cant.') usedSizes.add(s.size.toString());
      });
      item.order_item_persons?.forEach((p: any) => {
        if (p.size !== 'Cantidad' && p.size !== 'Cant.') usedSizes.add(p.size.toString());
      });
    });
    const allUsed = Array.from(usedSizes);
    const sorted = [...STANDARD_SIZES].filter(s => usedSizes.has(s) || STANDARD_SIZES.includes(s));
    const nonStandard = allUsed.filter(s => !STANDARD_SIZES.includes(s));
    return Array.from(new Set([...sorted, ...nonStandard]));
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

    doc.setDrawColor(0);
    doc.setLineWidth(1);

    // Header: height reduced to 38pt for compactness
    const headerH = 38;
    const headerY = 40;
    doc.rect(leftMargin, headerY, contentWidth, headerH);
    doc.line(leftMargin + 190, headerY, leftMargin + 190, headerY + headerH); // After Name
    doc.line(leftMargin + 385, headerY, leftMargin + 385, headerY + headerH); // After Logo
    doc.line(leftMargin + 460, headerY, leftMargin + 460, headerY + headerH); // After Date / Before Total

    // Client name — small font, auto-wrapped to fit the 190pt cell
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const shippingInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
    const clientDisplayName = shippingInfo?.full_name || order.profiles?.team_name || order.profiles?.name || 'SIN NOMBRE';
    // Clamp name to 2 lines max within 175pt wide cell
    const nameLines: string[] = doc.splitTextToSize(clientDisplayName.toUpperCase(), 175);
    const visibleNameLines = nameLines.slice(0, 2);
    const lineHeight = 10;
    const nameBlockH = visibleNameLines.length * lineHeight;
    const nameY = headerY + (headerH - nameBlockH) / 2 + lineHeight - 2;
    doc.text(visibleNameLines, leftMargin + 7, nameY);

    let logoData: string = logoAltiv as string;
    if (typeof logoAltiv === 'string') {
      const fetched = await getBase64Image(logoAltiv);
      if (fetched) logoData = fetched;
    }
    try {
        if (logoData) {
            doc.addImage(logoData as string, 'PNG', leftMargin + 230, headerY + 4, 70, 30);
        } else {
            throw new Error("No logo data");
        }
    } catch (e) {
        doc.setFontSize(13);
        doc.text('ALTIV', leftMargin + 285, headerY + headerH / 2 + 4, { align: 'center' });
    }

    // Date — centered in the 75pt date cell (385 to 460)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date().toLocaleDateString('es-AR'), leftMargin + 385 + 37, headerY + headerH / 2 + 3, { align: 'center' });

    // Total box from 460 to end
    doc.setFillColor(0, 82, 204);
    doc.rect(leftMargin + 460, headerY, contentWidth - 460, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const totalQuantity = order.order_items.reduce((sum: number, item: any) => {
      if (item.has_personalization) return sum + (item.order_item_persons?.length || 0);
      return sum + (item.order_item_sizes?.reduce((sub: number, s: any) => sub + (s.quantity || 0), 0) || 0);
    }, 0);
    doc.text(`${totalQuantity}`, leftMargin + 460 + (contentWidth - 460) / 2, headerY + headerH / 2 + 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Summary table starts below compact header
    const summaryStartY = headerY + headerH + 15;
    const dynamicSizes = getEffectiveSizes();
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
      items.forEach((item, _idx) => {
        const quantities = visibleSizes.map((size: string) => {
          if (item.has_personalization) {
            return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
          }
          return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
        });
        let rowTotal = 0;
        if (item.has_personalization) rowTotal = item.order_item_persons?.length || 0;
        else rowTotal = item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        summaryData.push([items.length > 1 ? `${type} - ${item.category}` : type, ...quantities.map(q => q || '-'), rowTotal]);
      });
    });

    autoTable(doc, {
      head: [summaryHeaders], body: summaryData,
      startY: summaryStartY,
      margin: { left: leftMargin, right: leftMargin },
      styles: { fontSize: 7, cellPadding: 3, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: 'center', fontStyle: 'bold', lineWidth: 0.5, lineColor: [200, 200, 200] },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 100 } }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 25;

    for (let i = 0; i < order.order_items.length; i++) {
      const item = order.order_items[i];
      if (currentY > 700) { doc.addPage(); currentY = 50; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 50, 50);
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
        const gridX = leftMargin; const gridY = currentY;
        const cellW = 115; const cellH = 25; const labelCellW = 55;
        const drawLabelValueCell = (x: number, y: number, label: string, value: string, w: number) => {
          doc.setFillColor(240, 240, 240); doc.rect(x, y, labelCellW, cellH, 'F');
          doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(x, y, labelCellW, cellH);
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
          doc.text(label, x + labelCellW / 2, y + cellH / 2 + 2.5, { align: 'center' });
          doc.setFillColor(255, 255, 255); doc.rect(x + labelCellW, y, w, cellH, 'F'); doc.rect(x + labelCellW, y, w, cellH);
          doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
          doc.text((value || '-').toUpperCase(), x + labelCellW + w / 2, y + cellH / 2 + 2.5, { align: 'center', maxWidth: w - 4 });
        };
        if (isItemRemera) {
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW);
          drawLabelValueCell(gridX + labelCellW + cellW, gridY, 'CUELLO', item.collar_type, cellW);
          drawLabelValueCell(gridX, gridY + cellH, 'MANGAS', item.sleeve_type, cellW);
          if (item.sleeve_color) drawLabelValueCell(gridX + labelCellW + cellW, gridY + cellH, 'COLOR MANGA', item.sleeve_color, cellW);
          currentY += (cellH * 2) + 15;
        } else if (isItemMusculosa) {
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW * 2);
          currentY += cellH + 15;
        } else if (isItemShort) {
          const obs = item.observations || item.notes || '';
          const bolsillosVal = obs.includes('Con Bolsillos') ? 'Con Bolsillos' : obs.includes('Sin Bolsillos') ? 'Sin Bolsillos' : '-';
          drawLabelValueCell(gridX, gridY, 'TELA', item.fabric_type, cellW);
          drawLabelValueCell(gridX + labelCellW + cellW, gridY, 'BOLSILLOS', bolsillosVal, cellW);
          currentY += cellH + 15;
        } else if (isItemCampera || isItemBuzo) {
          drawLabelValueCell(gridX, gridY, 'ESTILO', item.collar_type, cellW);
          currentY += cellH + 15;
        }
        const imageUrl = item.custom_design_url || item.designs?.image_url;
        if (imageUrl) {
          const base64 = await getBase64Image(imageUrl);
          if (base64) {
            const imgX = gridX + (labelCellW + cellW) * 2 + 20;
            doc.addImage(base64, 'JPEG', imgX, gridY - 5, 70, 90);
            doc.setFontSize(6); doc.setFont('helvetica', 'bold');
            doc.text('DISEÑO ADJUNTO', imgX, gridY + 95);
          }
        }
      }

      let itemSizes = visibleSizes.filter(size =>
        item.has_personalization
          ? item.order_item_persons?.some((p: any) => p.size === size)
          : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
      );
      let itemHeaders = ['Talle', ...itemSizes];
      let itemQtys: any[] = ['Cant.', ...itemSizes.map(size => {
        if (item.has_personalization) return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
        return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
      })];
      if (itemSizes.length === 0) {
        const total = item.has_personalization
          ? item.order_item_persons?.length || 0
          : item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
        itemHeaders = ['Detalle', 'Cantidad'];
        itemQtys = ['Unitario / Sin Talle', total.toString()];
      }
      autoTable(doc, {
        head: [itemHeaders], body: [itemQtys], startY: currentY,
        margin: { left: leftMargin, right: 200 },
        styles: { fontSize: 8, cellPadding: 5, halign: 'center', lineWidth: 0.5, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [26, 188, 156], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'bold', textColor: [60, 60, 60] },
        columnStyles: { 0: { halign: 'left', fillColor: [248, 248, 248] } }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`NOTAS: ${(item.admin_comment || item.notes || 'SIN OBSERVACIONES').toUpperCase()}`, leftMargin, currentY);
      currentY += 40;

      if (item.has_personalization && item.order_item_persons?.length > 0) {
        if (currentY > 650) { doc.addPage(); currentY = 50; }
        doc.text('PLANILLA DE ESTAMPADO INDIVIDUAL', leftMargin, currentY);
        currentY += 10;
        const pHeaders = ['Nº', 'Talle', 'Nombre'];
        const pBody = item.order_item_persons.map((p: any) => [p.person_number || '-', p.size, p.person_name || '-']);
        autoTable(doc, {
          head: [pHeaders], body: pBody, startY: currentY,
          margin: { left: leftMargin, right: leftMargin },
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [0, 82, 204], textColor: 255 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 40;
      }
    }
    return doc;
  };

  const handlePreviewClick = async () => {
    const doc = await generateProductionPDF();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setShowPdfPreview(true);
  };

  // ─── Lifecycle ───
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Re-fetch whenever the order ID or user ID changes (uses stable string, not object ref)
  useEffect(() => {
    // Wait until auth is resolved
    if (globalLoading) return;

    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    if (!id) return;

    fetchOrderDetails();
  }, [id, userId, globalLoading]);

  const fetchOrderDetails = async () => {
    if (!isMountedRef.current) return;
    const currentUserId = useAppStore.getState().user?.id;
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client_shipping_info (*),
          order_items (
            *,
            garment_types (name),
            designs (image_url),
            order_item_sizes (*),
            order_item_persons (*)
          )
        `)
        .eq('id', id)
        .eq('client_id', currentUserId)
        .single();

      if (error) throw error;

      if (isMountedRef.current) {
        // Normalize client_shipping_info: Supabase may return array or object
        const normalized = {
          ...data,
          client_shipping_info: Array.isArray(data.client_shipping_info)
            ? data.client_shipping_info[0] || null
            : data.client_shipping_info
        };
        setOrder(normalized);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      if (isMountedRef.current) {
        setLoading(false);
        toast.error('Error al cargar los detalles del pedido');
        navigate('/cliente/dashboard', { replace: true });
      }
    }
  };

  const handleConfirmOrder = async () => {
    setIsConfirming(true);
    const loadingToast = toast.loading('Enviando pedido a producción...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', id)
        .eq('client_id', user?.id);

      if (error) throw error;

      if (isMountedRef.current) {
        toast.success('¡Pedido enviado a producción! El equipo de ALTIV lo recibirá en breve.', { id: loadingToast, duration: 4000 });
        setOrder((prev: any) => ({ ...prev, status: 'confirmed' }));
        setShowConfirmModal(false);
      }
    } catch (err: any) {
      console.error(err);
      if (isMountedRef.current) {
        toast.error(`Error al confirmar: ${err.message || 'Intenta de nuevo'}`, { id: loadingToast });
        setIsConfirming(false);
      }
    } finally {
      if (isMountedRef.current) setIsConfirming(false);
    }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-24 px-4">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    </div>
  );

  if (!order) return (
    <div className="max-w-5xl mx-auto pb-24 px-4">
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Pedido no encontrado</h2>
        <Link to="/cliente/dashboard" className="text-[var(--color-primary)] hover:underline">
          Volver al dashboard
        </Link>
      </div>
    </div>
  );

  const isDraft = order.status === 'draft' || order.status === 'pending';
  const isConfirmed = !isDraft;

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6 bg-white p-8 rounded-[32px] border border-[var(--color-outline-variant)]/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)] opacity-[0.03] rounded-bl-full -mr-16 -mt-16"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]">Revisión Técnica de Pedido</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              isDraft ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              order.status === 'in_production' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              order.status === 'delivered' ? 'bg-green-50 text-green-700 border border-green-200' :
              'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {isDraft ? 'Borrador' :
               order.status === 'confirmed' ? 'Enviado — Esperando Producción' :
               order.status === 'in_production' ? 'En Producción' :
               order.status === 'delivered' ? 'Finalizado' : order.status}
            </span>
          </div>
          <h1 className="font-headline text-3xl md:text-4xl font-black uppercase tracking-tight text-gray-900 mb-2">
            {order.name || `Pedido #${order.id.slice(-8)}`}
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm">
            Creado el {new Date(order.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <Link to="/cliente/dashboard" className="btn btn-secondary text-xs h-10">
            <span className="material-symbols-outlined text-[1.1rem]">arrow_back</span>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Client Information */}
      {order.client_shipping_info && (
        <div className="bg-white rounded-3xl p-6 border border-[var(--color-outline-variant)]/20 shadow-xl shadow-gray-100/50 mb-8">
          <h2 className="font-headline text-lg font-extrabold uppercase tracking-tight mb-4">Información del Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-bold">Nombre:</span> {order.client_shipping_info.full_name}</div>
            <div><span className="font-bold">Email:</span> {order.client_shipping_info.email}</div>
            <div><span className="font-bold">Teléfono:</span> {order.client_shipping_info.phone}</div>
            <div><span className="font-bold">Dirección:</span> {order.client_shipping_info.shipping_address}</div>
            {order.client_shipping_info.preferred_carrier && (
              <div><span className="font-bold">Courier:</span> {order.client_shipping_info.preferred_carrier}</div>
            )}
            {order.client_shipping_info.order_purpose && (
              <div><span className="font-bold">Propósito:</span> {order.client_shipping_info.order_purpose}</div>
            )}
          </div>
        </div>
      )}

      {/* Production Sheet Preview */}
      <div className="bg-white rounded-3xl p-8 border border-[var(--color-outline-variant)]/20 shadow-xl shadow-gray-100/50 mb-8">
        <div className="text-center">
          <h2 className="font-headline text-2xl font-extrabold uppercase tracking-tight mb-4">Vista Previa de Producción</h2>
          <p className="text-[var(--color-on-surface-variant)] mb-6">
            Esta es la ficha técnica que se enviará a fábrica con todos los detalles de tu pedido.
          </p>
          <button
            onClick={handlePreviewClick}
            className="btn btn-primary bg-[var(--color-primary)] text-white px-8 py-4 rounded-2xl font-black text-lg uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined mr-2">visibility</span>
            Ver Ficha de Producción
          </button>
        </div>
      </div>

      {/* Action Buttons — only shown for draft orders */}
      {isDraft && (
        <div className="bg-white rounded-3xl p-8 border border-[var(--color-outline-variant)]/20 shadow-xl shadow-gray-100/50 mb-8">
          <h2 className="font-headline text-xl font-extrabold uppercase tracking-tight mb-2">¿Qué querés hacer?</h2>
          <p className="text-sm text-[var(--color-on-surface-variant)] mb-6">
            Revisá bien tu pedido antes de confirmarlo. Una vez enviado a producción no podrás editarlo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Edit button — goes directly to step 2 (prendas) */}
            <button
              onClick={() => navigate(`/cliente/pedido/${id}/editar?step=2`)}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-5 rounded-2xl border-2 border-[var(--color-outline-variant)]/30 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)] hover:border-[var(--color-primary)]/40 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-container)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-[1.2rem]">edit</span>
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase tracking-wide">Seguir Editando</p>
                <p className="text-xs text-[var(--color-on-surface-variant)]">Modificar prendas, talles y diseños</p>
              </div>
            </button>

            {/* Confirm button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-5 rounded-2xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-green-700 text-[1.2rem]">send</span>
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase tracking-wide text-green-800">Confirmar y Enviar</p>
                <p className="text-xs text-green-700">Enviar pedido a producción · Sin vuelta atrás</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Status banner when already confirmed */}
      {isConfirmed && (
        <div className={`rounded-3xl p-6 mb-8 flex items-center gap-4 ${
          order.status === 'in_production'
            ? 'bg-blue-50 border border-blue-200'
            : order.status === 'delivered'
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <span className={`material-symbols-outlined text-3xl ${
            order.status === 'in_production' ? 'text-blue-600' :
            order.status === 'delivered' ? 'text-green-600' : 'text-amber-600'
          }`}>
            {order.status === 'in_production' ? 'precision_manufacturing' : order.status === 'delivered' ? 'check_circle' : 'hourglass_top'}
          </span>
          <div>
            <p className="font-black text-sm uppercase tracking-wide">
              {order.status === 'confirmed' ? 'Pedido recibido por ALTIV' :
               order.status === 'in_production' ? 'Pedido en producción' :
               order.status === 'delivered' ? 'Pedido finalizado y enviado' : order.status}
            </p>
            <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">
              {order.status === 'confirmed' ? 'El equipo técnico lo está revisando y pronto comenzará la producción.' :
               order.status === 'in_production' ? 'Tu pedido está siendo fabricado. Te avisaremos cuando esté listo.' :
               'Tu pedido ya fue enviado. ¡Gracias por elegir ALTIV!'}
            </p>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-green-600 text-3xl">send</span>
              </div>
              <h2 className="font-headline text-2xl font-black uppercase tracking-tight mb-2">
                Confirmar Pedido
              </h2>
              <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
                Estás a punto de enviar <strong>"{order.name}"</strong> a producción.
                Una vez confirmado, <strong>no podrás editarlo</strong>. El equipo de ALTIV lo recibirá y comenzará a trabajar en él.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-3">
              <span className="material-symbols-outlined text-amber-600 text-xl flex-shrink-0 mt-0.5">warning</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                Esta acción es irreversible. Asegurate de que todos los talles, prendas y datos de envío sean correctos antes de continuar.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isConfirming}
                className="flex-1 btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={isConfirming}
                className="flex-1 btn bg-green-600 text-white hover:bg-green-700 font-black disabled:opacity-60"
              >
                {isConfirming ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</>
                ) : (
                  <><span className="material-symbols-outlined text-[1.1rem]">check</span> Sí, Confirmar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 md:p-6">
          <div className="bg-white rounded-2xl w-full h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Vista Previa — Ficha de Producción</h2>
              <button
                onClick={() => { setShowPdfPreview(false); if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }}
                className="text-gray-500 hover:text-gray-800 font-bold px-2 text-xl"
              >
                ×
              </button>
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

export default ClientOrderDetails;
