'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, Check, Plus, Trash2, Receipt, Upload, File, XCircle, Pencil, FileImage, Search, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface LiquidationItemData {
  id: string;
  expense_date?: string;
  from_destination: string;
  to_destination: string;
  jeep: number;
  bus: number;
  fx_van: number;
  gas: number;
  toll: number;
  meals: number;
  lodging: number;
  others: number;
  total: number;
  remarks: string;
  liquidation_item_attachments?: LiquidationAttachment[];
}

interface LiquidationAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
}

interface EditingLiquidation {
  id: string;
  cash_advance_id: string;
  store_id: string;
  ticket_id: number | null;
  liquidation_date: string;
  remarks: string | null;
  cash_advances: {
    id: string;
    amount: number;
    date_requested: string;
  } | null;
  liquidation_items: LiquidationItemData[];
  liquidation_attachments?: LiquidationAttachment[];
}

interface FileLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  editingLiquidation?: EditingLiquidation | null;
}

interface CashAdvance {
  id: string;
  type: 'personal' | 'support' | 'reimbursement';
  amount: number;
  purpose: string | null;
  status: string;
  date_requested: string;
  created_at: string;
}

interface Store {
  id: string;
  store_code: string;
  store_name: string;
}

interface Ticket {
  id: number;
  rcc_reference_number: string;
  stores: {
    store_name: string;
    store_code: string;
  } | null;
}

interface LiquidationItem {
  id: string;
  expense_date: string;
  from_destination: string;
  to_destination: string;
  jeep: string;
  bus: string;
  fx_van: string;
  gas: string;
  toll: string;
  meals: string;
  lodging: string;
  others: string;
  remarks: string;
  files?: File[];
  filePreviews?: string[];
  existingAttachments?: LiquidationAttachment[];
  attachmentsToRemove?: string[];
}

interface LiquidationFormData {
  cash_advance_id: string;
  store_id: string;
  ticket_id: string;
  liquidation_date: string;
  remarks: string;
  items: LiquidationItem[];
}

const emptyItem = (): LiquidationItem => ({
  id: Math.random().toString(36).substr(2, 9),
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  from_destination: '',
  to_destination: '',
  jeep: '',
  bus: '',
  fx_van: '',
  gas: '',
  toll: '',
  meals: '',
  lodging: '',
  others: '',
  remarks: '',
  files: [],
  filePreviews: [],
  existingAttachments: [],
  attachmentsToRemove: [],
});

