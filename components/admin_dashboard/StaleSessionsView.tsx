import React, { useState, useEffect } from "react";
import { AlertTriangle, Clock, User, Calendar, RefreshCw, CheckCircle, Edit, X, Save } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/hooks/useUser";

interface StaleSession {
  id: string;
  userId: string;
  employeeName: string;
  employeeId: string;
  email: string;
  position: string;
  date: string;
  timeIn: string;
  durationHours: string;
}

const StaleSessionsView: React.FC = () => {
  const { user } = useUser();
  const [sessions, setSessions] = useState<StaleSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Edit Modal State
  const [editingSession, setEditingSession] = useState<StaleSession | null>(null);
  const [editTimeOut, setEditTimeOut] = useState<string>("");

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/stale-sessions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch sessions');
      }

      setSessions(data.sessions || []);
    } catch (error: any) {
      console.error("Error fetching stale sessions:", error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceClose = async (session: StaleSession) => {
    if (!confirm(`Are you sure you want to force close the session for ${session.employeeName}? This will set the clock-out time to NOW.`)) {
      return;
    }

    closeSession(session, new Date().toISOString());
  };

  const openEditModal = (session: StaleSession) => {
    setEditingSession(session);
    // Default the picker to the session date at 5:00 PM (17:00)
    // We need to construct a local ISO string for datetime-local input
    const sessionDate = new Date(session.timeIn);
    const defaultOut = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), 17, 0, 0);
    
    // Adjust for timezone offset to show correct local time in picker
    const offsetDate = new Date(defaultOut.getTime() - (defaultOut.getTimezoneOffset() * 60000));
    setEditTimeOut(offsetDate.toISOString().slice(0, 16));
  };

  const handleSaveEdit = async () => {
    if (!editingSession || !editTimeOut) return;
    
    // Create Date object from input
    const dateObj = new Date(editTimeOut);
    // Convert back to ISO string (UTC)
    const isoString = dateObj.toISOString();

    await closeSession(editingSession, isoString);
    setEditingSession(null);
  };

  const closeSession = async (session: StaleSession, timeOutIso: string) => {
    setIsProcessing(session.id);
    setMessage(null);

    try {
      const response = await fetch("/api/attendance/update-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: session.id,
          timeIn: session.timeIn,
          timeOut: timeOutIso,
          adminId: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update attendance");
      }

      setMessage({ type: 'success', text: `Successfully closed session for ${session.employeeName}` });
      setSessions(prev => prev.filter(s => s.id !== session.id));

    } catch (error: any) {
      console.error("Error closing session:", error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-slate-400">Loading stale sessions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Edit Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Close Session</h3>
              <button 
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Employee</span>
                  <span className="text-white font-medium">{editingSession.employeeName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Date</span>
                  <span className="text-white font-medium">{format(new Date(editingSession.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Clock In</span>
                  <span className="text-white font-medium">{format(new Date(editingSession.timeIn), 'hh:mm a')}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Set Clock Out Time
                </label>
                <input
                  type="datetime-local"
                  value={editTimeOut}
                  onChange={(e) => setEditTimeOut(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Set the time this employee actually left work.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingSession(null)}
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTimeOut || !!isProcessing}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Close Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            Stale Sessions
          </h1>
          <p className="text-slate-400 mt-1">
            Active sessions from previous days that were never clocked out.
          </p>
        </div>
        <button 
          onClick={fetchSessions}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">All Clear!</h3>
          <p className="text-slate-400">
            There are no stale sessions found. Everyone has clocked out properly.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">Employee</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Started At</th>
                  <th className="p-4 font-semibold">Duration (Open)</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{session.employeeName}</p>
                          <p className="text-xs text-slate-500">{session.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {format(new Date(session.date), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        {format(new Date(session.timeIn), 'hh:mm a')}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {session.durationHours} hours
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => openEditModal(session)}
                            disabled={!!isProcessing}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                        >
                            <Edit className="w-3 h-3" />
                            Edit & Close
                        </button>
                        <button
                          onClick={() => handleForceClose(session)}
                          disabled={!!isProcessing}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                          title="Close with current time"
                        >
                          {isProcessing === session.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            'Force Close'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaleSessionsView;
