# Two-Level Liquidation Approval System - Implementation Summary

## Overview
Successfully implemented a two-level approval system for liquidations with Level 1 and Level 2 approvals.

---

## 🗄️ Database Changes

### New Columns Added to `liquidations` table:
- `level1_approved_by` - UUID of Level 1 approver
- `level1_approved_at` - Timestamp of Level 1 approval
- `level1_reviewer_comment` - Level 1 reviewer's comment
- `level2_approved_by` - UUID of Level 2 approver (final)
- `level2_approved_at` - Timestamp of Level 2 approval (final)
- `level2_reviewer_comment` - Level 2 reviewer's comment

### New Permissions Created:
- `approve_liquidations_level1` - Can approve liquidations at Level 1
- `approve_liquidations_level2` - Can approve liquidations at Level 2 (final)

### Status Flow:
```
pending → level1_approved → approved
    ↓           ↓
  rejected    rejected
```

---

## 📂 Files Created

### SQL Migration Files:
1. **`supabase/migrations/20250212_add_two_level_liquidation_approval.sql`**
   - Main migration file
   - Adds columns and creates permissions

2. **`supabase/assign_liquidation_approval_permissions.sql`**
   - Helper queries to assign permissions to positions
   - Examples and verification queries

3. **`supabase/migrations/20250212_rollback_two_level_liquidation_approval.sql`**
   - Rollback script (if needed)

4. **`supabase/TWO_LEVEL_APPROVAL_README.md`**
   - Complete setup instructions

### API Files:
5. **`pages/api/liquidation/update-status-level.ts`** (NEW)
   - Handles two-level approval/rejection
   - Validates permissions for each level
   - Maintains backward compatibility

### Updated API Files:
6. **`pages/api/liquidation/get.ts`**
   - Now fetches level1 and level2 approver profiles
   - Returns `level1_approver` and `level2_approver` objects

---

## 🎨 Frontend Updates

### Updated Components:

1. **`components/admin_dashboard/LiquidationDetailModal.tsx`**
   - Added Level 1 and Level 2 approval sections
   - Shows approval status for both levels
   - Displays approver info for each level
   - Action buttons change based on current status:
     - Pending → Level 1 approval buttons
     - Level 1 Approved → Level 2 approval buttons
   - New status badge for "Level 1 Approved"

2. **`app/dashboard/admin/liquidation-requests/page.tsx`**
   - Added permission checks for `approve_liquidations_level1` and `approve_liquidations_level2`
   - Updated TypeScript interfaces to include new fields
   - Added "Level 1 Approved" status badge (blue color)
   - Passes level permissions to detail modal

---

## 🔐 Permission System

### How It Works:
Permissions are assigned to **positions** (not roles) via the `position_permissions` table.

### Permission Keys:
- `approve_liquidations_level1` - First level approval
- `approve_liquidations_level2` - Final approval

### Assigning Permissions:

```sql
-- Example: Assign Level 1 to Team Leaders
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT pos.id, p.id
FROM public.positions pos
CROSS JOIN public.permissions p
WHERE pos.name = 'Team Leader'
  AND p.key = 'approve_liquidations_level1'
ON CONFLICT DO NOTHING;

-- Example: Assign Level 2 to Managers
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT pos.id, p.id
FROM public.positions pos
CROSS JOIN public.permissions p
WHERE pos.name = 'Manager'
  AND p.key = 'approve_liquidations_level2'
ON CONFLICT DO NOTHING;
```

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration
Execute in Supabase SQL Editor:
```sql
-- File: supabase/migrations/20250212_add_two_level_liquidation_approval.sql
```

### Step 2: Verify Permissions Created
```sql
SELECT id, key, description
FROM public.permissions
WHERE key LIKE '%liquidation%'
ORDER BY key;
```

### Step 3: Check Your Positions
```sql
SELECT id, name FROM public.positions ORDER BY name;
```

### Step 4: Assign Permissions
Use queries from `supabase/assign_liquidation_approval_permissions.sql` to assign permissions to appropriate positions.

