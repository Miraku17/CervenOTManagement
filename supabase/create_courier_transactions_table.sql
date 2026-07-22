-- Courier Transactions table (Operations / Inventory)
-- Run against prod at deploy time, together with manage_courier_transactions_permissions.sql
-- and creation of the private `courier-invoices` storage bucket.

CREATE TABLE IF NOT EXISTS courier_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL,
  ticket_id bigint REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_number varchar(100),          -- snapshot of the ticket ref / free text when no ticket exists
  pick_up_from varchar(255) NOT NULL,
  deliver_to varchar(255) NOT NULL,
  part_name varchar(255),
  courier varchar(100),
  reference_number varchar(100),
  amount numeric(12,2) DEFAULT 0,
  store_id uuid REFERENCES stores(id),
  invoice_path text,                   -- storage path in the courier-invoices bucket
  invoice_file_name varchar(255),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courier_tx_date ON courier_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_courier_tx_ticket ON courier_transactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_courier_tx_store ON courier_transactions(store_id);
