import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Clock, Calendar, User, ChevronDown, Upload, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/services/supabase';
import { compressImages } from '@/lib/imageCompression';

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
  fullName: string;
  employee_id: string;
  email: string;
}

interface Station {
  id: string;
  name: string;
}

interface KBArticle {
  id: string;
  title: string;
  kb_code: string;
}

interface RequestType {
  id: string;
  name: string;
}

interface ProblemCategory {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  serial_number: string | null;
  status?: string;
  stores: {
    id: string;
    store_name: string;
    store_code: string;
  } | null;
  stations: {
    id: string;
    name: string;
  } | null;
  categories: {
    id: string;
    name: string;
  } | null;
  brands: {
    id: string;
    name: string;
  } | null;
  models: {
    id: string;
    name: string;
  } | null;
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
  const [managerOnDuty, setManagerOnDuty] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // KB Articles state
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [selectedKbArticle, setSelectedKbArticle] = useState<KBArticle | null>(null);

  // Request Types state
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestTypeSearchTerm, setRequestTypeSearchTerm] = useState('');
  const [showRequestTypeDropdown, setShowRequestTypeDropdown] = useState(false);
  const [isLoadingRequestTypes, setIsLoadingRequestTypes] = useState(false);

  // Problem Categories state
  const [problemCategories, setProblemCategories] = useState<ProblemCategory[]>([]);
  const [problemCategorySearchTerm, setProblemCategorySearchTerm] = useState('');
  const [showProblemCategoryDropdown, setShowProblemCategoryDropdown] = useState(false);
  const [isLoadingProblemCategories, setIsLoadingProblemCategories] = useState(false);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);
  const requestTypeDropdownRef = useRef<HTMLDivElement>(null);
  const problemCategoryDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    store_id: '',
    station_id: '',
    mod_id: '',
    rcc_reference_number: '',
    request_type: '',
    request_type_id: '',
    device: '',
    request_detail: '',
    problem_category: '',
    problem_category_id: '',
    sev: '',
    serviced_by: '',
    kb_id: '',
    date_reported: formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
    time_reported: formatInTimeZone(new Date(), 'Asia/Manila', 'HH:mm'),
  });

  // Fetch stores, employees and stations
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

        // Fetch stations
        const stationsResponse = await fetch('/api/stations/get');
        const stationsData = await stationsResponse.json();
        if (stationsResponse.ok) {
          setStations(stationsData.stations || []);
        }

        // Fetch KB articles
        const kbResponse = await fetch('/api/knowledge-base/get?limit=1000');
        const kbData = await kbResponse.json();
        if (kbResponse.ok) {
          setKbArticles(kbData.articles || []);
        }

        // Fetch request types
        setIsLoadingRequestTypes(true);
        try {
          const requestTypesResponse = await fetch('/api/request-types/get');
          const requestTypesData = await requestTypesResponse.json();
          if (requestTypesResponse.ok) {
            setRequestTypes(requestTypesData.requestTypes || []);
          }
        } catch (err) {
          console.error('Error fetching request types:', err);
        } finally {
          setIsLoadingRequestTypes(false);
        }

        // Fetch problem categories
        setIsLoadingProblemCategories(true);
        try {
          const problemCategoriesResponse = await fetch('/api/problem-categories/get');
          const problemCategoriesData = await problemCategoriesResponse.json();
          if (problemCategoriesResponse.ok) {
            setProblemCategories(problemCategoriesData.problemCategories || []);
          }
        } catch (err) {
          console.error('Error fetching problem categories:', err);
        } finally {
          setIsLoadingProblemCategories(false);
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
        setManagerOnDuty('');
        return;
      }

      try {
        const response = await fetch(`/api/stores/managers?store_id=${selectedStore.id}`);
        const data = await response.json();
        if (response.ok) {
          const fetchedManagers = data.managers || [];
          setManagers(fetchedManagers);

          // Automatically set the first manager as MOD
          if (fetchedManagers.length > 0) {
            const firstManager = fetchedManagers[0];
            setManagerOnDuty(firstManager.manager_name);
            setFormData(prev => ({ ...prev, mod_id: firstManager.id }));
          } else {
            setManagerOnDuty('No manager assigned');
            setFormData(prev => ({ ...prev, mod_id: '' }));
          }
        }
      } catch (err) {
        console.error('Error fetching managers:', err);
        setManagers([]);
        setManagerOnDuty('');
      }
    };

    fetchManagers();
  }, [selectedStore]);

  // Fetch inventory based on selected store only
  useEffect(() => {
    const fetchInventory = async () => {
      if (!selectedStore) {
        setInventoryItems([]);
        setIsLoadingDevices(false);
        return;
      }

      setIsLoadingDevices(true);
      try {
        const response = await fetch(`/api/inventory/get?store_id=${selectedStore.id}`);
        const data = await response.json();
        if (response.ok) {
          setInventoryItems(data.items || []);
        }
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setInventoryItems([]);
      } finally {
        setIsLoadingDevices(false);
      }
    };

    fetchInventory();
  }, [selectedStore]);

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setStoreName(store.store_name);
    setStoreCode(store.store_code);
    setStoreSearchTerm(store.store_name);
    setShowStoreDropdown(false);
    setFormData({
      ...formData,
      store_id: store.id,
      mod_id: '',
      station_id: '', // Reset station (will be auto-filled from device)
      device: '', // Reset device
    });
    setSelectedInventoryItem(null);
  };

  const handleClearStoreSelection = () => {
    setSelectedStore(null);
    setStoreName('');
    setStoreCode('');
    setStoreSearchTerm('');
    setShowStoreDropdown(false);
    setFormData({
      ...formData,
      store_id: '',
      mod_id: '',
      station_id: '',
      device: '',
      problem_category: ''
    });
    setManagers([]);
    setManagerOnDuty('');
    setInventoryItems([]);
    setSelectedInventoryItem(null);
    setDeviceSearchTerm('');
    setShowDeviceDropdown(false);
  };

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const filteredDevices = inventoryItems.filter(item => {
    const categoryName = item.categories?.name || '';
    const brandName = item.brands?.name || '';
    const modelName = item.models?.name || '';
    const serial = item.serial_number || '';
    const stationName = item.stations?.name || '';

    const searchableName = [categoryName, brandName, modelName, serial, stationName].join(' ').toLowerCase();
    return searchableName.includes(deviceSearchTerm.toLowerCase());
  });

  const filteredRequestTypes = requestTypes.filter(type =>
    type.name.toLowerCase().includes(requestTypeSearchTerm.toLowerCase())
  );

  const filteredProblemCategories = problemCategories.filter(category =>
    category.name.toLowerCase().includes(problemCategorySearchTerm.toLowerCase())
  );

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearchTerm(employee.fullName);
    setShowEmployeeDropdown(false);
    setFormData({ ...formData, serviced_by: employee.id });
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
    setShowEmployeeDropdown(false);
    setFormData({ ...formData, serviced_by: '' });
  };

  // Handle inventory item selection
  const handleDeviceSelect = (item: InventoryItem) => {
    setSelectedInventoryItem(item);

    const categoryName = item.categories?.name || '';
    const brandName = item.brands?.name || '';
    const modelName = item.models?.name || '';
    const serial = item.serial_number || '';

    const deviceString = [categoryName, brandName, modelName, serial].filter(Boolean).join(' ');
    setDeviceSearchTerm(deviceString);
    setShowDeviceDropdown(false);

    setFormData(prev => ({
      ...prev,
      device: deviceString,
      station_id: item.stations?.id || '', // Auto-populate station from device
    }));
  };

  const handleClearDeviceSelection = () => {
    setSelectedInventoryItem(null);
    setDeviceSearchTerm('');
    setShowDeviceDropdown(false);
    setFormData(prev => ({
      ...prev,
      device: '',
      station_id: '',
    }));
  };

  // Handle image selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Validate: max 10 images total
    if (selectedImages.length + files.length > 10) {
      setError(`You can only upload up to 10 images. Currently selected: ${selectedImages.length}`);
      return;
    }

    // Filter only image files
    const imageFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file`);
        return false;
      }
      return true;
    });

    if (imageFiles.length === 0) {
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    try {
      // Compress images (max 1MB, max dimension 1920px, quality 0.8)
      const compressedFiles = await compressImages(imageFiles, 1, 1920, 0.8);

      // Create preview URLs
      const newPreviewUrls = compressedFiles.map(file => URL.createObjectURL(file));

      setSelectedImages(prev => [...prev, ...compressedFiles]);
      setImagePreviewUrls(prev => [...prev, ...newPreviewUrls]);
      setError(null);
    } catch (error) {
      console.error('Error compressing images:', error);
      setError('Failed to process images. Please try again.');
    }

    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  // Handle removing an image
  const handleRemoveImage = (index: number) => {
    // Revoke the preview URL to free memory
    URL.revokeObjectURL(imagePreviewUrls[index]);

    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
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
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(event.target as Node)) {
        setShowDeviceDropdown(false);
      }
      if (requestTypeDropdownRef.current && !requestTypeDropdownRef.current.contains(event.target as Node)) {
        setShowRequestTypeDropdown(false);
      }
      if (problemCategoryDropdownRef.current && !problemCategoryDropdownRef.current.contains(event.target as Node)) {
        setShowProblemCategoryDropdown(false);
      }
    };

    if (showStoreDropdown || showEmployeeDropdown || showDeviceDropdown || showRequestTypeDropdown || showProblemCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStoreDropdown, showEmployeeDropdown, showDeviceDropdown, showRequestTypeDropdown, showProblemCategoryDropdown]);

  // Severity options
  const severityOptions = [
    { value: 'sev1', label: 'sev1', color: 'text-blue-400' },
    { value: 'sev2', label: 'sev2', color: 'text-yellow-400' },
    { value: 'sev3', label: 'sev3', color: 'text-red-400' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedInventoryItem) {
        setError('Please select a device from inventory');
        setLoading(false);
        return;
    }
    if (!formData.station_id) {
        setError('Station is required (auto-filled from device selection)');
        setLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: 'open',
          reported_by: currentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      // Upload images if any
      if (selectedImages.length > 0 && data.ticket?.id) {
        try {
          const attachments = [];
          const uploadErrors = [];

          for (const [index, file] of selectedImages.entries()) {
            // Create file name with ticket folder structure
            const fileExt = file.name.split('.').pop();
            const fileName = `image-${index + 1}.${fileExt}`;
            const filePath = `${data.ticket.id}/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from('ticket-attachments')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('Error uploading image:', uploadError);
              uploadErrors.push(`${file.name}: ${uploadError.message}`);
              continue;
            }

            // Save attachment record
            attachments.push({
              ticket_id: data.ticket.id,
              file_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: currentUserId,
            });
          }

          // Save all attachments to database
          if (attachments.length > 0) {
            const { error: dbError } = await supabase
              .from('ticket_attachments')
              .insert(attachments);

            if (dbError) {
              console.error('Error saving attachments to database:', dbError);
              alert(`Ticket created successfully, but failed to save attachments to database:\n${dbError.message}\n\nPlease check:\n1. Run the SQL migration: /supabase/setup_ticket_attachments.sql\n2. Check RLS policies on ticket_attachments table`);
            } else if (uploadErrors.length > 0) {
              alert(`Ticket created successfully.\n\nSome images failed to upload:\n${uploadErrors.join('\n')}\n\nPlease check:\n1. Storage bucket 'tickets' exists\n2. Storage policies allow uploads`);
            }
          } else if (uploadErrors.length > 0) {
            alert(`Ticket created successfully, but all images failed to upload:\n${uploadErrors.join('\n')}\n\nPlease check:\n1. Storage bucket 'tickets' exists in Supabase Dashboard\n2. Run SQL migration: /supabase/setup_ticket_attachments.sql\n3. Check storage policies`);
          }
        } catch (uploadError: any) {
          console.error('Error processing attachments:', uploadError);
          alert(`Ticket created successfully, but attachment processing failed:\n${uploadError.message}`);
        }
      }

      // Reset form
      setFormData({
        store_id: '',
        station_id: '',
        mod_id: '',
        rcc_reference_number: '',
        request_type: '',
        request_type_id: '',
        device: '',
        request_detail: '',
        problem_category: '',
        problem_category_id: '',
        sev: '',
        serviced_by: '',
        kb_id: '',
        date_reported: formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd'),
        time_reported: formatInTimeZone(new Date(), 'Asia/Manila', 'HH:mm'),
      });
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setShowStoreDropdown(false);
      setSelectedEmployee(null);
      setEmployeeSearchTerm('');
      setShowEmployeeDropdown(false);
      setInventoryItems([]);
      setSelectedInventoryItem(null);
      setDeviceSearchTerm('');
      setShowDeviceDropdown(false);
      setIsLoadingDevices(false);
      setSelectedKbArticle(null);
      setRequestTypeSearchTerm('');
      setShowRequestTypeDropdown(false);
      setProblemCategorySearchTerm('');
      setShowProblemCategoryDropdown(false);

      // Clean up image previews
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setSelectedImages([]);
      setImagePreviewUrls([]);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
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
                    <Calendar size={14} className="text-white" />
                    Date Reported <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date_reported}
                    onChange={(e) => setFormData({ ...formData, date_reported: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <Clock size={14} className="text-white" />
                    Time Reported <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.time_reported}
                    onChange={(e) => setFormData({ ...formData, time_reported: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    required
                  />
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

            {/* RCC Reference Number and Serviced By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Serviced By - Employee Selector */}
              <div ref={employeeDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Serviced By <span className="text-slate-500 text-xs">(Optional)</span>
                  {selectedEmployee && <span className="text-xs text-slate-500 ml-2">(Selected: {selectedEmployee.fullName})</span>}
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
                              <div className="text-sm font-medium text-white">{employee.fullName}</div>
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
            </div>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Manager on Duty</label>
                  <input
                    type="text"
                    value={managerOnDuty}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {/* Device Selection from Inventory */}
            <div ref={deviceDropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Select Device <span className="text-red-500">*</span>
                {selectedInventoryItem && <span className="text-xs text-slate-500 ml-2">(Selected)</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deviceSearchTerm}
                  onChange={(e) => {
                    setDeviceSearchTerm(e.target.value);
                    setShowDeviceDropdown(true);
                  }}
                  onFocus={() => setShowDeviceDropdown(true)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={!selectedStore ? "Select a store first..." : isLoadingDevices ? "Loading devices..." : "Search for a device..."}
                  disabled={!selectedStore || isLoadingDevices}
                  required={!selectedInventoryItem}
                />
                {isLoadingDevices && (
                  <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={16} />
                )}
                {selectedInventoryItem && !isLoadingDevices && (
                  <button
                    type="button"
                    onClick={handleClearDeviceSelection}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Clear selection"
                  >
                    <X size={16} />
                  </button>
                )}
                {!isLoadingDevices && (
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                )}
              </div>

              {/* Device Dropdown Menu */}
              {showDeviceDropdown && selectedStore && (
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {isLoadingDevices ? (
                    <div className="px-4 py-8 flex flex-col items-center justify-center text-slate-400">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm">Loading devices...</p>
                    </div>
                  ) : filteredDevices.length > 0 ? (
                    filteredDevices.map((item) => {
                      const categoryName = item.categories?.name || '';
                      const brandName = item.brands?.name || '';
                      const modelName = item.models?.name || '';
                      const serial = item.serial_number || '';
                      const stationName = item.stations?.name || '';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleDeviceSelect(item)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">
                                {categoryName} {brandName} {modelName}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {serial && `Serial: ${serial}`}
                                {serial && stationName && ' • '}
                                {stationName && `Station: ${stationName}`}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      {inventoryItems.length === 0 ? 'No devices found for this store' : 'No matching devices'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Station - Auto-populated from device */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Station <span className="text-red-500">*</span> <span className="text-xs text-slate-500">(Auto-filled from device)</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-2 pr-10 rounded-lg cursor-not-allowed appearance-none"
                  disabled={true}
                >
                  <option value="">Station will be auto-filled when you select a device</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Request Type - Searchable Dropdown */}
              <div ref={requestTypeDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={requestTypeSearchTerm}
                    onChange={(e) => {
                      setRequestTypeSearchTerm(e.target.value);
                      setFormData({ ...formData, request_type: e.target.value, request_type_id: '' });
                      setShowRequestTypeDropdown(true);
                    }}
                    onFocus={() => setShowRequestTypeDropdown(true)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={isLoadingRequestTypes ? "Loading..." : "Type or select from dropdown..."}
                    disabled={isLoadingRequestTypes}
                  />
                  {isLoadingRequestTypes ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />
                  ) : (
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  )}
                </div>

                {/* Request Type Dropdown Menu */}
                {showRequestTypeDropdown && !isLoadingRequestTypes && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredRequestTypes.length > 0 ? (
                      filteredRequestTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            setRequestTypeSearchTerm(type.name);
                            setFormData({ ...formData, request_type: type.name, request_type_id: type.id });
                            setShowRequestTypeDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                        >
                          <div className="text-sm font-medium text-white">{type.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        {requestTypeSearchTerm ? `No matching types. Press Enter to use "${requestTypeSearchTerm}"` : 'No request types available'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Problem Category - Searchable Dropdown */}
              <div ref={problemCategoryDropdownRef} className="relative">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Problem Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={problemCategorySearchTerm}
                    onChange={(e) => {
                      setProblemCategorySearchTerm(e.target.value);
                      setFormData({ ...formData, problem_category: e.target.value, problem_category_id: '' });
                      setShowProblemCategoryDropdown(true);
                    }}
                    onFocus={() => setShowProblemCategoryDropdown(true)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={isLoadingProblemCategories ? "Loading..." : "Type or select from dropdown..."}
                    disabled={isLoadingProblemCategories}
                  />
                  {isLoadingProblemCategories ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />
                  ) : (
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  )}
                </div>

                {/* Problem Category Dropdown Menu */}
                {showProblemCategoryDropdown && !isLoadingProblemCategories && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredProblemCategories.length > 0 ? (
                      filteredProblemCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setProblemCategorySearchTerm(category.name);
                            setFormData({ ...formData, problem_category: category.name, problem_category_id: category.id });
                            setShowProblemCategoryDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                        >
                          <div className="text-sm font-medium text-white">{category.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        {problemCategorySearchTerm ? `No matching categories. Press Enter to use "${problemCategorySearchTerm}"` : 'No problem categories available'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Device (Auto-generated) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.device}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-2 rounded-lg cursor-not-allowed"
                  placeholder="Category Brand Model Serial"
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

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Attachments <span className="text-slate-500 text-xs">(Optional - Max 10 images, 5MB each)</span>
              </label>

              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={selectedImages.length >= 10}
                className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-800 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={18} />
                <span>Upload Images ({selectedImages.length}/10)</span>
              </button>

              {/* Image Preview Grid */}
              {selectedImages.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-700">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                        title="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white truncate">
                          {selectedImages[index].name}
                        </p>
                        <p className="text-xs text-slate-300">
                          {(selectedImages[index].size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KB Article Reference (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Related KB Article <span className="text-slate-500 text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={formData.kb_id}
                  onChange={(e) => {
                    const kbId = e.target.value;
                    setFormData({ ...formData, kb_id: kbId });
                    const article = kbArticles.find(a => a.id === kbId);
                    setSelectedKbArticle(article || null);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 pr-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                >
                  <option value="">No KB article selected</option>
                  {kbArticles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.kb_code} - {article.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              {selectedKbArticle && (
                <p className="text-xs text-slate-500 mt-1">
                  Selected: {selectedKbArticle.kb_code} - {selectedKbArticle.title}
                </p>
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