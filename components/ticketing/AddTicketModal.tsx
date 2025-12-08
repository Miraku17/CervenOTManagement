import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Clock, Calendar, User, ChevronDown } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/services/supabase';

interface Store {
  id: string;
  store_name: string;
  store_code: string;
}

interface Manager {
  id: string;
  manager_name: string;
}

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  email: string;
}

interface AddTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddTicketModal: React.FC<AddTicketModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const PHILIPPINE_TZ = 'Asia/Manila';
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    store_id: '',
    station: '',
    mod_id: '',
    rcc_reference_number: '',
    request_type: '',
    device: '',
    request_detail: '',
    problem_category: '',
    sev: '',
    serviced_by: '',
  });

  // Get current date and time in Philippine timezone
  const currentDate = formatInTimeZone(new Date(), PHILIPPINE_TZ, 'MMMM dd, yyyy');
  const currentTime = formatInTimeZone(new Date(), PHILIPPINE_TZ, 'hh:mm a');

  // Fetch stores and employees
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stores
        const storesResponse = await fetch('/api/stores/get');
        const storesData = await storesResponse.json();
        if (storesResponse.ok) {
          setStores(storesData.stores || []);
        }

        // Fetch employees
        const employeesResponse = await fetch('/api/employees/get');
        const employeesData = await employeesResponse.json();
        if (employeesResponse.ok) {
          setEmployees(employeesData.employees || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Fetch current user from profiles table
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isOpen) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch user profile from profiles table
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching profile:', error);
            setCurrentUser('Unknown User');
            setCurrentUserId('');
          } else if (profile) {
            const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            setCurrentUser(fullName || 'Unknown User');
            setCurrentUserId(user.id);
          } else {
            setCurrentUser('Unknown User');
            setCurrentUserId('');
          }
        } else {
          setCurrentUser('Unknown User');
          setCurrentUserId('');
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
        setCurrentUser('Unknown User');
        setCurrentUserId('');
      }
    };

    fetchCurrentUser();
  }, [isOpen]);

  // Fetch managers when store is selected
  useEffect(() => {
    const fetchManagers = async () => {
      if (!selectedStore) {
        setManagers([]);
        return;
      }

      try {
        const response = await fetch(`/api/stores/managers?store_id=${selectedStore.id}`);
        const data = await response.json();
        if (response.ok) {
          setManagers(data.managers || []);
        }
      } catch (err) {
        console.error('Error fetching managers:', err);
        setManagers([]);
      }
    };

    fetchManagers();
  }, [selectedStore]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setStoreName(store.store_name);
    setStoreCode(store.store_code);
    setStoreSearchTerm(store.store_name);
    setShowStoreDropdown(false);
    setFormData({ ...formData, store_id: store.id, mod_id: '' });
  };

  const handleClearStoreSelection = () => {
    setSelectedStore(null);
    setStoreName('');
    setStoreCode('');
    setStoreSearchTerm('');
    setShowStoreDropdown(false);
    setFormData({ ...formData, store_id: '', mod_id: '' });
    setManagers([]);
  };

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearchTerm(employee.name);
    setShowEmployeeDropdown(false);
    setFormData({ ...formData, serviced_by: employee.id });
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
    setShowEmployeeDropdown(false);
    setFormData({ ...formData, serviced_by: '' });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showStoreDropdown || showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStoreDropdown, showEmployeeDropdown]);

  // Station options (you can customize this based on your needs)
  const stationOptions = ['Station 1', 'Station 2', 'Station 3', 'Station 4', 'Station 5'];

  // Severity options
  const severityOptions = [
    { value: 'Low', label: 'Low', color: 'text-blue-400' },
    { value: 'Medium', label: 'Medium', color: 'text-yellow-400' },
    { value: 'High', label: 'High', color: 'text-orange-400' },
    { value: 'Critical', label: 'Critical', color: 'text-red-400' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          date_reported: new Date().toISOString(),
          status: 'Open',
          reported_by: currentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      // Reset form
      setFormData({
        store_id: '',
        station: '',
        mod_id: '',
        rcc_reference_number: '',
        request_type: '',
        device: '',
        request_detail: '',
        problem_category: '',
        sev: '',
        serviced_by: '',
      });
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setShowStoreDropdown(false);
      setSelectedEmployee(null);
      setEmployeeSearchTerm('');
      setShowEmployeeDropdown(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Create New Ticket</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form id="ticket-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Read-only fields - Display at the top */}
            <div className="bg-slate-950/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Ticket Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <Calendar size={14} />
                    Date Reported
                  </label>
                  <div className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg">
                    {currentDate}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <Clock size={14} />
                    Time Reported
                  </label>
                  <div className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg">
                    {currentTime}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <User size={14} />
                    Reported By
                  </label>
                  <div className="bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg">
                    {currentUser || 'Loading...'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">
                      Open
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable fields */}
            {/* Store Selector with Dropdown */}
            <div ref={storeDropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Select Store <span className="text-red-500">*</span>
                {selectedStore && <span className="text-xs text-slate-500 ml-2">(Selected: {selectedStore.store_name})</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={storeSearchTerm}
                  onChange={(e) => {
                    setStoreSearchTerm(e.target.value);
                    setShowStoreDropdown(true);
                  }}
                  onFocus={() => setShowStoreDropdown(true)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Search for a store..."
                  required={!selectedStore}
                />
                {selectedStore && (
                  <button
                    type="button"
                    onClick={handleClearStoreSelection}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>

              {/* Dropdown Menu */}
              {showStoreDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredStores.length > 0 ? (
                    filteredStores.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => handleStoreSelect(store)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{store.store_name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Code: {store.store_code}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      No stores found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Display Selected Store Info (Read-only) */}
            {selectedStore && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Store Code</label>
                  <input
                    type="text"
                    value={storeCode}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Station <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedStore}
                  >
                    <option value="">Select Station</option>
                    {stationOptions.map((station) => (
                      <option key={station} value={station}>
                        {station}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Manager on Duty (MOD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.mod_id}
                    onChange={(e) => setFormData({ ...formData, mod_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedStore}
                  >
                    <option value="">Select Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.manager_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  RCC Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.rcc_reference_number}
                  onChange={(e) => setFormData({ ...formData, rcc_reference_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. RCC-2024-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.request_type}
                  onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Hardware Issue, Software Issue, Network Issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Device <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.device}
                  onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. POS Terminal, Printer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Problem Category <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.problem_category}
                  onChange={(e) => setFormData({ ...formData, problem_category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. POS System, Printer, Network/Internet"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Severity <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={formData.sev}
                    onChange={(e) => setFormData({ ...formData, sev: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Select Severity</option>
                    {severityOptions.map((severity) => (
                      <option key={severity.value} value={severity.value}>
                        {severity.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Request Detail <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.request_detail}
                onChange={(e) => setFormData({ ...formData, request_detail: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32"
                placeholder="Please describe the issue or request in detail..."
              />
            </div>

            {/* Serviced By - Employee Selector */}
            <div ref={employeeDropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Serviced By
                {selectedEmployee && <span className="text-xs text-slate-500 ml-2">(Selected: {selectedEmployee.name})</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => {
                    setEmployeeSearchTerm(e.target.value);
                    setShowEmployeeDropdown(true);
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Search for an employee..."
                />
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={handleClearEmployeeSelection}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>

              {/* Employee Dropdown Menu */}
              {showEmployeeDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => handleEmployeeSelect(employee)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{employee.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {employee.employee_id && `ID: ${employee.employee_id} • `}
                              {employee.email}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      No employees found
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="ticket-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={18} />
            )}
            <span>{loading ? 'Creating...' : 'Create Ticket'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTicketModal;