// Image compression utility
const compressImage = (file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Skip if file is already small (less than 500KB)
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        // Calculate new dimensions
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Only use compressed version if it's smaller
            if (blob.size < file.size) {
              // Create a new file from the blob
              const compressedFile = new window.File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const fetchApprovedCashAdvances = async (): Promise<CashAdvance[]> => {
  const response = await fetch('/api/cash-advance/my-requests?limit=100');
  if (!response.ok) {
    throw new Error('Failed to fetch cash advances');
  }
  const data = await response.json();
  // Only return approved support and reimbursement cash advances that don't have liquidations yet
  return data.cashAdvances.filter(
    (ca: CashAdvance) => ca.status === 'approved' && (ca.type === 'support' || ca.type === 'reimbursement')
  );
};

const searchStores = async (query: string): Promise<Store[]> => {
  const response = await fetch(`/api/stores/search?q=${encodeURIComponent(query)}&limit=30`);
  if (!response.ok) {
    throw new Error('Failed to search stores');
  }
  const data = await response.json();
  return data.stores || [];
};

const searchTickets = async (query: string): Promise<Ticket[]> => {
  const response = await fetch(`/api/tickets/search?q=${encodeURIComponent(query)}&limit=30`);
  if (!response.ok) {
    throw new Error('Failed to search tickets');
  }
  const data = await response.json();
  return data.tickets || [];
};

const fetchStoreById = async (id: string): Promise<Store | null> => {
  const response = await fetch(`/api/stores/search?id=${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.stores?.[0] || null;
};

const fetchTicketById = async (id: string): Promise<Ticket | null> => {
  const response = await fetch(`/api/tickets/search?id=${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.tickets?.[0] || null;
};

const submitLiquidation = async (data: LiquidationFormData & { userId: string }) => {
  const response = await fetch('/api/liquidation/file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to submit liquidation');
  }

  return result;
};

const updateLiquidation = async (data: LiquidationFormData & { liquidation_id: string; attachments_to_remove?: string[] }) => {
  const response = await fetch('/api/liquidation/update', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update liquidation');
  }

  return result;
};

interface UploadReceiptsData {
  liquidation_id: string;
  files: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData: string;
  }[];
}

const uploadReceipts = async (data: UploadReceiptsData) => {
  const response = await fetch('/api/liquidation/upload-receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to upload receipts');
  }

  return result;
};

const fetchAttachmentUrl = async (attachmentId: string): Promise<string | null> => {
  const response = await fetch(`/api/liquidation/get-receipt-url?attachment_id=${attachmentId}`);
  if (response.ok) {
    const data = await response.json();
    return data.url;
  }
  return null;
};

const fetchAllAttachmentUrls = async (attachments: LiquidationAttachment[]): Promise<{ [key: string]: string }> => {
  const urls: { [key: string]: string } = {};

  await Promise.all(
    attachments.map(async (attachment) => {
      const url = await fetchAttachmentUrl(attachment.id);
      if (url) {
        urls[attachment.id] = url;
      }
    })
  );

  return urls;
};

const FileLiquidationModal: React.FC<FileLiquidationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  editingLiquidation,
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!editingLiquidation;

  const [formData, setFormData] = useState<LiquidationFormData>({
    cash_advance_id: '',
    store_id: '',
    ticket_id: '',
    liquidation_date: format(new Date(), 'yyyy-MM-dd'),
    remarks: '',
    items: [emptyItem()],
  });
  const [error, setError] = useState<string | null>(null);
  const [hasPopulatedForm, setHasPopulatedForm] = useState(false);

  // Search states for store and ticket
  const [storeSearch, setStoreSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [debouncedStoreSearch, setDebouncedStoreSearch] = useState('');
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Refs for dropdown click outside handling
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const ticketDropdownRef = useRef<HTMLDivElement>(null);

  // Track all blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStoreSearch(storeSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [storeSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTicketSearch(ticketSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [ticketSearch]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
      if (ticketDropdownRef.current && !ticketDropdownRef.current.contains(event.target as Node)) {
        setShowTicketDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch approved cash advances
  const { data: cashAdvances = [], isLoading: loadingCashAdvances } = useQuery({
    queryKey: ['approved-cash-advances'],
    queryFn: fetchApprovedCashAdvances,
    enabled: isOpen && !isEditMode,
  });

  // Search stores
  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: ['stores-search', debouncedStoreSearch],
    queryFn: () => searchStores(debouncedStoreSearch),
    enabled: isOpen && showStoreDropdown,
    staleTime: 1000 * 60, // 1 minute
  });

  // Search tickets
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets-search', debouncedTicketSearch],
    queryFn: () => searchTickets(debouncedTicketSearch),
    enabled: isOpen && showTicketDropdown,
    staleTime: 1000 * 60, // 1 minute
  });

  // Fetch existing attachment URLs for edit mode
  const attachmentIds = editingLiquidation?.liquidation_attachments?.map(a => a.id) || [];
  const { data: existingAttachmentUrls = {}, isLoading: loadingExistingAttachments } = useQuery({
    queryKey: ['attachment-urls', editingLiquidation?.id],
    queryFn: () => fetchAllAttachmentUrls(editingLiquidation?.liquidation_attachments || []),
    enabled: isOpen && isEditMode && attachmentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes - signed URLs are valid for 1 hour
  });

  // Upload receipts mutation
  const uploadMutation = useMutation({
    mutationFn: uploadReceipts,
    onError: (err: Error) => {
      console.error('Failed to upload receipts:', err.message);
    },
  });

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Helper function to prepare files for upload with item association
  const prepareFilesForUpload = async (itemId: string, files: File[]) => {
    return Promise.all(
      files.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
          liquidation_item_id: itemId,
        };
      })
    );
  };

  const createMutation = useMutation({
    mutationFn: submitLiquidation,
    onSuccess: async (result) => {
      // Upload files for each item if any
      if (result.liquidation?.id && result.liquidation?.items) {
        const uploadPromises = formData.items.map(async (item, index) => {
          if (item.files && item.files.length > 0) {
            // Get the created item ID from the result
            const createdItemId = result.liquidation.items[index]?.id;
            if (createdItemId) {
              const filesData = await prepareFilesForUpload(createdItemId, item.files);
              return uploadMutation.mutateAsync({
                liquidation_id: result.liquidation.id,
                files: filesData,
              });
            }
          }
        });
        await Promise.all(uploadPromises.filter(Boolean));
      }

      await queryClient.invalidateQueries({ queryKey: ['my-liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['approved-cash-advances'] });
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'An unexpected error occurred.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateLiquidation,
    onSuccess: async (result) => {
      // Collect all attachments to remove from all items
      const allAttachmentsToRemove = formData.items
        .flatMap(item => item.attachmentsToRemove || []);

      // Upload new files for each item if any
      if (result.liquidation?.id && result.liquidation?.items) {
        // Map form items to newly created item IDs by index
        const uploadPromises = formData.items.map(async (item, index) => {
          if (item.files && item.files.length > 0) {
            // Get the newly created item ID from the result (same order as formData.items)
            const createdItemId = result.liquidation.items[index]?.id;
            if (createdItemId) {
              const filesData = await prepareFilesForUpload(createdItemId, item.files);
              return uploadMutation.mutateAsync({
                liquidation_id: result.liquidation.id,
                files: filesData,
              });
            }
          }
        });
        await Promise.all(uploadPromises.filter(Boolean));
      }

      await queryClient.invalidateQueries({ queryKey: ['my-liquidations'] });
      await queryClient.invalidateQueries({ queryKey: ['attachment-urls', result.liquidation?.id] });
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'An unexpected error occurred.');
    },
  });

  // Clean up all blob URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all tracked blob URLs to prevent memory leaks
      blobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasPopulatedForm(false);
      setError(null);
      setStoreSearch('');
      setTicketSearch('');
      setSelectedStore(null);
      setSelectedTicket(null);
      setShowStoreDropdown(false);
      setShowTicketDropdown(false);
    }
  }, [isOpen]);

  // Populate form when modal opens and data is ready
  // For edit mode: fetch store and ticket data
  // For create mode: populate immediately
  useEffect(() => {
    if (!isOpen || hasPopulatedForm) return;

    // For create mode, populate immediately
    if (!editingLiquidation) {
      setFormData({
        cash_advance_id: '',
        store_id: '',
        ticket_id: '',
        liquidation_date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        items: [emptyItem()],
      });
      setHasPopulatedForm(true);
      return;
    }

    // For edit mode, fetch store and ticket data
    const loadEditData = async () => {
      // Populate form with existing data
      setFormData({
        cash_advance_id: editingLiquidation.cash_advance_id,
        store_id: editingLiquidation.store_id,
        ticket_id: editingLiquidation.ticket_id ? String(editingLiquidation.ticket_id) : '',
        liquidation_date: editingLiquidation.liquidation_date.split('T')[0],
        remarks: editingLiquidation.remarks || '',
        items: editingLiquidation.liquidation_items.map((item) => ({
          id: item.id || Math.random().toString(36).substr(2, 9),
          expense_date: item.expense_date ? item.expense_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
          from_destination: item.from_destination || '',
          to_destination: item.to_destination || '',
          jeep: item.jeep > 0 ? String(item.jeep) : '',
          bus: item.bus > 0 ? String(item.bus) : '',
          fx_van: item.fx_van > 0 ? String(item.fx_van) : '',
          gas: item.gas > 0 ? String(item.gas) : '',
          toll: item.toll > 0 ? String(item.toll) : '',
          meals: item.meals > 0 ? String(item.meals) : '',
          lodging: item.lodging > 0 ? String(item.lodging) : '',
          others: item.others > 0 ? String(item.others) : '',
          remarks: item.remarks || '',
          files: [],
          filePreviews: [],
          existingAttachments: item.liquidation_item_attachments || [],
          attachmentsToRemove: [],
        })),
      });

      // Fetch store and ticket data for display
      if (editingLiquidation.store_id) {
        const store = await fetchStoreById(editingLiquidation.store_id);
        if (store) {
          setSelectedStore(store);
        }
      }

      if (editingLiquidation.ticket_id) {
        const ticket = await fetchTicketById(String(editingLiquidation.ticket_id));
        if (ticket) {
          setSelectedTicket(ticket);
        }
      }

      setHasPopulatedForm(true);
    };

    loadEditData();
  }, [isOpen, editingLiquidation, hasPopulatedForm]);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    setError(null);

    // Validate
    if (!isEditMode && !formData.cash_advance_id) {
      setError('Please select a cash advance to liquidate.');
      return;
    }


    // Check if at least one item has values
    const hasValues = formData.items.some(
      (item) =>
        parseFloat(item.jeep || '0') > 0 ||
        parseFloat(item.bus || '0') > 0 ||
        parseFloat(item.fx_van || '0') > 0 ||
        parseFloat(item.gas || '0') > 0 ||
        parseFloat(item.toll || '0') > 0 ||
        parseFloat(item.meals || '0') > 0 ||
        parseFloat(item.lodging || '0') > 0 ||
        parseFloat(item.others || '0') > 0
    );

    if (!hasValues) {
      console.log('Validation failed: no expense values');
      setError('Please add at least one expense item.');
      return;
    }

    console.log('Validation passed, calling mutation');

    if (isEditMode && editingLiquidation) {
      // Collect all attachments to remove from all items
      const allAttachmentsToRemove = formData.items
        .flatMap(item => item.attachmentsToRemove || []);

      console.log('Calling updateMutation with:', {
        ...formData,
        liquidation_id: editingLiquidation.id,
        attachments_to_remove: allAttachmentsToRemove,
      });
      updateMutation.mutate({
        ...formData,
        liquidation_id: editingLiquidation.id,
        attachments_to_remove: allAttachmentsToRemove.length > 0 ? allAttachmentsToRemove : undefined,
      });
    } else {
      createMutation.mutate({
        ...formData,
        userId,
      });
    }
  };

  const handleClose = () => {
    // Revoke all tracked blob URLs
    blobUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    blobUrlsRef.current.clear();

    // Reset form to initial state
    setFormData({
      cash_advance_id: '',
      store_id: '',
      ticket_id: '',
      liquidation_date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      items: [emptyItem()],
    });

    // Reset search states
    setStoreSearch('');
    setTicketSearch('');
    setSelectedStore(null);
    setSelectedTicket(null);
    setShowStoreDropdown(false);
    setShowTicketDropdown(false);

    onClose();
  };

  const [isCompressing, setIsCompressing] = useState<{ [key: string]: boolean }>({});

  const handleFileSelect = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);

      // Validate that all files are images
      const nonImageFiles = newFiles.filter(file => !file.type.startsWith('image/'));
      if (nonImageFiles.length > 0) {
        setError(`Only image files are allowed. Please remove: ${nonImageFiles.map(f => f.name).join(', ')}`);
        e.target.value = '';
        return;
      }

      setIsCompressing((prev) => ({ ...prev, [itemId]: true }));

      try {
        // Compress images before adding
        const processedFiles = await Promise.all(
          newFiles.map(async (file) => await compressImage(file))
        );

        // Create preview URLs for each processed file
        const newPreviews: string[] = [];
        for (const file of processedFiles) {
          const previewUrl = URL.createObjectURL(file);
          blobUrlsRef.current.add(previewUrl); // Track for cleanup
          newPreviews.push(previewUrl);
        }

        console.log('Adding previews:', newPreviews.length, 'files:', processedFiles.length);

        // Update the specific item
        setFormData((prev) => ({
          ...prev,
          items: prev.items.map((item) => {
            if (item.id === itemId) {
              const updatedFiles = [...(item.files || []), ...processedFiles];
              const updatedPreviews = [...(item.filePreviews || []), ...newPreviews];
              console.log('Updated item:', {
                totalFiles: updatedFiles.length,
                totalPreviews: updatedPreviews.length,
              });
              return {
                ...item,
                files: updatedFiles,
                filePreviews: updatedPreviews,
              };
            }
            return item;
          }),
        }));
      } catch (error) {
        console.error('Error processing files:', error);
        setError('Failed to process images. Please try again.');

        // Fallback to original files if compression fails
        const newPreviews: string[] = [];
        for (const file of newFiles) {
          const previewUrl = URL.createObjectURL(file);
          blobUrlsRef.current.add(previewUrl); // Track for cleanup
          newPreviews.push(previewUrl);
        }

        setFormData((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  files: [...(item.files || []), ...newFiles],
                  filePreviews: [...(item.filePreviews || []), ...newPreviews],
                }
              : item
          ),
        }));
      } finally {
        setIsCompressing((prev) => ({ ...prev, [itemId]: false }));
      }
    }
    e.target.value = '';
  };

  const removeFile = (itemId: string, fileIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          // Revoke the object URL if it exists to prevent memory leaks
          if (item.filePreviews?.[fileIndex]) {
            const urlToRevoke = item.filePreviews[fileIndex];
            URL.revokeObjectURL(urlToRevoke);
            blobUrlsRef.current.delete(urlToRevoke); // Remove from tracked URLs
          }

          return {
            ...item,
            files: item.files?.filter((_, i) => i !== fileIndex) || [],
            filePreviews: item.filePreviews?.filter((_, i) => i !== fileIndex) || [],
          };
        }
        return item;
      }),
    }));
  };

  const removeExistingAttachment = (itemId: string, attachmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              attachmentsToRemove: [...(item.attachmentsToRemove || []), attachmentId],
            }
          : item
      ),
    }));
  };

  const undoRemoveAttachment = (itemId: string, attachmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              attachmentsToRemove: (item.attachmentsToRemove || []).filter((id) => id !== attachmentId),
            }
          : item
      ),
    }));
  };

  const handlePreviewNewFile = (itemId: string, fileIndex: number) => {
    const item = formData.items.find(i => i.id === itemId);
    console.log('Preview request:', {
      itemId,
      fileIndex,
      totalFiles: item?.files?.length,
      totalPreviews: item?.filePreviews?.length,
      previewUrl: item?.filePreviews?.[fileIndex],
      fileName: item?.files?.[fileIndex]?.name,
    });

    if (item?.filePreviews?.[fileIndex]) {
      setPreviewImage({
        url: item.filePreviews[fileIndex],
        name: item.files?.[fileIndex]?.name || 'Image',
      });
    } else {
      console.error('No preview available at index', fileIndex);
    }
  };

  const handlePreviewExistingAttachment = async (attachmentId: string, fileName: string) => {
    const url = await fetchAttachmentUrl(attachmentId);
    if (url) {
      setPreviewImage({ url, name: fileName });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, emptyItem()],
    });
  };

  const removeItem = (id: string) => {
    if (formData.items.length === 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== id),
    });
  };

  const updateItem = (id: string, field: keyof LiquidationItem, value: string) => {
    setFormData({
      ...formData,
      items: formData.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    return numericValue;
  };

  const calculateItemTotal = (item: LiquidationItem): number => {
    return (
      parseFloat(item.jeep || '0') +
      parseFloat(item.bus || '0') +
      parseFloat(item.fx_van || '0') +
      parseFloat(item.gas || '0') +
      parseFloat(item.toll || '0') +
      parseFloat(item.meals || '0') +
      parseFloat(item.lodging || '0') +
      parseFloat(item.others || '0')
    );
  };

  const calculateGrandTotal = (): number => {
    return formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const getSelectedCashAdvance = (): CashAdvance | { amount: number; date_requested: string } | undefined => {
    if (isEditMode && editingLiquidation?.cash_advances) {
      return {
        amount: editingLiquidation.cash_advances.amount,
        date_requested: editingLiquidation.cash_advances.date_requested,
      };
    }
    return cashAdvances.find((ca) => ca.id === formData.cash_advance_id);
  };

  const calculateReturnToCompany = (): number => {
    const selectedCA = getSelectedCashAdvance();
    if (!selectedCA) return 0;
    const diff = selectedCA.amount - calculateGrandTotal();
    return diff > 0 ? diff : 0;
  };

  const calculateReimbursement = (): number => {
    const selectedCA = getSelectedCashAdvance();
    if (!selectedCA) return 0;
    const diff = calculateGrandTotal() - selectedCA.amount;
    return diff > 0 ? diff : 0;
  };

  const formatPeso = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isUploadingFiles = uploadMutation.isPending;
  const isLoadingData = isEditMode && !hasPopulatedForm;

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="text-orange-400" size={24} />
                Edit Liquidation
              </>
            ) : (
              <>
                <Receipt className="text-orange-400" size={24} />
                File Liquidation
              </>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                <p className="text-slate-400 text-sm">Loading liquidation data...</p>
              </div>
            </div>
          ) : (
            <>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Top Section: Cash Advance, Store, Ticket, Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cash Advance Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                Cash Advance <span className="text-red-400">*</span>
              </label>
              {isEditMode ? (
                <div className="w-full bg-slate-950 border border-slate-700 text-white h-11 rounded-xl px-4 flex items-center">
                  <span className="text-slate-300">
                    {editingLiquidation?.cash_advances
                      ? `${formatPeso(editingLiquidation.cash_advances.amount)} - ${format(new Date(editingLiquidation.cash_advances.date_requested), 'MMM dd, yyyy')}`
                      : 'N/A'}
                  </span>
                </div>
              ) : (
                <Select
                  value={formData.cash_advance_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cash_advance_id: value })
                  }
                  disabled={loadingCashAdvances}
                >
                  <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white h-11 rounded-xl focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 [&>span]:text-left">
                    <SelectValue placeholder="Select cash advance" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60 z-[10000]">
                    {cashAdvances.map((ca) => (
                      <SelectItem
                        key={ca.id}
                        value={ca.id}
                        className="text-white focus:bg-slate-800 focus:text-white cursor-pointer"
                      >
                        {formatPeso(ca.amount)} - {format(new Date(ca.date_requested), 'MMM dd, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isEditMode && cashAdvances.length === 0 && !loadingCashAdvances && (
                <p className="text-xs text-amber-400 mt-1">
                  No approved support or reimbursement cash advances available
                </p>
              )}
            </div>

            {/* Store/Site Selection - Searchable */}
            <div ref={storeDropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                Site Name (Store Code)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  value={selectedStore ? `${selectedStore.store_code} - ${selectedStore.store_name}` : storeSearch}
                  onChange={(e) => {
                    setStoreSearch(e.target.value);
                    setSelectedStore(null);
                    setFormData({ ...formData, store_id: '' });
                    if (!showStoreDropdown) setShowStoreDropdown(true);
                  }}
                  onFocus={() => setShowStoreDropdown(true)}
                  placeholder="Search store by name or code..."
                  className="w-full bg-slate-950 border border-slate-700 text-white pl-9 pr-10 py-2.5 h-11 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                >
                  <ChevronDown size={18} className={`transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Store Dropdown */}
              {showStoreDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[10000] overflow-hidden max-h-60 overflow-y-auto">
                  {loadingStores ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      <span className="ml-2 text-sm text-slate-400">Searching...</span>
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      {debouncedStoreSearch ? 'No stores found' : 'Type to search stores'}
                    </div>
                  ) : (
                    stores.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => {
                          setSelectedStore(store);
                          setFormData({ ...formData, store_id: store.id });
                          setStoreSearch('');
                          setShowStoreDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
                          formData.store_id === store.id
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="font-medium">{store.store_code}</span>
                        <span className="text-slate-400"> - {store.store_name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Ticket/Incident Selection - Searchable */}
            <div ref={ticketDropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                Incident No. (Ticket)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  value={selectedTicket ? `${selectedTicket.rcc_reference_number} - ${selectedTicket.stores?.store_code || 'N/A'}` : ticketSearch}
                  onChange={(e) => {
                    setTicketSearch(e.target.value);
                    setSelectedTicket(null);
                    setFormData({ ...formData, ticket_id: '' });
                    if (!showTicketDropdown) setShowTicketDropdown(true);
                  }}
                  onFocus={() => setShowTicketDropdown(true)}
                  placeholder="Search by incident number..."
                  className="w-full bg-slate-950 border border-slate-700 text-white pl-9 pr-10 py-2.5 h-11 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowTicketDropdown(!showTicketDropdown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                >
                  <ChevronDown size={18} className={`transition-transform ${showTicketDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Ticket Dropdown */}
              {showTicketDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[10000] overflow-hidden max-h-60 overflow-y-auto">
                  {loadingTickets ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      <span className="ml-2 text-sm text-slate-400">Searching...</span>
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      {debouncedTicketSearch ? 'No tickets found' : 'Type to search tickets'}
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setFormData({ ...formData, ticket_id: String(ticket.id) });
                          setTicketSearch('');
                          setShowTicketDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
                          formData.ticket_id === String(ticket.id)
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="font-medium">{ticket.rcc_reference_number}</span>
                        <span className="text-slate-400"> - {ticket.stores?.store_code || 'N/A'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                Liquidation Date
              </label>
              <input
                type="date"
                value={formData.liquidation_date}
                onChange={(e) =>
                  setFormData({ ...formData, liquidation_date: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Expense Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-400">
                Expense Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus size={14} />
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-700 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Date
                    </th>
                    <th colSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700">
                      Dispatch
                    </th>
                    <th colSpan={5} className="px-3 py-2 text-center border-b border-r border-slate-700">
                      Mode of Transportation
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Meals
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Lodging
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Others
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Total
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Remarks
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-r border-slate-700 align-bottom">
                      Attachments
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-center border-b border-slate-700 align-bottom">

                    </th>
                  </tr>
                  <tr className="bg-slate-800/30 text-slate-400 text-xs">
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">From</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">To</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">Jeep</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">Bus</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">FX/Van</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">Gas</th>
                    <th className="px-2 py-2 text-center border-b border-r border-slate-700">Toll</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-700 last:border-b-0">
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="date"
                          value={item.expense_date}
                          onChange={(e) =>
                            updateItem(item.id, 'expense_date', e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none min-w-[120px] [color-scheme:dark]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          value={item.from_destination}
                          onChange={(e) =>
                            updateItem(item.id, 'from_destination', e.target.value)
                          }
                          placeholder="From"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none min-w-[80px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          value={item.to_destination}
                          onChange={(e) =>
                            updateItem(item.id, 'to_destination', e.target.value)
                          }
                          placeholder="To"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none min-w-[80px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.jeep}
                          onChange={(e) =>
                            updateItem(item.id, 'jeep', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.bus}
                          onChange={(e) =>
                            updateItem(item.id, 'bus', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.fx_van}
                          onChange={(e) =>
                            updateItem(item.id, 'fx_van', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.gas}
                          onChange={(e) =>
                            updateItem(item.id, 'gas', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.toll}
                          onChange={(e) =>
                            updateItem(item.id, 'toll', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.meals}
                          onChange={(e) =>
                            updateItem(item.id, 'meals', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.lodging}
                          onChange={(e) =>
                            updateItem(item.id, 'lodging', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.others}
                          onChange={(e) =>
                            updateItem(item.id, 'others', formatCurrency(e.target.value))
                          }
                          placeholder="0"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none text-right min-w-[60px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <div className="px-2 py-1.5 text-right text-xs font-mono text-orange-400 min-w-[70px]">
                          {formatPeso(calculateItemTotal(item))}
                        </div>
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) =>
                            updateItem(item.id, 'remarks', e.target.value)
                          }
                          placeholder="Remarks"
                          className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-xs focus:ring-1 focus:ring-orange-500 outline-none min-w-[100px]"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-700">
                        <div className="flex flex-col gap-1 min-w-[120px] max-h-[200px] overflow-y-auto">
                          {/* File Upload Button */}
                          <label
                            htmlFor={`file-upload-${item.id}`}
                            className={`flex items-center justify-center gap-1 px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                              isCompressing[item.id]
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30'
                            }`}
                          >
                            {isCompressing[item.id] ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={12} />
                                <span>Upload</span>
                              </>
                            )}
                          </label>
                          <input
                            type="file"
                            id={`file-upload-${item.id}`}
                            multiple
                            accept="image/*"
                            onChange={(e) => handleFileSelect(item.id, e)}
                            className="hidden"
                            disabled={isCompressing[item.id]}
                          />

                          {/* File Count Display */}
                          {((item.files && item.files.length > 0) || (item.existingAttachments && item.existingAttachments.length > 0)) && (
                            <div className="text-xs text-slate-400 text-center">
                              {((item.files?.length || 0) + ((item.existingAttachments?.length || 0) - (item.attachmentsToRemove?.length || 0)))} file(s)
                            </div>
                          )}

                          {/* Existing Attachments */}
                          {isEditMode && item.existingAttachments && item.existingAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.existingAttachments
                                .filter((att) => !(item.attachmentsToRemove || []).includes(att.id))
                                .map((att, attIndex) => (
                                  <div
                                    key={att.id}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs group hover:bg-blue-500/20 transition-colors cursor-pointer"
                                    title={`Click to preview: ${att.file_name}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handlePreviewExistingAttachment(att.id, att.file_name)}
                                      className="flex items-center gap-1"
                                    >
                                      <FileImage size={10} className="text-blue-400" />
                                      <span className="text-blue-400 max-w-[60px] truncate">
                                        {att.file_name}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeExistingAttachment(item.id, att.id)}
                                      className="text-red-400 hover:text-red-300"
                                      title="Remove attachment"
                                    >
                                      <XCircle size={10} />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* New Files */}
                          {item.files && item.files.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.files.map((file, fileIndex) => (
                                <div
                                  key={`${item.id}-file-${fileIndex}`}
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs group hover:bg-green-500/20 transition-colors cursor-pointer"
                                  title={`Click to preview: ${file.name}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewNewFile(item.id, fileIndex)}
                                    className="flex items-center gap-1"
                                  >
                                    <FileImage size={10} className="text-green-400" />
                                    <span className="text-green-400 max-w-[60px] truncate">
                                      #{fileIndex + 1}: {file.name}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeFile(item.id, fileIndex)}
                                    className="text-red-400 hover:text-red-300"
                                    title="Remove file"
                                  >
                                    <XCircle size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={formData.items.length === 1}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Remarks */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                General Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none placeholder-slate-500"
              />
            </div>

            {/* Totals */}
            <div className="space-y-3">
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                {getSelectedCashAdvance() && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Cash Advance:</span>
                    <span className="text-white font-mono">
                      {formatPeso(getSelectedCashAdvance()!.amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Expenses:</span>
                  <span className="text-orange-400 font-mono font-semibold">
                    {formatPeso(calculateGrandTotal())}
                  </span>
                </div>
                {getSelectedCashAdvance() && (
                  <div className="border-t border-slate-700 pt-3 space-y-2">
                    {calculateReturnToCompany() > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Return to Company:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatPeso(calculateReturnToCompany())}
                        </span>
                      </div>
                    )}
                    {calculateReimbursement() > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Reimbursement:</span>
                        <span className="font-mono font-bold text-blue-400">
                          {formatPeso(calculateReimbursement())}
                        </span>
                      </div>
                    )}
                    {calculateReturnToCompany() === 0 && calculateReimbursement() === 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Balance:</span>
                        <span className="font-mono font-bold text-slate-300">
                          {formatPeso(0)}
                        </span>
                      </div>
                    )}
                    {calculateReimbursement() > 0 && (
                      <p className="text-xs text-blue-400">
                        Company owes you for excess expenses
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch gap-3 p-6 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || isUploadingFiles || isLoadingData || Object.values(isCompressing).some(Boolean) || (!isEditMode && cashAdvances.length === 0)}
            className="w-full sm:flex-1 px-4 py-2.5 bg-orange-600 text-white hover:bg-orange-500 rounded-xl transition-colors shadow-lg shadow-orange-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending || isUploadingFiles ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{isUploadingFiles ? 'Uploading receipts...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>{isEditMode ? 'Update Liquidation' : 'Submit Liquidation'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-white font-medium truncate flex items-center gap-2">
                <FileImage size={20} className="text-orange-400" />
                {previewImage.name}
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Image */}
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[calc(90vh-8rem)] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default FileLiquidationModal;
