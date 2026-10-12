CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY,
  idempotency_key UUID NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  preference_id TEXT UNIQUE,
  checkout_url TEXT,
  item_lines JSONB NOT NULL,
  customer JSONB NOT NULL,
  shipping JSONB NOT NULL,
  shirt_quantity INTEGER NOT NULL CHECK (shirt_quantity BETWEEN 1 AND 30),
  shirts_cents INTEGER NOT NULL CHECK (shirts_cents >= 0),
  customization_cents INTEGER NOT NULL CHECK (customization_cents >= 0),
  shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_order_payments (
  payment_id TEXT PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES store_orders(id),
  status TEXT NOT NULL
    CHECK (status IN ('approved', 'pending', 'rejected', 'cancelled', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL,
  live_mode BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_orders_created_at_idx ON store_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS store_order_payments_order_id_idx ON store_order_payments (order_id);
