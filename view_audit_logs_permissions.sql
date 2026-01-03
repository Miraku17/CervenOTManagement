-- 1. Insert the "view_audit_logs" permission if it doesn't exist
INSERT INTO permissions (key, description)
VALUES ('view_audit_logs', 'Allows viewing of audit logs')
ON CONFLICT (key) DO NOTHING;

-- 2. Assign "view_audit_logs" permission to "Operations Manager" position
INSERT INTO position_permissions (position_id, permission_id)
SELECT
    p.id,
    perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'Operations Manager'
  AND perm.key = 'view_audit_logs'
ON CONFLICT DO NOTHING;
