-- SQL para agregar el campo fabric_group a la tabla order_items
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE order_items ADD COLUMN fabric_group INTEGER;

-- Opcional: Agregar un comentario a la columna
COMMENT ON COLUMN order_items.fabric_group IS 'Grupo de tela para fichas de producción (prendas con misma tela van juntas)';