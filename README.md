# Cerventech HR Employee Portal

A full-stack employee management system built for **Cerventech Inc.**, handling attendance tracking, overtime and leave management, expense liquidation, asset ticketing, and inventory management.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router + Pages Router) |
| **Frontend** | React 19, Tailwind CSS 4, Radix UI, Recharts, Lexical Editor |
| **Backend** | Next.js API Routes (Node.js) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth with MFA (TOTP) |
| **Email** | Nodemailer (Gmail SMTP) |
| **AI** | Google Gemini API (timesheet analysis) |
| **Language** | TypeScript 5.8 |

## Features

### Attendance & Time Tracking
- Clock in/out with GPS location capture and address logging
- Daily attendance summaries and work logs
- Admin time editing with full audit trail
- Stale session detection and management
- Philippine timezone support (Asia/Manila)

### Overtime Management
- File, edit, and delete overtime requests
- Admin approval/rejection workflow
- History tracking with attendance integration

### Leave Management
- Multi-type leave requests with approval workflow
- Leave credits management and bulk upload
- Revoke approved leave requests

### Cash Advance & Expense Liquidation
- Cash advance requests with approval flow
- Expense liquidation with receipt upload
- **Two-level approval system:**
  - Level 1: Team Lead / Supervisor
  - Level 2: Manager / Managing Director
- Auto-approval rules for HR and Accounting
- Export to Excel and PDF

### Ticketing System (Asset Management)
- Report defective assets with severity levels and problem categories
- Ticket lifecycle: Open, In Progress, Closed
- Store-based organization with RCC reference tracking
- Bulk import/export and audit logging

### Inventory Management
- Store inventory tracking with brands, categories, and models
- Asset inventory CRUD with bulk import
- Stock level management and autocomplete search

### Knowledge Base
- Rich text articles with Lexical editor
- Categorization and search
- Access control (public/private)

### Admin Dashboard
- Employee management (create, edit, enable/disable)
- Holiday and work schedule management
- Bulk operations (leave credits, schedule imports)
- Reports and data export (Excel, PDF, CSV)
- Night differential calculation and export

## Authentication & Authorization

- **Login:** Email + password via Supabase Auth
- **MFA:** TOTP-based two-factor authentication (AAL2)
- **RBAC:** Role-based access control (`admin` / `employee`)
- **Permissions:** Position-based fine-grained permissions via `position_permissions` table
- **Security:** Row Level Security (RLS), API middleware auth, service role separation

## Project Structure

```
app/                          # Next.js App Router
  auth/                       # Login, MFA setup/verify, password reset
  dashboard/
    admin/                    # Admin views (employees, requests, reports)
    employee/                 # Employee dashboard
    ticketing/                # Tickets, defective assets, inventory
    knowledge-base/           # Knowledge base articles
    settings/                 # User settings

pages/api/                    # REST API routes
  attendance/                 # Clock in/out, work logs
  admin/                      # Admin operations
  employees/                  # Employee CRUD
  overtime/                   # Overtime requests
  leave/                      # Leave requests
  liquidation/                # Expense liquidation (2-level approval)
  cash-advance/               # Cash advance requests
  tickets/                    # Ticketing system
  assets/                     # Asset inventory
  inventory/                  # Store inventory
  permissions/                # Permission checks
  audit-logs/                 # Audit trail

components/
  admin_dashboard/            # Admin-specific components
  employee_dashboard/         # Employee-specific components
  ticketing/                  # Ticketing & inventory components
  ui/                         # Shared UI components (Radix-based)

lib/                          # Utilities (auth middleware, permissions, email)
services/                     # Supabase client, Gemini AI service
hooks/                        # React hooks (auth, permissions, MFA, queries)
supabase/                     # Database migrations & SQL scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

### Environment Variables

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EMAIL_USER=your_email@example.com
EMAIL_APP_PASSWORD=your_email_app_password
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

The app will be available at `http://localhost:3000`.

### Database Setup

Apply the SQL migrations in the `supabase/` directory to your Supabase project. Key tables include:

- `profiles` - User profiles with roles and positions
- `positions` / `permissions` / `position_permissions` - RBAC system
- `attendance` - Clock in/out records with GPS
- `overtime`, `leave_requests`, `liquidation`, `cash_advance` - Request workflows
- `tickets`, `stores`, `store_inventory`, `assets` - Ticketing and inventory
- `audit_logs` - Activity audit trail
- `knowledge_base` - Knowledge articles

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## License

Proprietary - Cerventech Inc. All rights reserved.
