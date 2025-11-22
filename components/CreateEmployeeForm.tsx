import React from 'react';
import { UserProfile } from '../../types';

interface CreateEmployeeFormProps {
  onEmployeeCreated: (employee: UserProfile) => void;
}

const CreateEmployeeForm: React.FC<CreateEmployeeFormProps> = ({ onEmployeeCreated }) => {
  const handleCreateEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEmployee: UserProfile = {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      position: formData.get('position') as string,
      avatarUrl: 'https://picsum.photos/200/200',
      contactNumber: formData.get('phone') as string,
      address: formData.get('address') as string,
      department: 'Unassigned'
    };
    onEmployeeCreated(newEmployee);
    e.currentTarget.reset();
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4">Create Employee</h2>
      <form onSubmit={handleCreateEmployee} className="space-y-4">
        <input type="text" name="name" placeholder="Name" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="text" name="address" placeholder="Address" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="text" name="phone" placeholder="Phone Number" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="email" name="email" placeholder="Email" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="text" name="position" placeholder="Position" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <button type="submit" className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors">
          Create Employee
        </button>
      </form>
    </div>
  );
};

export default CreateEmployeeForm;
