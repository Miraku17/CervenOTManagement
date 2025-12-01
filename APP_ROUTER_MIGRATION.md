# App Router Migration Plan

## Current Status
- ✅ Created `app/` directory structure
- ✅ Created root layout (`app/layout.tsx`)
- ✅ Migrated home page (`app/page.tsx`)

## Files to Migrate

### Auth Pages
- [ ] `pages/auth/login.tsx` → `app/auth/login/page.tsx`
- [ ] `pages/auth/forgot-password.tsx` → `app/auth/forgot-password/page.tsx`
- [ ] `pages/auth/reset-password.tsx` → `app/auth/reset-password/page.tsx`

### Dashboard Pages
- [ ] `pages/dashboard/employee.tsx` → `app/dashboard/employee/page.tsx`
- [ ] `pages/admin/dashboard.tsx` → `app/admin/dashboard/page.tsx`

### Middleware & Protection
- [ ] Create `middleware.ts` for auth protection
- [ ] Remove HOCs (`hoc/withAuth.tsx`, `hoc/withGuest.tsx`)

### Hooks to Update
- [ ] Update `hooks/useAuth.ts` - Change `next/router` to `next/navigation`
- [ ] Verify `hooks/useUser.ts` compatibility

### Components
- All components should work as-is (they're already client components)

## Key Changes

###1. Router Import
```typescript
// Old (Pages Router)
import { useRouter } from 'next/router';

// New (App Router)
import { useRouter } from 'next/navigation';
```

### 2. Query Parameters
```typescript
// Old
router.query.message

// New
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
searchParams.get('message');
```

### 3. Client Components
All interactive pages need `'use client'` directive at the top

### 4. Middleware Instead of HOCs
Use `middleware.ts` at root for route protection

## Next Steps
1. Migrate login page
2. Migrate other auth pages
3. Migrate dashboard pages
4. Create middleware
5. Update hooks
6. Test all routes
7. Remove old `pages/` directory (after testing)
