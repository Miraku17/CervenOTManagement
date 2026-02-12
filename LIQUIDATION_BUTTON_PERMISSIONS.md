# Liquidation Approval/Rejection Button Permissions

## Overview
The approval and rejection buttons in the liquidation detail modal are controlled by both **permissions** and **liquidation status**.

---

## 🔐 Permission Requirements

### **Page Access**
Users need **at least one** of these permissions to access the liquidation requests page:
- `manage_liquidation` - Full management access
- `approve_liquidations` - Legacy approval permission (still supported)
- `approve_liquidations_level1` - Level 1 approval
- `approve_liquidations_level2` - Level 2 approval (final)

### **Button Visibility**
The approve/reject buttons are shown based on:
1. User's permission level
2. Current liquidation status

---

## 👥 Who Can See Which Buttons

### **Level 1 Approvers**
**Permission:** `approve_liquidations_level1`

**Can See Buttons When:**
- Liquidation status is **"Pending"**

**Buttons Shown:**
- ✅ **Approve Level 1** (blue button)
- ❌ **Reject** (red button)

**Cannot See Buttons When:**
- Status is "Level 1 Approved" (needs Level 2)
- Status is "Approved" (already approved)
- Status is "Rejected" (already rejected)

---

### **Level 2 Approvers**
**Permission:** `approve_liquidations_level2`

**Can See Buttons When:**
- Liquidation status is **"Level 1 Approved"**

**Buttons Shown:**
- ✅ **Approve Level 2 (Final)** (green button)
- ❌ **Reject** (red button)

**Cannot See Buttons When:**
- Status is "Pending" (needs Level 1 first)
- Status is "Approved" (already approved)
- Status is "Rejected" (already rejected)

---

### **Users with Both Permissions**
**Permissions:** Both `approve_liquidations_level1` AND `approve_liquidations_level2`

**Can Approve At:**
- ✅ Level 1 when status is "Pending"
- ✅ Level 2 when status is "Level 1 Approved"

**Note:** They still need to follow the sequential flow (cannot skip Level 1)

---

### **Managers/Administrators**
**Permission:** `manage_liquidation`

**Access:**
- ✅ Can view all liquidations
- ✅ Can edit liquidations
- ✅ Can delete liquidations
- ❌ Cannot approve/reject (unless they also have Level 1 or Level 2 permission)

---

## 📊 Button Display Logic

### **Status: Pending**
| User Permission | Buttons Shown |
|----------------|---------------|
| `approve_liquidations_level1` | Approve Level 1, Reject |
| `approve_liquidations_level2` | None (View Only) |
| Both Level 1 & 2 | Approve Level 1, Reject |
| `manage_liquidation` only | None (View Only) |

### **Status: Level 1 Approved**
| User Permission | Buttons Shown |
|----------------|---------------|
| `approve_liquidations_level1` | None (View Only) |
| `approve_liquidations_level2` | Approve Level 2 (Final), Reject |
| Both Level 1 & 2 | Approve Level 2 (Final), Reject |
| `manage_liquidation` only | None (View Only) |

### **Status: Approved**
| User Permission | Buttons Shown |
|----------------|---------------|
| All users | None (View Only - Close button only) |

### **Status: Rejected**
| User Permission | Buttons Shown |
|----------------|---------------|
| All users | None (View Only - Close button only) |

---

## 🎯 Code Implementation

### **Modal Props:**
```typescript
<LiquidationDetailModal
  canApproveLiquidation={canApproveLiquidation}  // Legacy (optional)
  canApproveLevel1={canApproveLevel1}            // Level 1 permission
  canApproveLevel2={canApproveLevel2}            // Level 2 permission
  // ... other props
/>
```

### **Button Logic:**
```typescript
// Level 1 buttons shown when:
liquidation.status === 'pending' && canApproveLevel1

// Level 2 buttons shown when:
liquidation.status === 'level1_approved' && canApproveLevel2
```

