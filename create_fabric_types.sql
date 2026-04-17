-- Create fabric_types table
CREATE TABLE IF NOT EXISTS fabric_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  weight_g_m2 INTEGER,
  composition TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial fabric types
INSERT INTO fabric_types (name, description, composition) VALUES
('Deportiva', 'Tela para prendas deportivas, resistente y transpirable', 'Poliéster'),
('Algodón', 'Tela de algodón 100%, suave y cómoda', 'Algodón')
ON CONFLICT (name) DO NOTHING;

-- Create RLS policies for fabric_types
ALTER TABLE fabric_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to fabric_types" ON fabric_types
FOR SELECT USING (true);

-- Optionally, if only admins can modify:
CREATE POLICY "Allow insert/update/delete for authenticated users (set to admin role in production)" ON fabric_types
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
