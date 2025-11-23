import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock, Briefcase } from 'lucide-react';
import { Employee, AttendanceRecord } from '@/types';
import { format, parseISO, getDay } from 'date-fns';

interface EmployeeDetailProps {
  employee: Employee;
  onBack: () => void;
}

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);

  return (
    <div className="animate-fade-in space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft size={20} />
        <span>Back to Directory</span>
      </button>

      {/* Top Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-900/40 to-slate-900/0"></div>
        
        <div className="relative flex flex-col md:flex-row gap-8 items-start">
            <div className="shrink-0">
                <img 
                    src={employee.avatarUrl} 
                    alt={employee.fullName} 
                    className="w-32 h-32 rounded-2xl border-4 border-slate-800 shadow-2xl object-cover"
                />
            </div>
            
            <div className="flex-1 space-y-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{employee.fullName}</h1>
                    <p className="text-lg text-blue-400 font-medium">{employee.position}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                    <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-slate-500" />
                        <span>{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-slate-500" />
                        <span>{employee.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-slate-500" />
                        <span>{employee.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-slate-500" />
                        <span>{employee.department}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-medium text-center">
                    {employee.status}
                </span>
                <span className="text-slate-500 text-sm">Joined {employee.joinDate}</span>
            </div>
        </div>
      </div>

      {/* Attendance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Date Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="text-blue-400" size={20} />
                Select Date
            </h3>
            <p className="text-slate-400 text-sm mb-4">Choose a date to view entry and exit logs.</p>
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none" 
            />
        </div>

        {/* Log Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Clock className="text-blue-400" size={20} />
                Attendance Log: <span className="text-blue-300">{format(parseISO(selectedDate), 'MMMM dd, yyyy')}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AttendanceCard 
                    label="Time In" 
                    value={attendance?.timeIn || '--:--'} 
                    color="emerald"
                />
                <AttendanceCard 
                    label="Time Out" 
                    value={attendance?.timeOut || '--:--'} 
                    color="amber"
                />
                <AttendanceCard 
                    label="Total Hours" 
                    value={attendance?.totalHours ? `${attendance.totalHours} hrs` : '--'} 
                    color="blue"
                />
            </div>
            
            {(!attendance || attendance.timeIn === '-') && (
                <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-800 text-center text-slate-400">
                    No records found for this date (possibly weekend or absent).
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const AttendanceCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div className={`bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center`}>
        <span className={`text-${color}-400 text-sm font-medium mb-2 uppercase tracking-wider`}>{label}</span>
        <span className="text-3xl font-bold text-white">{value}</span>
    </div>
);

export default EmployeeDetail;
