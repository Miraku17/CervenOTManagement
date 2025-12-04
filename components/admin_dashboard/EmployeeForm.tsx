import React, { useState } from "react";
import { Save, X, ChevronDown, Plus } from "lucide-react";
import { Employee, Position } from "@/types";

interface EmployeeFormProps {
  onCancel: () => void;
  onSubmit: (employee: Employee) => void;
  positions: Position[];
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSubmit, onCancel, positions }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    employee_id: "",
    email: "",
    contact_number: "",
    address: "",
    position: "",
    department: "",
    role: "employee",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isCreatingNewPosition, setIsCreatingNewPosition] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      employee_id: "",
      email: "",
      contact_number: "",
      address: "",
      position: "",
      department: "",
      role: "employee",
    });
    setSuccess(false);
    setError(null);
    setIsCreatingNewPosition(false);
    setNewPositionName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    let selectedPosition = positions.find(p => p.name === formData.position);

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError("First Name, Last Name, and Email are required.");
      setLoading(false);
      return;
    }

    if (!isCreatingNewPosition && !selectedPosition) {
      setError("Please select a position or create a new one.");
      setLoading(false);
      return;
    }

    if (isCreatingNewPosition && !newPositionName.trim()) {
      setError("Please enter a position name.");
      setLoading(false);
      return;
    }

    try {
      // If creating a new position, create it first
      if (isCreatingNewPosition) {
        const positionResponse = await fetch('/api/positions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newPositionName.trim() }),
        });

        const positionResult = await positionResponse.json();

        if (!positionResponse.ok) {
          if (positionResponse.status === 409) {
            // Position already exists, use it
            selectedPosition = positionResult.position;
          } else {
            throw new Error(positionResult.error || 'Failed to create position');
          }
        } else {
          selectedPosition = positionResult.position;
        }
      }

      if (!selectedPosition) {
        throw new Error('Position could not be determined');
      }

      const response = await fetch('/api/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          employee_id: formData.employee_id,
          positionId: selectedPosition.id,
          role: formData.role,
          password: Math.random().toString(36).slice(-12), // Generate a random temporary password
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create employee');
      }

      onSubmit(result.employee);
      setSuccess(true);
      setTimeout(() => {
        resetForm();
      }, 3000);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Add New Employee</h2>
          <p className="text-slate-400 mt-1">
            An invitation email will be sent for the employee to set up their password.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="text-slate-400" />
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-center mb-4 p-3 bg-red-500/10 rounded-lg">
          {error}
        </p>
      )}
      {success && (
        <p className="text-emerald-500 text-center mb-4 p-3 bg-emerald-500/10 rounded-lg">
          Employee created successfully! Please tell the employee to reset their password.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-400">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup
              label="First Name"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              placeholder="Jane"
              required
            />
            <InputGroup
              label="Last Name"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              placeholder="Doe"
              required
            />
            <InputGroup
              label="Employee ID"
              value={formData.employee_id}
              onChange={(e) =>
                setFormData({ ...formData, employee_id: e.target.value })
              }
              placeholder="EMP-001"
              required
            />
            <InputGroup
              label="Email Address"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              type="email"
              placeholder="jane@company.com"
              required
            />
            <InputGroup
              label="Phone Number"
              value={formData.contact_number}
              onChange={(e) =>
                setFormData({ ...formData, contact_number: e.target.value })
              }
              placeholder="+63 (XXX) YYY-YYYY"
            />
            <div className="md:col-span-2">
              <InputGroup
                label="Home Address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-400">
              Role & Position
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreatingNewPosition(!isCreatingNewPosition);
                setFormData({ ...formData, position: "" });
                setNewPositionName("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors text-sm"
            >
              <Plus size={16} />
              {isCreatingNewPosition ? "Select Existing" : "Create New Position"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">
                Role <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none pr-10"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">
                Position/Title <span className="text-red-400">*</span>
              </label>
              {isCreatingNewPosition ? (
                <input
                  type="text"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="Enter new position name"
                  required
                  className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                />
              ) : (
                <div className="relative">
                  <select
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none pr-10"
                  >
                    <option value="" disabled>
                      Select a position
                    </option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors font-medium flex items-center gap-2 shadow-lg shadow-blue-900/50 disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <Save size={18} />
            )}
            {loading ? "Sending Invitation..." : "Save & Send Invite"}
          </button>
        </div>
      </form>
    </div>
  );
};

const InputGroup: React.FC<{
  label: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = "text", placeholder, required }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-slate-400">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
    />
  </div>
);

export default EmployeeForm;
