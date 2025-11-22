import React, { useState } from 'react';
import { Save, X, Upload } from 'lucide-react';
import { Employee } from '../../types';

interface EmployeeFormProps {
  onSubmit: (employee: Employee) => void;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    position: '',
    department: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic Validation
    if (!formData.firstName || !formData.email) return;

    const newEmployee: Employee = {
      id: Date.now().toString(),
      fullName: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      position: formData.position,
      department: formData.department,
      joinDate: new Date().toISOString().split('T')[0],
      avatarUrl: `https://picsum.photos/200/200?random=${Date.now()}`,
      status: 'Active'
    };

    onSubmit(newEmployee);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div>
            <h2 className="text-2xl font-bold text-white">Add New Employee</h2>
            <p className="text-slate-400 mt-1">Fill in the information to create a new staff profile.</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Info */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Jane" required />
                <InputGroup label="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Doe" required />
                <InputGroup label="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" placeholder="jane@company.com" required />
                <InputGroup label="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
                <div className="md:col-span-2">
                    <InputGroup label="Home Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Main St, City, State" />
                </div>
            </div>
        </div>

        {/* Role Info */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-lg font-semibold text-blue-400">Role & Position</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Position/Title" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} placeholder="Software Engineer" required />
                <InputGroup label="Department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="Engineering" />
            </div>
        </div>

        <div className="pt-6 flex items-center justify-end gap-4">
            <button 
                type="button" 
                onClick={onCancel}
                className="px-6 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium"
            >
                Cancel
            </button>
            <button 
                type="submit"
                className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors font-medium flex items-center gap-2 shadow-lg shadow-blue-900/50"
            >
                <Save size={18} />
                Save Employee
            </button>
        </div>
      </form>
    </div>
  );
};

const InputGroup: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = "text", placeholder, required }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-slate-400">{label} {required && <span className="text-red-400">*</span>}</label>
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
