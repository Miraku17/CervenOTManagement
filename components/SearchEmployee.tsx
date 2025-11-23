import React, { useState } from 'react';
import { UserProfile } from '@/types';

interface SearchEmployeeProps {
  employees: UserProfile[];
  onEmployeeSelected: (employee: UserProfile) => void;
}

const SearchEmployee: React.FC<SearchEmployeeProps> = ({ employees, onEmployeeSelected }) => {
  const [filteredEmployees, setFilteredEmployees] = useState<UserProfile[]>(employees);

  // const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const searchTerm = e.target.value.toLowerCase();
  //   const filtered = employees.filter(
  //     (employee) =>
  //       employee.name.toLowerCase().includes(searchTerm) ||
  //       employee.email.toLowerCase().includes(searchTerm)
  //   );
  //   setFilteredEmployees(filtered);
  // };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4">Search Employee</h2>
      <input
        type="text"
        placeholder="Search by name or email"
        // onChange={handleSearch}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="space-y-2">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            className="p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600"
            onClick={() => onEmployeeSelected(employee)}
          >
            {/* <p className="font-bold">{employee.name}</p> */}
            <p className="text-sm text-slate-400">{employee.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchEmployee;