---

## 🔄 Workflow Example

### **Scenario 1: Standard Two-Level Approval**

1. **Employee submits liquidation**
   - Status: "Pending"

2. **Level 1 Approver (Team Leader) opens liquidation**
   - Sees: "Approve Level 1" and "Reject" buttons
   - Clicks: "Approve Level 1"
   - Status changes to: "Level 1 Approved"

3. **Level 2 Approver (Manager) opens liquidation**
   - Sees: "Approve Level 2 (Final)" and "Reject" buttons
   - Clicks: "Approve Level 2 (Final)"
   - Status changes to: "Approved"

---

### **Scenario 2: User with Both Permissions**

1. **Employee submits liquidation**
   - Status: "Pending"

2. **Managing Director (has both Level 1 & 2 permissions) opens liquidation**
   - Sees: "Approve Level 1" and "Reject" buttons
   - Clicks: "Approve Level 1"
   - Status changes to: "Level 1 Approved"

3. **Same Managing Director opens again**
   - Now sees: "Approve Level 2 (Final)" and "Reject" buttons
   - Clicks: "Approve Level 2 (Final)"
   - Status changes to: "Approved"

**Note:** Even with both permissions, they must follow the sequential flow!

---

### **Scenario 3: Rejection at Level 1**

1. **Employee submits liquidation**
   - Status: "Pending"

2. **Level 1 Approver opens liquidation**
   - Sees: "Approve Level 1" and "Reject" buttons
   - Clicks: "Reject"
   - Status changes to: "Rejected"

3. **No further action needed**
   - Process ends
   - Level 2 approvers cannot see it (if filtered by status)

---

## 🚫 Restrictions

### **Cannot Approve Own Liquidations**
While not enforced in the UI permissions, the API should prevent users from approving their own liquidation requests.

### **Cannot Skip Levels**
- Level 2 approvers cannot approve when status is "Pending"
- Must follow: Pending → Level 1 Approved → Approved

### **Cannot Re-Approve**
Once approved or rejected, no buttons are shown (read-only mode)

---

## 📝 Special Cases

### **HR and Accounting Liquidations**
- **Special Rule:** Level 2 approval must be done by Managing Director
- **Enforced In:** API endpoint (update-status-level.ts)
- **Effect:** Even if a user has `approve_liquidations_level2`, they cannot approve HR/Accounting liquidations unless they are Managing Director

### **View-Only Access**
Users with only `manage_liquidation` permission can:
- ✅ View all liquidations
- ✅ See approval history for both levels
- ✅ Edit liquidation details
- ❌ Cannot approve or reject

---

## 🔧 Configuration

### **To Grant Level 1 Approval:**
```sql
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT pos.id, p.id
FROM public.positions pos
CROSS JOIN public.permissions p
WHERE pos.name = 'Team Leader'  -- Your position name
  AND p.key = 'approve_liquidations_level1'
ON CONFLICT DO NOTHING;
```

### **To Grant Level 2 Approval:**
```sql
INSERT INTO public.position_permissions (position_id, permission_id)
SELECT pos.id, p.id
FROM public.positions pos
CROSS JOIN public.permissions p
WHERE pos.name = 'Manager'  -- Your position name
  AND p.key = 'approve_liquidations_level2'
ON CONFLICT DO NOTHING;
```

---

## ✅ Summary

| Permission | Pending Status | Level 1 Approved | Approved/Rejected |
|------------|---------------|------------------|-------------------|
| Level 1 | Show buttons | View only | View only |
| Level 2 | View only | Show buttons | View only |
| Both L1 & L2 | Show L1 buttons | Show L2 buttons | View only |
| Manage only | View only | View only | View only |

**Button Colors:**
- Level 1 Approve: 🔵 Blue
- Level 2 Approve: 🟢 Green
- Reject: 🔴 Red

---

**Last Updated:** February 12, 2025
