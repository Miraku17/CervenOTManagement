# Security Vulnerability Fix: Phantom Profile Attack & RLS Implementation

## 🚨 Vulnerability Summary
**Critical Severity:** The application was vulnerable to unauthorized database access and privilege escalation.
- **Root Cause:** Row Level Security (RLS) was disabled on the `profiles` table (and others).
- **Exploit:** An attacker could use the public Anon Key to insert a row directly into the `profiles` table with `role: 'admin'`, bypassing authentication and gaining administrative privileges in the application logic.

## ✅ Fix Implementation Guide

### 1. Database Security (Supabase SQL Editor)
Execute the following SQL commands to enable RLS and strictly define access policies.

#### A. Create Helper Function
This function allows RLS policies to safely check user roles without recursion.
```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
```

#### B. Secure `profiles` Table
**CRITICAL:** We prevent all direct `INSERT/UPDATE/DELETE` from the client. Only the Service Role (API) can modify profiles.
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING (get_my_role() = 'admin');

-- NO INSERT/UPDATE POLICY for public/authenticated users.
-- This effectively blocks the "phantom profile" attack.
```

#### C. Secure Other Tables
Apply these policies to lock down other sensitive data.

**Tickets:**
```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant tickets" 
ON tickets FOR SELECT 
USING (auth.uid() = reported_by OR auth.uid() = serviced_by OR get_my_role() = 'admin'); // done

CREATE POLICY "Users can create tickets" 
ON tickets FOR INSERT 
WITH CHECK (auth.uid() = reported_by); // this should be admin // done

CREATE POLICY "Users can update serviced tickets" 
ON tickets FOR UPDATE 
USING (auth.uid() = serviced_by OR get_my_role() = 'admin'); // done 

CREATE POLICY "Admins can delete tickets" 
ON tickets FOR DELETE 
USING (get_my_role() = 'admin'); // done
```

**Attendance:**
```sql
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance" 
ON attendance FOR SELECT 
USING (auth.uid() = user_id OR get_my_role() = 'admin');

CREATE POLICY "Users can clock in" 
ON attendance FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can clock out" 
ON attendance FOR UPDATE 
USING (auth.uid() = user_id);
```

**Overtime:**
```sql
ALTER TABLE overtime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overtime" 
ON overtime FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM attendance WHERE attendance.id = overtime.attendance_id AND attendance.user_id = auth.uid()) 
  OR get_my_role() = 'admin'
);
```

### 2. Cleanup (Garbage Collection)
Remove any fake accounts created during the vulnerability window.
```sql
DELETE FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);
```

### 3. API Key Rotation
Since the `anon` key was exposed during testing/exploitation:
1. Go to **Supabase Dashboard > Project Settings > API**.
2. Click **Generate New Key** for the `anon` (public) key.
3. Update your `.env.local` file with the new key.
   ```env
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_key_here
   ```
4. Redeploy your application to propagation the new environment variable.

## 🧪 Verification
After applying the fixes, attempt the attack again using `curl`:

```bash
# This should now FAIL with a 401/403 Error
curl -X POST 'https://<PROJECT_REF>.supabase.co/rest/v1/profiles' \
  -H 'apikey: <YOUR_ANON_KEY>' \
  -H 'Authorization: Bearer <YOUR_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '[{"id": "test-uuid", "role": "admin"}]'
```
