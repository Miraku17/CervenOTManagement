import React, { useState, useEffect } from "react";
import { Search, Calendar, Clock, Save, User, AlertCircle } from "lucide-react";
import { Employee } from "@/types";
import { format } from "date-fns";

interface EditTimeViewProps {
  employees: Employee[];
}

interface AttendanceData {
  id: string;
  time_in: string;
  time_out: string | null;
  overtime_comment: string | null;
  is_overtime_requested: boolean;
}

const EditTimeView: React.FC<EditTimeViewProps> = ({ employees }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Edited values
  const [editedTimeIn, setEditedTimeIn] = useState("");
  const [editedTimeOut, setEditedTimeOut] = useState("");
  const [editedOvertimeComment, setEditedOvertimeComment] = useState("");

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
      const response = await fetch(
        `/api/attendance/user-details?userId=${selectedEmployee.id}&date=${selectedDate}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch attendance");
      }

      if (data.attendance) {
        // Get raw data with Philippines Time conversion from database
        const rawResponse = await fetch(
          `/api/attendance/get-raw?userId=${selectedEmployee.id}&date=${selectedDate}`
        );
        const rawData = await rawResponse.json();

        console.log("Raw Data:", rawData);

        if (rawData.attendance) {
          setAttendance({
            id: rawData.attendance.id,
            time_in: rawData.attendance.time_in,
            time_out: rawData.attendance.time_out,
            overtime_comment: rawData.attendance.overtime_comment,
            is_overtime_requested: rawData.attendance.is_overtime_requested,
          });

          // Use formatted times from API (Supabase already applies +0800 timezone)
          setEditedTimeIn(formatDatetimeLocal(rawData.attendance.time_in));
          setEditedTimeOut(formatDatetimeLocal(rawData.attendance.time_out));

          setEditedOvertimeComment(rawData.attendance.overtime_comment || "");
        }
      } else {
        setAttendance(null);
        setEditedTimeIn("");
        setEditedTimeOut("");
        setEditedOvertimeComment("");
      }
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      setMessage({ type: "error", text: error.message });
      setAttendance(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedEmployee || !attendance) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/attendance/update-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: attendance.id,
          timeIn: editedTimeIn,
          timeOut: editedTimeOut || null,
          overtimeComment: editedOvertimeComment || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update attendance");
      }

      setMessage({ type: "success", text: "Attendance updated successfully!" });
      fetchAttendance(); // Refresh data
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsSaving(false);
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
            ) : !attendance ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <AlertCircle className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">
                  No attendance record found for this date
                </p>
                <p className="text-sm mt-2">
                  Employee may not have clocked in on{" "}
                  {format(new Date(selectedDate), "MMM dd, yyyy")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Edit Attendance
                  </h2>
                  <p className="text-slate-400 mt-1">
                    {selectedEmployee.fullName} •{" "}
                    {format(new Date(selectedDate), "MMMM dd, yyyy")}
                  </p>
                </div>

                {/* Check if time out is not done */}
                {!attendance.time_out ? (
                  <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                    <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-amber-300 mb-2">
                      Time in and out not done
                    </p>
                    <p className="text-sm text-amber-400/80">
                      This employee has not clocked out yet. You can only edit
                      completed attendance records.
                    </p>
                  </div>
                ) : (
                  <>
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

                    <div className="space-y-4">
                      {/* Time In */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Time In
                        </label>
                        <input
                          type="datetime-local"
                          value={editedTimeIn}
                          onChange={(e) => setEditedTimeIn(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                        />
                      </div>

                      {/* Time Out */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Time Out
                        </label>
                        <input
                          type="datetime-local"
                          value={editedTimeOut}
                          onChange={(e) => setEditedTimeOut(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                        />
                      </div>

                      {/* Overtime Comment */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Overtime Comment
                        </label>
                        <textarea
                          value={editedOvertimeComment}
                          onChange={(e) =>
                            setEditedOvertimeComment(e.target.value)
                          }
                          placeholder="Add overtime comment..."
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
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
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </>
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
