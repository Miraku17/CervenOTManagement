export interface UserProfile {
  id?: string;
  // name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  positions?: { name: string };
  contact_number?: string;
  address?: string;
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
  fullName: string;
  email: string;
  contact_number: string;
  address: string;
  position: string;
  department: string;
  joinDate: string;
  avatarUrl: string;
  status: 'Active' | 'On Leave' | 'Terminated' | 'Invited';
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

export type ViewState = 'DASHBOARD' | 'EMPLOYEES' | 'EMPLOYEE_DETAIL' | 'EXPORT' | 'EDIT_TIME' | 'OVERTIME_REQUESTS';

export interface Position {
  id: number;
  name: string;
}
