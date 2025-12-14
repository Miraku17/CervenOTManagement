export interface UserProfile {
  id?: string;
  // name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  employee_id?: string;
  positions?: { name: string };
  contact_number?: string;
  address?: string;
  leave_credits?: number;
}

export interface WorkLog {
  id: string;
  date: string; // ISO Date String YYYY-MM-DD
  startTime: number; // Timestamp
  endTime: number | null; // Timestamp
  durationSeconds: number;
  status: 'COMPLETED' | 'IN_PROGRESS';
  comment?: string;
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
}

export interface DayStats {
  date: string;
  totalSeconds: number;
  logs: WorkLog[];
}


export interface Employee {
  id: string;
  employee_id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email: string;
  contact_number: string;
  address: string;
  position: string;
  department: string;
  joinDate: string;
  avatarUrl: string;
  status: 'Active' | 'On Leave' | 'Terminated' | 'Invited';
  role?: string; // Add role here
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm
  timeOut: string | null; // HH:mm
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
  status: 'Present' | 'Late' | 'Absent' | 'Half Day' | 'In Progress';
  totalHours?: number;
  overtimeComment?: string | null;
  overtimeRequest?: {
    id: string;
    comment: string | null;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
    approvedAt: string | null;
    approvedHours: number | null;
    reviewer: {
      first_name: string;
      last_name: string;
      email: string;
    } | null;
  } | null;
}

export type ViewState = 'DASHBOARD' | 'EMPLOYEES' | 'EMPLOYEE_DETAIL' | 'EXPORT' | 'EDIT_TIME' | 'OVERTIME_REQUESTS' | 'LEAVE_REQUESTS' | 'IMPORT_SCHEDULE' | 'EMPLOYEE_SCHEDULE' | 'STALE_SESSIONS';

export interface Position {
  id: number;
  name: string;
}

export interface Store {
  id: string;
  store_name: string;
  store_code: string;
  store_type: string;
  contact_no: string;
  city: string;
  location: string;
  group: string;
  managers: string[]; // Changed to string array
  created_at: string;
  mobile_number?: string;
  store_address?: string;
  status?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewer_id?: string;
  reviewer?: {
    first_name: string;
    last_name: string;
  } | null;
  reviewed_at?: string;
}
