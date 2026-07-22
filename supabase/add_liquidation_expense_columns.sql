-- Add new expense category columns to liquidation_items
-- (tools, supplies, mobility_transport) alongside jeep/bus/fx_van/gas/toll/meals/lodging/others
-- Run against prod at deploy time.

ALTER TABLE liquidation_items
  ADD COLUMN IF NOT EXISTS tools numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplies numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mobility_transport numeric(12,2) DEFAULT 0;
