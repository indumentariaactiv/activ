-- ATENCIÓN: Este script elimina TODOS los pedidos y sus datos asociados.
-- Ejecutar únicamente en el SQL Editor de Supabase cuando se desee empezar desde 0.

-- 1. Eliminar tablas secundarias que dependen de order_items
DELETE FROM order_item_persons;
DELETE FROM order_item_sizes;

-- 2. Eliminar las prendas (order_items)
DELETE FROM order_items;

-- 3. Eliminar información asociada a los pedidos (shipping, comments, designs)
DELETE FROM client_shipping_info;
DELETE FROM admin_comments;
DELETE FROM admin_designs;

-- 4. Finalmente, eliminar los pedidos
DELETE FROM orders;

-- Nota: No borramos las tablas maestras (garment_types, profiles, etc.) 
-- para no romper el funcionamiento de la app.
