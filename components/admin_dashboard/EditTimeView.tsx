import React, { useState, useEffect } from "react";
import { Search, Calendar, Clock, Save, User, AlertCircle, CheckCircle, Plus, X, Trash2 } from "lucide-react";
import { Employee } from "@/types";
import { format } from "date-fns";
import { useUser } from "@/hooks/useUser";

interface EditTimeViewProps {
  employees: Employee[];
}

interface SessionData {
  id: string;
  time_in: string;
  time_out: string | null;
  overtimeRequest?: {
    id: string;
    comment: string | null;
    status: 'pending' | 'approved' | 'rejected';
  } | null;
}

interface AttendanceData {
  sessions: SessionData[];
  totalHours: string | null;
  status: string;
  sessionCount: number;
}

const EditTimeView: React.FC<EditTimeViewProps> = ({ employees }) => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Edited values stored per session ID
  const [editedSessions, setEditedSessions] = useState<Map<string, {
    timeIn: string;
    timeOut: string;
    overtimeComment: string;
    overtimeStatus: 'pending' | 'approved' | 'rejected';
    isMarkedAsOvertime: boolean;
  }>>(new Map());

  // State for adding new session
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddingSaving, setIsAddingSaving] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState({
    timeIn: "",
    timeOut: "",
    overtimeComment: "",
    overtimeStatus: 'pending' as 'pending' | 'approved' | 'rejected',
    isMarkedAsOvertime: false
  });

  // Filter employees based on search
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDatetimeLocal = (dateString: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString); // handles UTC automatically

    // Convert → YYYY-MM-DDTHH:mm
    const offsetDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );

    return offsetDate.toISOString().slice(0, 16);
  };

  // Fetch attendance when employee or date changes
  useEffect(() => {
    if (selectedEmployee && selectedDate) {
      fetchAttendance();
    }
  }, [selectedEmployee, selectedDate]);

  const fetchAttendance = async () => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    setMessage(null);

    try {
      // Get raw data with Philippines Time conversion from database
      const rawResponse = await fetch(
        `/api/attendance/get-raw?userId=${selectedEmployee.id}&date=${selectedDate}`
      );
      const rawData = await rawResponse.json();

      console.log("Raw Data:", rawData);

      if (rawData.sessions && rawData.sessions.length > 0) {
        setAttendance({
          sessions: rawData.sessions,
          totalHours: rawData.totalHours,
          status: rawData.status,
          sessionCount: rawData.sessionCount
        });

        // Initialize edited sessions map
        const newEditedSessions = new Map();
        rawData.sessions.forEach((session: SessionData) => {
          newEditedSessions.set(session.id, {
            timeIn: formatDatetimeLocal(session.time_in),
            timeOut: formatDatetimeLocal(session.time_out),
            overtimeComment: session.overtimeRequest?.comment || "",
            overtimeStatus: session.overtimeRequest?.status || 'pending',
            isMarkedAsOvertime: !!session.overtimeRequest
          });
        });
        setEditedSessions(newEditedSessions);
      } else {
        setAttendance(null);
        setEditedSessions(new Map());
      }
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      setMessage({ type: "error", text: error.message });
      setAttendance(null);
      setEditedSessions(new Map());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (sessionId: string, session: SessionData) => {
    if (!selectedEmployee || !attendance) return;

    const editedData = editedSessions.get(sessionId);
    if (!editedData) return;

    setSavingSessionId(sessionId);
    setMessage(null);

    try {
      const response = await fetch("/api/attendance/update-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: sessionId,
          timeIn: editedData.timeIn,
          timeOut: editedData.timeOut || null,
          isMarkedAsOvertime: editedData.isMarkedAsOvertime,
          overtimeComment: editedData.isMarkedAsOvertime ? (editedData.overtimeComment || null) : null,
          overtimeStatus: editedData.isMarkedAsOvertime ? editedData.overtimeStatus : null,
          overtimeRequestId: session.overtimeRequest?.id || null,
          adminId: user?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update attendance");
      }

      setMessage({ type: "success", text: "Session updated successfully!" });
      fetchAttendance(); // Refresh data
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setSavingSessionId(null);
    }
  };

  const updateSessionField = (sessionId: string, field: string, value: any) => {
    setEditedSessions(prev => {
      const newMap = new Map(prev);
      const session = newMap.get(sessionId) || {
        timeIn: "",
        timeOut: "",
        overtimeComment: "",
        overtimeStatus: 'pending' as const,
        isMarkedAsOvertime: false
      };
      newMap.set(sessionId, { ...session, [field]: value });
      return newMap;
    });
  };

  const handleToggleOvertime = (sessionId: string, currentValue: boolean) => {
    // If trying to mark as overtime, check if another session is already marked
    if (!currentValue) {
      const hasOtherOvertimeSession = Array.from(editedSessions.entries()).some(
        ([id, data]) => id !== sessionId && data.isMarkedAsOvertime
      );

      if (hasOtherOvertimeSession) {
        setMessage({
          type: "error",
          text: "Only one session per day can be marked as overtime. Please unmark the other session first."
        });
        return;
      }
    }

    // Toggle the overtime marking
    setEditedSessions(prev => {
      const newMap = new Map(prev);
      const session = newMap.get(sessionId);
      if (session) {
        newMap.set(sessionId, {
          ...session,
          isMarkedAsOvertime: !currentValue,
          // Reset overtime fields if unmarking
          ...(!currentValue ? {} : { overtimeComment: "", overtimeStatus: 'pending' as const })
        });
      }
      return newMap;
    });

    // Clear any error messages when successfully toggling
    if (!currentValue) {
      setMessage(null);
    }
  };

  const resetNewSessionForm = () => {
    // Set default time to 8 AM for time in and 5 PM for time out on selected date
    const defaultTimeIn = `${selectedDate}T08:00`;
    const defaultTimeOut = `${selectedDate}T17:00`;

    setNewSession({
      timeIn: defaultTimeIn,
      timeOut: defaultTimeOut,
      overtimeComment: "",
      overtimeStatus: 'pending',
      isMarkedAsOvertime: false
    });
  };

  const handleOpenAddForm = () => {
    resetNewSessionForm();
    setShowAddForm(true);
    setMessage(null);
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
    resetNewSessionForm();
  };

  const handleAddSession = async () => {
    if (!selectedEmployee || !newSession.timeIn || !newSession.timeOut) {
      setMessage({ type: "error", text: "Please fill in both Time In and Time Out" });
      return;
    }

    setIsAddingSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/attendance/add-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedEmployee.id,
          timeIn: newSession.timeIn,
          timeOut: newSession.timeOut,
          isMarkedAsOvertime: newSession.isMarkedAsOvertime,
          overtimeComment: newSession.isMarkedAsOvertime ? (newSession.overtimeComment || null) : null,
          overtimeStatus: newSession.isMarkedAsOvertime ? newSession.overtimeStatus : null,
          adminId: user?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add attendance record");
      }

      setMessage({ type: "success", text: "Session added successfully!" });
      setShowAddForm(false);
      resetNewSessionForm();
      fetchAttendance(); // Refresh data
    } catch (error: any) {
      console.error("Error adding attendance:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsAddingSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!selectedEmployee) return;

    setDeletingSessionId(sessionId);
    setMessage(null);

    try {
      const response = await fetch("/api/attendance/delete-session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete session");
      }

      setMessage({ type: "success", text: "Session deleted successfully!" });
      setConfirmDeleteId(null);
      fetchAttendance(); // Refresh data
    } catch (error: any) {
      console.error("Error deleting session:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Edit Time Records</h1>
          <p className="text-slate-400 mt-1">
            Search for an employee and modify their attendance records
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Search & Employee List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Date Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <label className="flex items-center gap-2 text-slate-300 text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-900 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Employee List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl max-h-[500px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Employees ({filteredEmployees.length})
            </h3>
            <div className="space-y-2">
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedEmployee?.id === emp.id
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{emp.fullName}</p>
                      <p className="text-xs opacity-75 truncate">{emp.email}</p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-center text-slate-500 py-8">
                  No employees found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {!selectedEmployee ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <User className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">
                  Select an employee to edit their attendance
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-slate-400">Loading attendance data...</p>
              </div>
            ) : !attendance && !showAddForm ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <AlertCircle className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">
                  No attendance record found for this date
                </p>
                <p className="text-sm mt-2">
                  Employee may not have clocked in on{" "}
                  {format(new Date(selectedDate), "MMM dd, yyyy")}
                </p>
                <button
                  onClick={handleOpenAddForm}
                  className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Time Entry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        {showAddForm && !attendance ? 'Add Time Entry' : 'Edit Attendance'}
                      </h2>
                      <p className="text-slate-400 mt-1">
                        {selectedEmployee.fullName} •{" "}
                        {format(new Date(selectedDate), "MMMM dd, yyyy")}
                      </p>
                    </div>
                    {!showAddForm && (
                      <button
                        onClick={handleOpenAddForm}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Session
                      </button>
                    )}
                  </div>
                  {attendance && (
                    <div className="flex gap-4 mt-3 text-sm">
                      <span className="text-slate-300">
                        <span className="text-slate-500">Total Hours:</span> {attendance.totalHours || '--'} hrs
                      </span>
                      <span className="text-slate-300">
                        <span className="text-slate-500">Sessions:</span> {attendance.sessionCount}
                      </span>
                      <span className={`font-medium ${
                        attendance.status === 'In Progress' ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {attendance.status}
                      </span>
                    </div>
                  )}
                </div>

                {message && (
                  <div
                    className={`p-4 rounded-xl border ${
                      message.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {/* Add New Session Form */}
                {showAddForm && (
                  <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-500/20">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-400" />
                        New Session
                      </h3>
                      <button
                        onClick={handleCloseAddForm}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Time In */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Time In
                        </label>
                        <input
                          type="datetime-local"
                          value={newSession.timeIn}
                          onChange={(e) => setNewSession(prev => ({ ...prev, timeIn: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none [color-scheme:dark]"
                        />
                      </div>

                      {/* Time Out */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Time Out
                        </label>
                        <input
                          type="datetime-local"
                          value={newSession.timeOut}
                          onChange={(e) => setNewSession(prev => ({ ...prev, timeOut: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none [color-scheme:dark]"
                        />
                      </div>

                      {/* Mark as Overtime Toggle */}
                      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-amber-400" />
                              <h4 className="text-sm font-semibold text-white">Mark as Overtime</h4>
                            </div>
                            <p className="text-xs text-slate-400">
                              Mark this session as overtime
                            </p>
                          </div>
                          <button
                            onClick={() => setNewSession(prev => ({ ...prev, isMarkedAsOvertime: !prev.isMarkedAsOvertime }))}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                              newSession.isMarkedAsOvertime ? 'bg-amber-500' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                newSession.isMarkedAsOvertime ? 'translate-x-7' : 'translate-x-1'
                              }`}
                            >
                              {newSession.isMarkedAsOvertime && (
                                <CheckCircle className="w-4 h-4 text-amber-500 m-1" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Overtime Status */}
                      {newSession.isMarkedAsOvertime && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Overtime Status
                          </label>
                          <select
                            value={newSession.overtimeStatus}
                            onChange={(e) => setNewSession(prev => ({ ...prev, overtimeStatus: e.target.value as 'pending' | 'approved' | 'rejected' }))}
                            className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5rem] bg-[right_0.5rem_center] bg-no-repeat pr-12"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      )}

                      {/* Overtime Comment */}
                      {newSession.isMarkedAsOvertime && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Overtime Comment
                          </label>
                          <textarea
                            value={newSession.overtimeComment}
                            onChange={(e) => setNewSession(prev => ({ ...prev, overtimeComment: e.target.value }))}
                            placeholder="Add overtime comment..."
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                          />
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleCloseAddForm}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium px-6 py-3 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSession}
                          disabled={isAddingSaving}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {isAddingSaving ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Add Session
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sessions List */}
                {attendance && attendance.sessions.length > 0 && (
                <div className="space-y-4">
                  {attendance.sessions.map((session, index) => {
                    const editedData = editedSessions.get(session.id);
                    if (!editedData) return null;

                    const isSaving = savingSessionId === session.id;
                    const hasTimeOut = !!session.time_out;

                    return (
                      <div key={session.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                          <h3 className="text-lg font-semibold text-white">Session {index + 1}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                              hasTimeOut
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {hasTimeOut ? 'Completed' : 'Active'}
                            </span>
                            {confirmDeleteId === session.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteSession(session.id)}
                                  disabled={deletingSessionId === session.id}
                                  className="text-xs px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1"
                                >
                                  {deletingSessionId === session.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      Deleting...
                                    </>
                                  ) : (
                                    'Confirm'
                                  )}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(session.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Delete session"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {!hasTimeOut && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4 flex items-center justify-between gap-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-amber-300">Session in progress</p>
                                <p className="text-xs text-amber-400/80 mt-1">
                                  This session is currently active. Force clock out to enable editing.
                                </p>
                              </div>
                            </div>
                            <button
                                onClick={() => {
                                    const now = new Date();
                                    // Format current time to local ISO string for input
                                    const localIso = formatDatetimeLocal(now.toISOString());
                                    updateSessionField(session.id, 'timeOut', localIso);
                                    
                                    // Small delay to ensure state updates before saving
                                    setTimeout(() => {
                                        // We need to pass the updated session object with the new timeOut
                                        const updatedSession = { ...session, time_out: now.toISOString() };
                                        handleSave(session.id, updatedSession);
                                    }, 100);
                                }}
                                className="whitespace-nowrap px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Clock className="w-3 h-3" />
                                Force Clock Out
                            </button>
                          </div>
                        )}

                        <div className="space-y-4">
                          {/* Mark as Overtime Toggle */}
                          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="w-4 h-4 text-amber-400" />
                                  <h4 className="text-sm font-semibold text-white">Mark as Overtime</h4>
                                </div>
                                <p className="text-xs text-slate-400">
                                  Only one session per day can be marked as overtime
                                </p>
                              </div>
                              <button
                                onClick={() => handleToggleOvertime(session.id, editedData.isMarkedAsOvertime)}
                                disabled={!hasTimeOut}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${
                                  editedData.isMarkedAsOvertime ? 'bg-amber-500' : 'bg-slate-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                    editedData.isMarkedAsOvertime ? 'translate-x-7' : 'translate-x-1'
                                  }`}
                                >
                                  {editedData.isMarkedAsOvertime && (
                                    <CheckCircle className="w-4 h-4 text-amber-500 m-1" />
                                  )}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Time In */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Time In
                            </label>
                            <input
                              type="datetime-local"
                              value={editedData.timeIn}
                              onChange={(e) => updateSessionField(session.id, 'timeIn', e.target.value)}
                              disabled={!hasTimeOut}
                              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Time Out */}
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Time Out
                            </label>
                            <input
                              type="datetime-local"
                              value={editedData.timeOut}
                              onChange={(e) => updateSessionField(session.id, 'timeOut', e.target.value)}
                              disabled={!hasTimeOut}
                              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Overtime Status */}
                          {editedData.isMarkedAsOvertime && (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Overtime Status
                              </label>
                              <select
                                value={editedData.overtimeStatus}
                                onChange={(e) => updateSessionField(session.id, 'overtimeStatus', e.target.value)}
                                disabled={!hasTimeOut}
                                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5rem] bg-[right_0.5rem_center] bg-no-repeat pr-12"
                              >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                          )}

                          {/* Overtime Comment */}
                          {editedData.isMarkedAsOvertime && (
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Overtime Comment
                              </label>
                              <textarea
                                value={editedData.overtimeComment}
                                onChange={(e) => updateSessionField(session.id, 'overtimeComment', e.target.value)}
                                disabled={!hasTimeOut}
                                placeholder="Add overtime comment..."
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              {!session.overtimeRequest && editedData.overtimeComment && (
                                <p className="text-xs text-slate-500 mt-1">
                                  This will create a new overtime request
                                </p>
                              )}
                            </div>
                          )}

                          {/* Save Button */}
                          <button
                            onClick={() => handleSave(session.id, session)}
                            disabled={!hasTimeOut || isSaving}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            {isSaving ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-5 h-5" />
                                Save Session {index + 1}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTimeView;
