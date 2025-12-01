import React, { useState, useEffect } from 'react';
import { Users, Clock, UserCheck, TrendingUp, Loader2 } from 'lucide-react';
import { Employee } from '@/types';

interface DashboardHomeProps {
  employees: Employee[];
}

interface DashboardStats {
  totalEmployees: number;
  clockedInToday: number;
  activeNow: number;
  overtimeRequests: number;
  weeklyHours: number;
}

interface RecentActivity {
  id: string;
  employeeName: string;
  email: string;
  date: string;
  timeIn: string;
  timeOut: string | null;
  clockInAddress: string | null;
  clockOutAddress: string | null;
  duration: string | null;
  status: string;
  avatarSeed: string;
  overtimeRequest?: {
    comment: string | null;
    status: 'pending' | 'approved' | 'rejected';
    reviewer: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ employees }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/recent-activity?limit=10')
      ]);

      const statsData = await statsRes.json();
      const activityData = await activityRes.json();

      if (statsData.stats) setStats(statsData.stats);
      if (activityData.activity) setRecentActivity(activityData.activity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees.toString() || '0'}
          change={`${stats?.clockedInToday || 0} clocked in today`}
          icon={<Users className="text-blue-400" />}
          color="blue"
        />
        <StatCard
          title="Overtime Requests"
          value={stats?.overtimeRequests.toString() || '0'}
          change="This week"
          icon={<Clock className="text-amber-400" />}
          color="amber"
        />
        <StatCard
          title="Active Now"
          value={stats?.activeNow.toString() || '0'}
          change="Currently working"
          icon={<UserCheck className="text-violet-400" />}
          color="violet"
        />
        <StatCard
          title="Weekly Hours"
          value={stats?.weeklyHours.toString() || '0'}
          change="This week aggregated"
          icon={<TrendingUp className="text-emerald-400" />}
          color="emerald"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          <span className="text-xs text-slate-400">Last 7 days</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recentActivity.length > 0 ? (
            <>
              {recentActivity.map((activity) => (
                <div key={activity.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${activity.avatarSeed}`}
                      alt={activity.employeeName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">{activity.employeeName}</p>
                        {activity.overtimeRequest && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            activity.overtimeRequest.status === 'approved'
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                              : activity.overtimeRequest.status === 'rejected'
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                              : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                          }`}>
                            OT: {activity.overtimeRequest.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{activity.email}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                      activity.status === 'Active'
                        ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20'
                        : 'text-blue-400 bg-blue-400/10 border border-blue-400/20'
                    }`}>
                      {activity.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Date</p>
                      <p className="text-xs text-slate-300">{activity.date}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Duration</p>
                      <p className="text-xs text-emerald-400 font-medium">{activity.duration || '-'}</p>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                       <div>
                          <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Time In</p>
                          <p className="text-xs text-slate-300">{activity.timeIn}</p>
                          <p className="text-[10px] text-slate-400 mt-1 truncate" title={activity.clockInAddress || 'No address provided'}>
                            {activity.clockInAddress || 'No address provided'}
                          </p>
                       </div>
                       <div>
                          <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Time Out</p>
                          <p className="text-xs text-slate-300">{activity.timeOut || '-'}</p>
                          {activity.timeOut && (
                            <p className="text-[10px] text-slate-400 mt-1 truncate" title={activity.clockOutAddress || 'No address provided'}>
                              {activity.clockOutAddress || 'No address provided'}
                            </p>
                          )}
                       </div>
                    </div>
                  </div>
                  
                  {activity.overtimeRequest && (
                    <div className="mt-3 pt-3 border-t border-slate-800/50">
                      {activity.overtimeRequest.comment && (
                        <div className="flex items-start gap-2 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 mt-0.5 shrink-0">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          <p className="text-xs text-slate-400 italic line-clamp-2">"{activity.overtimeRequest.comment}"</p>
                        </div>
                      )}
                      {activity.overtimeRequest.reviewer && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          <span>Reviewed by {activity.overtimeRequest.reviewer.first_name} {activity.overtimeRequest.reviewer.last_name}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="col-span-2 text-center py-12 text-slate-500">
              No recent activity
            </div>
          )}
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
