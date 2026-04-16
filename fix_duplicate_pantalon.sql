-- SQL para eliminar automáticamente el duplicado de "Pantalón Largo"
-- Mantiene el registro más reciente y elimina el más antiguo

DELETE FROM garment_types 
WHERE name ILIKE '%pantal%' 
AND id NOT IN (
  SELECT id FROM garment_types 
  WHERE name ILIKE '%pantal%' 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Verificar que quedó solo uno
SELECT id, name, created_at FROM garment_types 
WHERE name ILIKE '%pantal%';