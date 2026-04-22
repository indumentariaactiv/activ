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
    <div className="bg-white text-black p-0 font-sans print:p-0 max-w-[1000px] mx-auto shadow-lg print:shadow-none min-h-[11in]">
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
        {order.order_items?.map((item: any, idx: number) => {
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
            <div key={item.id} className="break-inside-avoid">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-black text-red-600">IDEM {idx + 1}:</span>
                <span className="text-sm font-black uppercase">{item.garment_types?.name} - {item.category}</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                <div className="space-y-6">
                  {/* Ficha Técnica Grid */}
                  {hasFicha && (
                    <div className="border border-black overflow-hidden">
                      <div className="bg-gray-100 px-3 py-1 text-[9px] font-black uppercase border-b border-black">Especificaciones Técnicas</div>
                      <div className="grid grid-cols-2">
                        {isRem && (
                          <>
                            <div className="border-r border-b border-black p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Tela</span>
                              <span className="text-[10px] font-black uppercase">{item.fabric_type || '—'}</span>
                            </div>
                            <div className="border-b border-black p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Cuello</span>
                              <span className="text-[10px] font-black uppercase">{item.collar_type || '—'}</span>
                            </div>
                            <div className="border-r border-black p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Mangas</span>
                              <span className="text-[10px] font-black uppercase">{item.sleeve_type || '—'}</span>
                            </div>
                            <div className="p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Color M.</span>
                              <span className="text-[10px] font-black uppercase">{item.sleeve_color || '—'}</span>
                            </div>
                          </>
                        )}
                        {isMusculosa && (
                          <div className="col-span-2 p-2 flex items-center">
                            <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Tela</span>
                            <span className="text-[10px] font-black uppercase">{item.fabric_type || '—'}</span>
                          </div>
                        )}
                        {isShort && (
                          <>
                            <div className="border-r border-black p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Tela</span>
                              <span className="text-[10px] font-black uppercase">{item.fabric_type || '—'}</span>
                            </div>
                            <div className="p-2 flex items-center">
                              <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Bolsillos</span>
                              <span className="text-[10px] font-black uppercase">
                                {item.observations?.includes('Con Bolsillos') || item.notes?.includes('Con Bolsillos') ? 'Con Bolsillos' : 'Sin Bolsillos'}
                              </span>
                            </div>
                          </>
                        )}
                        {(isCamp || isBuzo) && (
                          <div className="col-span-2 p-2 flex items-center">
                            <span className="text-[8px] font-bold text-gray-500 uppercase w-16">Estilo</span>
                            <span className="text-[10px] font-black uppercase">{item.collar_type || '—'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sizes Table for Item */}
                  <div className="border border-gray-300">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-emerald-600 text-white">
                          <th className="p-1 border-r border-white/20 text-[9px] font-black uppercase text-left pl-3">Talle</th>
                          {itemSizes.length > 0 ? itemSizes.map(size => (
                            <th key={size} className="p-1 border-r border-white/20 text-center text-[9px] font-black uppercase">{size}</th>
                          )) : (
                            <th className="p-1 text-center text-[9px] font-black uppercase">Detalle</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-1.5 border-r border-gray-200 text-[9px] font-bold uppercase bg-gray-50 pl-3">Cant.</td>
                          {itemSizes.length > 0 ? itemQuantities.map((q, qIdx) => (
                            <td key={qIdx} className="p-1.5 border-r border-gray-200 text-center text-[10px] font-black">{q}</td>
                          )) : (
                            <td className="p-1.5 text-center text-[10px] font-black">Unitario / Sin Talle ({itemTotal})</td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Item Notes */}
                  <div className="text-[10px]">
                    <span className="font-black text-gray-500 uppercase">Notas:</span>
                    <p className="font-bold uppercase mt-1">{item.admin_comment || item.notes || 'SIN OBSERVACIONES'}</p>
                  </div>
                </div>

                {/* Item Design Image */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[180px] aspect-[4/5] bg-white border-2 border-gray-100 flex items-center justify-center p-2 rounded shadow-sm">
                    {(item.custom_design_url || item.designs?.image_url) ? (
                      <img src={item.custom_design_url || item.designs?.image_url} alt="Diseño" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[8px] font-bold text-gray-300 uppercase text-center">Sin imagen de diseño</div>
                    )}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Diseño Adjunto</span>
                </div>
              </div>

              {/* Personalization Table if exists */}
              {item.has_personalization && item.order_item_persons?.length > 0 && (
                <div className="mt-6 border border-gray-300">
                  <div className="bg-blue-600 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wider">Planilla de Estampado Individual</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="p-1 border-r border-gray-200 text-[8px] font-black uppercase text-center w-12">Nº</th>
                        <th className="p-1 border-r border-gray-200 text-[8px] font-black uppercase text-center w-12">Talle</th>
                        <th className="p-1 text-[8px] font-black uppercase text-left pl-3">Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.order_item_persons.map((p: any, pIdx: number) => (
                        <tr key={pIdx} className="border-b border-gray-100 last:border-0">
                          <td className="p-1.5 border-r border-gray-200 text-center text-[10px] font-black">{p.person_number || '-'}</td>
                          <td className="p-1.5 border-r border-gray-200 text-center text-[10px] font-bold">{p.size}</td>
                          <td className="p-1.5 text-[10px] font-black uppercase pl-3">{p.person_name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
