ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS patches_cents INTEGER NOT NULL DEFAULT 0 CHECK (patches_cents >= 0);