### Step 5: Verify Assignments
```sql
SELECT
  pos.name as position_name,
  p.key as permission_key,
  p.description
FROM public.position_permissions pp
JOIN public.positions pos ON pos.id = pp.position_id
JOIN public.permissions p ON p.id = pp.permission_id
WHERE p.key LIKE '%liquidation%'
ORDER BY pos.name, p.key;
```

---

## 📱 User Experience

### For Level 1 Approvers:
1. View liquidations with status "Pending"
2. Click to view details
3. Review expenses and receipts
4. Click "Approve Level 1" or "Reject"
5. Add optional comment
6. Upon approval, status changes to "Level 1 Approved"

### For Level 2 Approvers:
1. View liquidations with status "Level 1 Approved"
2. Click to view details
3. See who approved at Level 1 and their comment
4. Review all expenses and receipts
5. Click "Approve Level 2 (Final)" or "Reject"
6. Add optional comment
7. Upon approval, status changes to "Approved"

### Status Display:
- **Pending** - Yellow badge - Needs Level 1 approval
- **Level 1 Approved** - Blue badge - Needs Level 2 approval
- **Approved** - Green badge - Fully approved
- **Rejected** - Red badge - Rejected at any level

---

## 🔄 Backward Compatibility

The old fields are maintained for backward compatibility:
- `approved_by` - Still updated (set to level2 approver)
- `approved_at` - Still updated (set to level2 approval time)
- `reviewer_comment` - Still updated (set to level2 comment)

You can safely remove these after verifying the system works correctly.

---

## 🛡️ Special Rules

### HR and Accounting Liquidations:
- Level 2 approval for HR and Accounting liquidations **requires Managing Director**
- This rule is enforced in the API

### Permission Hierarchy:
Users with both permissions can approve at either level, but:
- Cannot approve their own liquidation request
- Must follow the sequential flow (Level 1 → Level 2)

---

## 🧪 Testing Checklist

- [ ] Run database migration
- [ ] Assign permissions to test positions
- [ ] Test Level 1 approval flow
- [ ] Test Level 2 approval flow
- [ ] Test rejection at Level 1
- [ ] Test rejection at Level 2
- [ ] Verify status badges display correctly
- [ ] Check approval info shows for both levels
- [ ] Test HR/Accounting liquidation restrictions
- [ ] Verify email notifications (if applicable)

---

## 📊 API Endpoints

### New Endpoint:
**POST** `/api/liquidation/update-status-level`

Request body:
```json
{
  "id": "liquidation-uuid",
  "action": "approve" | "reject",
  "level": 1 | 2,
  "adminId": "user-uuid",
  "reviewerComment": "optional comment"
}
```

Response:
```json
{
  "message": "Liquidation approved at Level 1 successfully",
  "liquidation": { /* updated liquidation object */ }
}
```

### Updated Endpoint:
**GET** `/api/liquidation/get`

Now returns additional fields:
- `level1_approver` object
- `level2_approver` object
- `level1_approved_at`, `level1_approved_by`, `level1_reviewer_comment`
- `level2_approved_at`, `level2_approved_by`, `level2_reviewer_comment`

---

## 🐛 Troubleshooting

### Issue: Permissions not working
**Solution:** Verify permissions are assigned to the position, not role:
```sql
SELECT * FROM position_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE key LIKE '%liquidation%'
);
```

### Issue: Level 2 approvers can't see Level 1 approved liquidations
**Solution:** Check permission assignment and status filter in the UI.

### Issue: Status not updating
**Solution:** Check API response for errors. Verify the status flow is correct.

---

## 📝 Notes

- Old `approve_liquidations` permission still works but is deprecated
- The system is designed to be flexible - you can add more levels if needed in the future
- All approval history is preserved in the database
- Consider adding email notifications for each approval level

---

## 🎯 Next Steps (Optional Enhancements)

1. Add email notifications for each approval level
2. Add dashboard widgets showing pending approvals by level
3. Add reporting/analytics for approval times
4. Add bulk approval functionality
5. Add approval delegation feature
6. Add configurable approval rules (e.g., amount thresholds)

---

**Implementation Date:** February 12, 2025
**Status:** ✅ Complete
