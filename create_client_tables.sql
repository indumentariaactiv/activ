-- Create client_shipping_info table for order shipping details
CREATE TABLE IF NOT EXISTS client_shipping_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  preferred_carrier TEXT CHECK (preferred_carrier IN ('OCA', 'Andreani', 'Via Cargo')),
  order_purpose TEXT CHECK (order_purpose IN ('Deporte', 'Basquet', 'Tenis', 'Padel', 'Voley', 'Egresados Primaria', 'Egresados Secundaria', 'Grupos', 'Peñas')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(order_id)
);

-- Create admin_comments table for production notes
CREATE TABLE IF NOT EXISTS admin_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create admin_designs table for admin-uploaded designs
CREATE TABLE IF NOT EXISTS admin_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  design_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add fabric_type to order_items (only for remeras/shorts)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fabric_type TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_shipping_info_order_id ON client_shipping_info(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_comments_order_id ON admin_comments(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_designs_order_id ON admin_designs(order_id);

-- Enable RLS
ALTER TABLE client_shipping_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_designs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_shipping_info
CREATE POLICY "Users can view their own shipping info" ON client_shipping_info
FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Users can insert their own shipping info" ON client_shipping_info
FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can update their own shipping info" ON client_shipping_info
FOR UPDATE USING (auth.uid() = client_id);

CREATE POLICY "Admins can view all shipping info" ON client_shipping_info
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- RLS Policies for admin_comments
CREATE POLICY "Admins can manage comments" ON admin_comments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- RLS Policies for admin_designs
CREATE POLICY "Admins can manage designs" ON admin_designs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow public read access to admin designs (for viewing)
CREATE POLICY "Public can view admin designs" ON admin_designs
FOR SELECT USING (true);