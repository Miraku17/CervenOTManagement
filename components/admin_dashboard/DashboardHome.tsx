import React from 'react';
import { Users, Clock, UserCheck, TrendingUp } from 'lucide-react';
import { Employee } from '@/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface DashboardHomeProps {
  employees: Employee[];
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ employees }) => {
  // Mock Chart Data
  const attendanceData = [
    { name: 'Mon', present: 40, late: 2 },
    { name: 'Tue', present: 38, late: 4 },
    { name: 'Wed', present: 42, late: 0 },
    { name: 'Thu', present: 35, late: 5 },
    { name: 'Fri', present: 41, late: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Employees" 
          value={employees.length.toString()} 
          change="+2 this month" 
          icon={<Users className="text-blue-400" />} 
          color="blue"
        />
        <StatCard 
          title="On Time Today" 
          value="94%" 
          change="+5% from yesterday" 
          icon={<Clock className="text-emerald-400" />} 
          color="emerald"
        />
        <StatCard 
          title="Active Now" 
          value={employees.filter(e => e.status === 'Active').length.toString()} 
          change="Currently working" 
          icon={<UserCheck className="text-violet-400" />} 
          color="violet"
        />
        <StatCard 
          title="Total Hours" 
          value="1,240" 
          change="Weekly aggregated" 
          icon={<TrendingUp className="text-amber-400" />} 
          color="amber"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-6">Weekly Attendance Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                />
                <Bar dataKey="present" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {employees.slice(0, 3).map((emp, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
                <img src={emp.avatarUrl} alt={emp.fullName} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{emp.fullName}</p>
                  <p className="text-xs text-slate-400">Clocked in at 08:58 AM</p>
                </div>
                <span className="text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2 py-1 rounded-full">On Time</span>
              </div>
            ))}
             <div className="mt-4 pt-4 border-t border-slate-800 text-center">
                <button className="text-sm text-blue-400 hover:text-blue-300">View All Logs</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  change: string; 
  icon: React.ReactNode; 
  color: string;
}> = ({ title, value, change, icon, color }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl hover:border-slate-700 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-${color}-500/10`}>
        {icon}
      </div>
    </div>
    <p className="text-xs text-slate-500">{change}</p>
  </div>
);

export default DashboardHome;
