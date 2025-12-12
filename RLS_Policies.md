# Supabase Row Level Security (RLS) Implementation Guide

This document outlines the recommended RLS policies for your Supabase tables, designed to enhance security by restricting direct client-side database writes and leveraging your secure server-side APIs.

### **Strategy Overview**

Since critical operations (like clocking in/out, creating employees) are handled by your **Server-Side APIs** using the Service Role (`supabaseAdmin`), RLS policies are primarily focused on:

-   **Read (SELECT) Access:** Allowing authenticated users to view their own data (e.g., attendance, leave requests) or shared reference data (e.g., stores, positions).
-   **Write (INSERT/UPDATE) Access:** Generally **denying** direct client-side write access for sensitive operations. Instead, these operations must go through your secure APIs, which utilize the `supabaseAdmin` to bypass RLS checks safely on the server.

---

### **1. Enable RLS on All Sensitive Tables**

Run the following SQL commands in your **Supabase Dashboard > SQL Editor** to enable RLS on your project's tables.

```sql
-- Enable RLS on all sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Inventory / Metadata tables (based on codebase usage)
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
```

---

### **2. Create Security Policies**

#### **A. `profiles` Table (User Profiles)**
*Users can read all profiles (e.g., to display colleague names) but can only edit their own profile details.*

```sql
-- Allow authenticated users to read all profiles
CREATE POLICY "Enable read access for authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update ONLY their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);
```

#### **B. `attendance` & `overtime` Tables (Strict User-Specific Access)**
*Users can ONLY see their own records. Direct client-side `INSERT`/`UPDATE` operations are implicitly denied (handled by server APIs using `supabaseAdmin`).*

```sql
-- Attendance: Users can view their own attendance records
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Overtime: Users can view their own overtime requests
CREATE POLICY "Users can view own overtime"
ON public.overtime FOR SELECT
TO authenticated
USING (auth.uid() = requested_by);
```

#### **C. `leave_requests` Table (User-Specific Access)**
*Users can view their own leave requests. Management of leave requests (e.g., approvals, updates) is typically handled by admin APIs.*

```sql
-- Leave Requests: Users can view their own leave requests
CREATE POLICY "Users can view own leave requests"
ON public.leave_requests FOR SELECT
TO authenticated
USING (auth.uid() = employee_id);
```

#### **D. Shared Reference Data Tables (`positions`, `stores`, `stations`, `brands`, `categories`, `models`)**
*These tables contain reference data that should be read-only for all authenticated users. Modifications are assumed to be handled by admin APIs.*

```sql
-- Positions: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.positions FOR SELECT
TO authenticated
USING (true);

-- Stores: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.stores FOR SELECT
TO authenticated
USING (true);

-- Stations: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.stations FOR SELECT
TO authenticated
USING (true);

-- Brands: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.brands FOR SELECT
TO authenticated
USING (true);

-- Categories: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.categories FOR SELECT
TO authenticated
USING (true);

-- Models: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.models FOR SELECT
TO authenticated
USING (true);
```

#### **E. `store_managers` Table (Reference Data)**
*This table contains manager information linked to stores and should be read-only for all authenticated users. Modifications are handled by admin APIs.*

```sql
-- Store Managers: Read-only for all authenticated users
CREATE POLICY "Enable read access for authenticated users"
ON public.store_managers FOR SELECT
TO authenticated
USING (true);
```

#### **F. `tickets` Table (Ticketing System)**
*This policy allows authenticated users to create and manage tickets. Adjust `SELECT` and `UPDATE` policies if you require stricter access (e.g., only see tickets assigned to them or their store).*

```sql
-- Tickets: Allow authenticated users to view all tickets
CREATE POLICY "Enable read access for authenticated users"
ON public.tickets FOR SELECT
TO authenticated
USING (true);

-- Tickets: Allow authenticated users to create new tickets
CREATE POLICY "Enable insert for authenticated users"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (true);

-- Tickets: Allow authenticated users to update tickets
CREATE POLICY "Enable update for authenticated users"
ON public.tickets FOR UPDATE
TO authenticated
USING (true);
```

---

### **How to Apply These Policies**

1.  Open your **Supabase Dashboard**.
2.  Navigate to the **SQL Editor** (the icon resembling a terminal on the left sidebar).
3.  Copy and paste each SQL block (from "1. Enable RLS..." and each section under "2. Create Security Policies") into the editor.
4.  Execute each block by clicking **Run**.

### **Why this Approach is More Secure**

-   **Defense in Depth:** RLS provides an essential layer of security directly at the database level, preventing unauthorized data access even if application-level security measures are bypassed or misconfigured.
-   **Client-Side Protection:** By denying direct client-side `INSERT`/`UPDATE` for sensitive tables, you force all such operations through your backend APIs. This ensures that your application's business logic and validation rules are always applied.
-   **Clearer Responsibilities:** The database is responsible for "who can access what data," while your application code focuses on "what actions can be performed on the data."
