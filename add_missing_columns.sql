-- Add missing columns to support new features
-- Add admin_comment for garment comments in admin panel
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- Add manufacturing_code for factory tracking
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS manufacturing_code TEXT;

-- Add email to client shipping info
ALTER TABLE client_shipping_info ADD COLUMN IF NOT EXISTS email TEXT;