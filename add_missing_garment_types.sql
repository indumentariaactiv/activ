-- SQL para agregar los tipos de prendas faltantes a la tabla garment_types
-- Ejecutar en el SQL Editor de Supabase

-- Short
INSERT INTO garment_types (name, categories) VALUES
('Short', '{"Hombre": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"], "Mujer": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"], "Niño": ["4", "6", "8", "10", "12", "14", "16"]}');

-- Musculosas
INSERT INTO garment_types (name, categories) VALUES
('Musculosas', '{"Hombre": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"], "Mujer": ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL"]}');

-- Bandera
INSERT INTO garment_types (name, categories) VALUES
('Bandera', '{"Cantidad": ["Cantidad"]}');

-- Bolso Deportivo
INSERT INTO garment_types (name, categories) VALUES
('Bolso Deportivo', '{"Cantidad": ["Cantidad"]}');

-- Bolso Paletero
INSERT INTO garment_types (name, categories) VALUES
('Bolso Paletero', '{"Cantidad": ["Cantidad"]}');

-- Botinero
INSERT INTO garment_types (name, categories) VALUES
('Botinero', '{"Cantidad": ["Cantidad"]}');

-- Verificar que se insertaron correctamente
SELECT id, name, categories FROM garment_types ORDER BY name;