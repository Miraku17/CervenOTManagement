-- 1. Insert the "view_accounting_dashboard" permission if it doesn't exist
INSERT INTO permissions (key, description)
VALUES ('view_accounting_dashboard', 'Allows viewing the accounting top-expense dashboard')
ON CONFLICT (key) DO NOTHING;

-- 2. Grant to the positions that manage liquidations
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name IN ('Operations Manager', 'HR', 'Accounting', 'Managing Director')
  AND perm.key = 'view_accounting_dashboard'
ON CONFLICT DO NOTHING;
