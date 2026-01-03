-- 1. Insert the "manage_assets" permission if it doesn't exist (User said it might exist, but safe to ignore conflicts)
INSERT INTO permissions (key, description)
VALUES ('manage_assets', 'Allows management of asset inventory')
ON CONFLICT (key) DO NOTHING;

-- 2. Assign "manage_assets" permission to required positions
-- Positions: 'Operations Manager', 'Asset', 'Assets'
-- We use ON CONFLICT DO NOTHING to avoid duplicates if re-run

INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name IN ('Operations Manager', 'Asset', 'Assets')
  AND perm.key = 'manage_assets'
ON CONFLICT DO NOTHING;

-- 3. Ensure 'Field Engineer' does NOT have this permission
DELETE FROM position_permissions
WHERE position_id IN (SELECT id FROM positions WHERE name = 'Field Engineer')
  AND permission_id IN (SELECT id FROM permissions WHERE key = 'manage_assets');
