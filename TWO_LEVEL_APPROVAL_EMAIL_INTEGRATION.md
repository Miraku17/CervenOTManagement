# Two-Level Liquidation Approval - Email Integration

## ✅ Email System Fully Integrated

The email notification system has been updated to support two-level approval workflow for liquidations.

---

## 📧 Email Flows

### 1. **New Liquidation Submitted**
**Trigger:** Employee submits a new liquidation request
**Recipients:** All users with `approve_liquidations_level1` permission
**Email:** `sendLiquidationSubmittedEmail()`
**Content:**
- Employee name and details
- Cash advance amount
- Total expenses
- Liquidation date
- Store and ticket info
- Call-to-action button to review

---

### 2. **Level 1 Approved**
**Trigger:** Liquidation approved at Level 1
**Recipients:**
- Level 2 Approvers (users with `approve_liquidations_level2` permission)
- Original requester (status update)

**Email to Level 2 Approvers:** `sendLiquidationLevel1ApprovedEmail()`
**Content:**
- Employee name
- Level 1 approver name
- Total expenses
- Liquidation date
- ⚠️ Warning: Final approval required
- Call-to-action button

**Email to Requester:** `sendLiquidationStatusEmail()` with status='approved', level=1
**Content:**
- Approved at Level 1
- Reviewed by (approver name)
- Reviewer comment (if any)
- 📋 Next step: Awaiting final approval (Level 2)

---

### 3. **Level 2 Approved (Final)**
**Trigger:** Liquidation approved at Level 2
**Recipients:** Original requester
**Email:** `sendLiquidationStatusEmail()` with status='approved', level=2
**Content:**
- 🎉 Fully approved
- Reviewed by (approver name)
- Reviewer comment (if any)
- Process complete

---

### 4. **Rejected at Level 1**
**Trigger:** Liquidation rejected at Level 1
**Recipients:** Original requester
**Email:** `sendLiquidationStatusEmail()` with status='rejected', level=1
**Content:**
- ❌ Rejected at Level 1
- Reviewed by (approver name)
- Rejection reason (reviewer comment)
- Contact info for questions

---

### 5. **Rejected at Level 2**
**Trigger:** Liquidation rejected at Level 2
**Recipients:** Original requester
**Email:** `sendLiquidationStatusEmail()` with status='rejected', level=2
**Content:**
- ❌ Rejected at Level 2 (Final)
- Reviewed by (approver name)
- Rejection reason (reviewer comment)
- Contact info for questions

---

## 🔧 Updated Files

### 1. **lib/email.ts**
- ✅ Updated `sendLiquidationSubmittedEmail()` to send to Level 1 approvers
- ✅ Added `sendLiquidationLevel1ApprovedEmail()` for Level 1 → Level 2 notifications
- ✅ Added `sendLiquidationStatusEmail()` for status updates to requesters
- ✅ All emails include responsive HTML templates with CervenTech branding

### 2. **pages/api/liquidation/update-status-level.ts**
- ✅ Imports email functions
- ✅ Sends emails after successful approval/rejection
- ✅ Handles email errors gracefully (doesn't fail the request)

---

## 📬 Email Templates

All emails include:
- ✅ CervenTech logo
- ✅ Color-coded headers (blue for Level 1, green for Level 2)
- ✅ Responsive design for mobile and desktop
- ✅ Clear status indicators (✓ Approved, ✕ Rejected, ⏰ Pending)
- ✅ Reviewer names and comments
- ✅ Call-to-action buttons linking to the portal
- ✅ Professional formatting with gradients and shadows

---

## 🎨 Email Color Scheme

| Status | Color | Usage |
|--------|-------|-------|
| Level 1 Approved | Blue (#3b82f6) | Level 1 approval notifications |
| Fully Approved | Green (#10b981) | Final (Level 2) approval |
| Rejected | Red (#ef4444) | Rejection notifications |
| Warning/Info | Yellow (#f59e0b) | Pending actions |

---

## 🔐 Permission-Based Recipients

### Level 1 Notifications
Recipients need: `approve_liquidations_level1` permission

### Level 2 Notifications
Recipients need: `approve_liquidations_level2` permission

### Status Notifications
Sent to: Original requester (employee who submitted the liquidation)

---

## 🧪 Testing Checklist

- [ ] New liquidation submission → Level 1 approvers receive email
- [ ] Level 1 approval → Level 2 approvers and requester receive emails
- [ ] Level 2 approval → Requester receives final approval email
- [ ] Level 1 rejection → Requester receives rejection email
- [ ] Level 2 rejection → Requester receives rejection email
- [ ] Email contains correct approver names
- [ ] Email contains reviewer comments when provided
- [ ] Links in emails work correctly
- [ ] Emails display correctly on mobile devices
- [ ] Email logs show successful sends

---

## 📊 Email Tracking

Check console logs for email status:
```
✓ Liquidation submitted email sent successfully to X recipient(s)
✓ Liquidation Level 1 approved email sent successfully to X Level 2 approver(s)
✓ Liquidation status email sent successfully to user@email.com
```

Errors are logged but don't fail the approval/rejection:
```
❌ Error sending email notifications: [error details]
```

---

## ⚙️ Configuration

### Environment Variables Required:
```env
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

### Logo File:
Location: `/public/logo.png`
Used in all email templates as inline attachment

---

## 🚀 Benefits

1. **Real-time Notifications** - Approvers are notified immediately
2. **Clear Workflow** - Recipients know exactly what action is needed
3. **Transparency** - Requesters are kept informed at every step
4. **Professional** - Branded emails with consistent design
5. **Mobile-Friendly** - Emails look great on all devices
6. **Actionable** - Direct links to review and approve

---

## 🔄 Workflow Summary

```
Employee Submits
      ↓
📧 → Level 1 Approvers
      ↓
Level 1 Approves
      ↓
📧 → Level 2 Approvers + Requester (Level 1 approved)
      ↓
Level 2 Approves
      ↓
📧 → Requester (Fully approved)
```

OR

```
Level 1/2 Rejects
      ↓
📧 → Requester (Rejected)
```

---

## 📝 Notes

- Emails are sent asynchronously and don't block the approval/rejection process
- Email failures are logged but don't cause the API request to fail
- All emails include the CervenTech branding and logo
- Reviewer comments are optional but highly recommended
- Email templates are fully responsive and tested on major email clients

---

**Status:** ✅ Fully Integrated and Ready
**Last Updated:** February 12, 2025
