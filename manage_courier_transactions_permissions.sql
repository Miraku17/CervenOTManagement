-- 1. Insert the "manage_courier_transactions" permission if it doesn't exist
INSERT INTO permissions (key, description)
VALUES ('manage_courier_transactions', 'Allows management of courier transactions')
ON CONFLICT (key) DO NOTHING;

-- 2. Assign "manage_courier_transactions" permission to required positions
-- (same starting set as manage_assets; adjust position names as needed)
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name IN ('Operations Manager', 'Asset')
  AND perm.key = 'manage_courier_transactions'
ON CONFLICT DO NOTHING;
