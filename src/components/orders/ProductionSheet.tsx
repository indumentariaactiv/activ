import React from 'react';

interface ProductionSheetProps {
  order: any;
  logoUrl?: string;
}

const STANDARD_SIZES = ['2', '4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', 'XXXXL', '5XL', 'XXXXXL', '6XL'];

export const ProductionSheet: React.FC<ProductionSheetProps> = ({ order, logoUrl }) => {
  if (!order) return null;

  const getEffectiveSizes = () => {
    const usedSizes = new Set<string>();
    order.order_items?.forEach((item: any) => {
      item.order_item_sizes?.forEach((s: any) => {
        if (s.quantity > 0 && s.size !== 'Cantidad' && s.size !== 'Cant.') usedSizes.add(s.size.toString());
      });
      item.order_item_persons?.forEach((p: any) => {
        if (p.size !== 'Cantidad' && p.size !== 'Cant.') usedSizes.add(p.size.toString());
      });
    });
    const allUsed = Array.from(usedSizes);
    const sorted = [...STANDARD_SIZES].filter(s => usedSizes.has(s));
    const nonStandard = allUsed.filter(s => !STANDARD_SIZES.includes(s));
    return Array.from(new Set([...sorted, ...nonStandard]));
  };

  const visibleSizes = getEffectiveSizes();
  const totalQuantity = order.order_items?.reduce((sum: number, item: any) => {
    if (item.has_personalization) return sum + (item.order_item_persons?.length || 0);
    return sum + (item.order_item_sizes?.reduce((sub: number, s: any) => sub + (s.quantity || 0), 0) || 0);
  }, 0) || 0;

  const shippingInfo = Array.isArray(order.client_shipping_info) ? order.client_shipping_info[0] : order.client_shipping_info;
  const clientDisplayName = shippingInfo?.full_name || order.profiles?.team_name || order.profiles?.name || 'SIN NOMBRE';

  // Grouping for summary
  const groupedItems: Record<string, any[]> = {};
  order.order_items?.forEach((item: any) => {
    const type = item.garment_types?.name || 'Otros';
    if (!groupedItems[type]) groupedItems[type] = [];
    groupedItems[type].push(item);
  });

  return (
    <div className="bg-white text-black p-4 md:p-8 font-sans print:p-8 max-w-[1000px] mx-auto shadow-lg print:shadow-none min-h-[11in]">
      {/* Header Compacto - Estilo Industrial */}
      <div className="border border-black flex items-stretch h-[60px]">
        {/* Cliente */}
        <div className="flex-1 border-r border-black p-2 flex flex-col justify-center overflow-hidden">
          <span className="text-[9px] font-bold text-gray-500 uppercase leading-none mb-1">Cliente / Equipo</span>
          <span className="text-xs font-black uppercase truncate leading-tight">{clientDisplayName}</span>
        </div>
        
        {/* Logo */}
        <div className="w-[120px] border-r border-black flex items-center justify-center p-1 bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="ALTIV" className="h-full object-contain max-h-[40px]" />
          ) : (
            <span className="font-black text-lg tracking-tighter">ALTIV</span>
          )}
        </div>

        {/* Fecha */}
        <div className="w-[100px] border-r border-black p-2 flex flex-col justify-center items-center">
          <span className="text-[9px] font-bold text-gray-500 uppercase leading-none mb-1">Fecha</span>
          <span className="text-[11px] font-bold">{new Date().toLocaleDateString('es-AR')}</span>
        </div>

        {/* Total */}
        <div className="w-[80px] bg-blue-600 text-white flex flex-col justify-center items-center">
          <span className="text-[9px] font-bold uppercase leading-none mb-1">Total</span>
          <span className="text-2xl font-black">{totalQuantity}</span>
        </div>
      </div>

      {/* Summary Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="p-2 border-r border-gray-300 text-left text-[10px] font-black uppercase">Prendas / Talles</th>
              {visibleSizes.map(size => (
                <th key={size} className="p-1 border-r border-gray-300 text-center text-[10px] font-black uppercase w-8">{size}</th>
              ))}
              <th className="p-2 text-center text-[10px] font-black uppercase w-16">Totales</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedItems).map(([type, items]) => (
              items.map((item, idx) => {
                const quantities = visibleSizes.map(size => {
                  if (item.has_personalization) {
                    return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
                  }
                  return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
                });
                const rowTotal = item.has_personalization 
                  ? (item.order_item_persons?.length || 0) 
                  : (item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0);

                return (
                  <tr key={`${type}-${idx}`} className="border-b border-gray-200">
                    <td className="p-2 border-r border-gray-300 text-[10px] font-bold uppercase bg-gray-50">
                      {items.length > 1 ? `${type} - ${item.category}` : type}
                    </td>
                    {quantities.map((q, qIdx) => (
                      <td key={qIdx} className="p-1 border-r border-gray-300 text-center text-[10px] font-medium">
                        {q || '—'}
                      </td>
                    ))}
                    <td className="p-2 text-center text-[11px] font-black bg-gray-100">{rowTotal}</td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Items */}
      <div className="mt-8 space-y-12">
        {order.order_items?.map((item: any) => {
          const typeName = (item.garment_types?.name || '').toLowerCase();
          const isMusculosa = typeName.includes('musculosa');
          const isRem = (typeName.includes('remera') || typeName.includes('camiseta')) && !isMusculosa;
          const isShort = typeName.includes('short');
          const isCamp = typeName.includes('campera');
          const isBuzo = typeName.includes('buzo');
          const hasFicha = isRem || isMusculosa || isShort || isCamp || isBuzo;

          const itemSizes = visibleSizes.filter(size => 
            item.has_personalization
              ? item.order_item_persons?.some((p: any) => p.size === size)
              : item.order_item_sizes?.some((s: any) => s.size === size && s.quantity > 0)
          );

          const itemQuantities = itemSizes.map(size => {
            if (item.has_personalization) return item.order_item_persons?.filter((p: any) => p.size === size).length || 0;
            return item.order_item_sizes?.find((s: any) => s.size === size)?.quantity || 0;
          });

          const itemTotal = item.has_personalization 
            ? (item.order_item_persons?.length || 0) 
            : (item.order_item_sizes?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0);

          return (
            <div key={item.id} className="break-inside-avoid mb-10">
              {/* Header de la prenda: Nombre + Specs */}
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <span className="text-lg font-black text-red-600 uppercase">
                  {item.garment_types?.name} {item.category && item.category !== 'General' ? `- ${item.category}` : ''}
                </span>

                {hasFicha && (
                  <div className="flex items-center gap-3 ml-2">
                    {isRem && (
                      <>
                        <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Tela</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.fabric_type || '-'}</span></div>
                        <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Cuello</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.collar_type || '-'}</span></div>
                        <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Mangas</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.sleeve_type || '-'}</span></div>
                        {item.sleeve_color && <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Color M.</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.sleeve_color}</span></div>}
                      </>
                    )}
                    {isMusculosa && (
                      <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Tela</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.fabric_type || '-'}</span></div>
                    )}
                    {isShort && (
                      <>
                        <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Tela</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.fabric_type || '-'}</span></div>
                        <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Bolsillos</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.observations?.includes('Con Bolsillos') || item.notes?.includes('Con Bolsillos') ? 'CON BOLSILLOS' : 'SIN BOLSILLOS'}</span></div>
                      </>
                    )}
                    {(isCamp || isBuzo) && (
                      <div className="flex items-center border border-black shadow-sm"><span className="bg-white text-[9px] font-bold uppercase px-2 py-1 border-r border-black">Estilo</span><span className="text-[9px] font-black uppercase px-2 py-1 bg-black text-white min-w-[40px] text-center">{item.collar_type || '-'}</span></div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full h-[2px] bg-black mb-4"></div>

              {/* Contenido: Tablas Verticales + Imagen */}
              <div className="flex gap-8">
                {/* Columna Izquierda: Talles / Nombres */}
                <div className="w-[200px] flex-shrink-0">
                  {item.has_personalization && item.order_item_persons?.length > 0 ? (
                    <div className="mb-4">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-black">
                            <th className="py-1 text-[10px] font-black uppercase text-left w-10">Talle</th>
                            <th className="py-1 text-[10px] font-black uppercase text-left">Nombre</th>
                            <th className="py-1 text-[10px] font-black uppercase text-center w-10">Nº</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.order_item_persons.map((p: any, pIdx: number) => (
                            <tr key={pIdx} className="border-b border-gray-300 last:border-b-2 last:border-black">
                              <td className="py-1.5 text-[11px] font-black">{p.size}</td>
                              <td className="py-1.5 text-[11px] font-black uppercase">{p.person_name || '-'}</td>
                              <td className="py-1.5 text-[11px] font-black text-center">{p.person_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-black">
                            <th className="py-1 text-[10px] font-black uppercase text-left w-16">Talle</th>
                            <th className="py-1 text-[10px] font-black uppercase text-center">Cantidades</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemSizes.length > 0 ? itemSizes.map((size, sIdx) => {
                            if (itemQuantities[sIdx] > 0) {
                              return (
                                <tr key={sIdx} className="border-b border-gray-300 last:border-b-2 last:border-black">
                                  <td className="py-1.5 text-[11px] font-black underline">{size}</td>
                                  <td className="py-1.5 text-[11px] font-black text-center">{itemQuantities[sIdx]}</td>
                                </tr>
                              );
                            }
                            return null;
                          }) : (
                            <tr className="border-b-2 border-black">
                              <td className="py-1.5 text-[11px] font-black underline">Unitario</td>
                              <td className="py-1.5 text-[11px] font-black text-center">{itemTotal}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Notas */}
                  {(item.admin_comment || item.notes) && (
                    <div className="mt-4 text-[10px]">
                      <span className="font-black text-gray-500 uppercase">Notas:</span>
                      <p className="font-bold uppercase mt-0.5 leading-tight">{item.admin_comment || item.notes}</p>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Imagen */}
                <div className="flex-1 flex justify-end items-start">
                  {(item.custom_design_url || item.designs?.image_url) ? (
                    <div className="w-[300px] h-auto flex flex-col items-center gap-1">
                      <div className="w-full bg-white p-2">
                        <img src={item.custom_design_url || item.designs?.image_url} alt="Diseño" className="w-full h-auto object-contain" style={{ maxHeight: '350px' }} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-[250px] aspect-[4/3] bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Sin diseño adjunto</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info / Signatures if needed */}
      <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-200 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">ALTIV — Sistema de Producción Digital</span>
      </div>
    </div>
  );
};

export default ProductionSheet;
