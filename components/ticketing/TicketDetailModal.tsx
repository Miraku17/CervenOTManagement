import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, MapPin, Monitor, AlertTriangle, User, FileText, CheckCircle, Box, Activity, Timer, Edit2, Save, XCircle, ChevronDown, ExternalLink, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/services/supabase';
import { ToastContainer, ToastProps } from '@/components/Toast';

interface Ticket {
  id: string;
  store_id: string;
  station_id: string;
  mod_id: string;
  reported_by: string;
  serviced_by: string;
  rcc_reference_number: string;
  kb_id?: string | null;
  date_reported: string;
  time_reported: string; // HH:mm:ss or similar
  date_responded: string | null;
  time_responded: string | null;
  request_type: string;
  device: string;
  request_detail: string;
  problem_category: string;
  sev: string;
  action_taken: string | null;
  final_resolution: string | null;
  status: string;
  parts_replaced: string | null;
  new_parts_serial: string | null;
  old_parts_serial: string | null;
  date_ack: string | null;
  time_ack: string | null;
  date_attended: string | null;
  store_arrival: string | null;
  work_start: string | null;
  pause_time_start: string | null;
  pause_time_end: string | null;
  work_end: string | null;
  date_resolved: string | null;
  time_resolved: string | null;
  sla_count_hrs: number | null;
  downtime: string | null;
  sla_status: string | null;
  created_at: string;
  stores?: { store_name: string; store_code: string };
  stations?: { name: string };
  reported_by_user?: { first_name: string; last_name: string };
  serviced_by_user?: { first_name: string; last_name: string };
  manager_on_duty?: { manager_name: string };
}

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onUpdate?: (updatedTicket: Ticket) => void;
}

interface KBArticle {
  id: string;
  title: string;
  kb_code: string;
}

interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

const TimePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const [hours, minutes] = (value || '00:00').split(':');

  // Scroll selected items into view when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const selectedHour = containerRef.current.querySelector('[data-selected="true"][data-type="hour"]');
      const selectedMinute = containerRef.current.querySelector('[data-selected="true"][data-type="minute"]');
      
      if (selectedHour) selectedHour.scrollIntoView({ block: 'center' });
      if (selectedMinute) selectedMinute.scrollIntoView({ block: 'center' });
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between hover:border-slate-600 transition-colors"
      >
        <span>{value || '--:--'}</span>
        <Clock size={16} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex overflow-hidden h-64 animate-in fade-in zoom-in-95 duration-100">
           {/* Hours */}
           <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-slate-700">
             <div className="px-2 py-1.5 text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-slate-900/95 backdrop-blur-sm text-center border-b border-slate-800 z-10">Hour</div>
             {Array.from({ length: 24 }).map((_, i) => {
               const h = i.toString().padStart(2, '0');
               const isSelected = hours === h;
               return (
                 <button
                   key={h}
                   type="button"
                   data-type="hour"
                   data-selected={isSelected}
                   onClick={() => onChange(`${h}:${minutes || '00'}`)}
                   className={`w-full text-center py-2 text-sm hover:bg-slate-800 transition-colors ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-500' : 'text-slate-300'}`}
                 >
                   {h}
                 </button>
               );
             })}
           </div>

           {/* Minutes */}
           <div className="flex-1 overflow-y-auto custom-scrollbar">
             <div className="px-2 py-1.5 text-[10px] uppercase text-slate-500 font-bold sticky top-0 bg-slate-900/95 backdrop-blur-sm text-center border-b border-slate-800 z-10">Min</div>
             {Array.from({ length: 60 }).map((_, i) => {
               const m = i.toString().padStart(2, '0');
               const isSelected = minutes === m;
               return (
                 <button
                   key={m}
                   type="button"
                   data-type="minute"
                   data-selected={isSelected}
                   onClick={() => onChange(`${hours || '00'}:${m}`)}
                   className={`w-full text-center py-2 text-sm hover:bg-slate-800 transition-colors ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-500' : 'text-slate-300'}`}
                 >
                   {m}
                 </button>
               );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

// Fields that are stored as TIMESTAMP (date + time) in the DB, but edited as TIME in UI
const TIMESTAMP_FIELDS: string[] = [];

const getTimestampTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '';
  // Since they are now TIME columns, they arrive as "HH:MM:SS"
  return isoString.substring(0, 5);
};

const setTimestampTime = (originalIsoString: string | null | undefined, newTime: string): string => {
  // Now just returns the time string since we are using TIME columns
  return newTime;
};

// Helper functions for Status mapping
const toDbStatus = (status: string): string => {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (s === 'in progress') return 'in_progress';
  if (s === 'on hold') return 'on_hold';
  return s;
};

const toUiStatus = (status: string): string => {
  if (!status) return 'Open';
  const s = status.toLowerCase();
  if (s === 'in_progress') return 'In Progress';
  if (s === 'on_hold') return 'On Hold';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

interface LabelValueProps {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  editable?: boolean;
  editKey?: keyof Ticket;
  type?: string;
  isTextarea?: boolean;
  isEditMode: boolean;
  editData: Partial<Ticket>;
  setEditData: (data: Partial<Ticket>) => void;
  isSaving?: boolean;
  dateAttended?: string | null;
}

const DetailSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 sm:p-5 mb-4">
    <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2 border-b border-slate-800">
      <Icon size={18} className="text-blue-400" />
      <h3 className="font-semibold text-slate-200">{title}</h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 sm:gap-y-4 gap-x-4 sm:gap-x-6">
      {children}
    </div>
  </div>
);

const LabelValue = ({
  label,
  value,
  fullWidth = false,
  editable = false,
  editKey,
  type = 'text',
  isTextarea = false,
  isEditMode,
  editData,
  setEditData,
  isSaving = false,
  dateAttended: propDateAttended
}: LabelValueProps) => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Helper to handle time changes for timestamp fields
  const handleTimeChange = (val: string) => {
    if (editKey) {
      // It's a regular time field or date field
      setEditData({ ...editData, [editKey]: val });
    }
  };

  // Helper to get the display value for the time picker
  const getTimeValue = () => {
    return (editData[editKey as keyof Ticket] as string) || '';
  };

  return (
    <div className={`${fullWidth ? 'col-span-full' : ''}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</span>
      {isEditMode && editable && editKey ? (
        isTextarea ? (
          <textarea
            disabled={isSaving}
            value={editData[editKey] as string || ''}
            onChange={(e) => setEditData({ ...editData, [editKey]: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
          />
        ) : type === 'date' ? (
          <div className="flex items-center gap-2">
            <div
              className={`relative flex-1 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !isSaving && dateInputRef.current?.showPicker()}
            >
              <input
                ref={dateInputRef}
                disabled={isSaving}
                type="date"
                value={editData[editKey] as string || ''}
                onChange={(e) => setEditData({ ...editData, [editKey]: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm pl-3 pr-10 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer disabled:cursor-not-allowed"
              />
              <Calendar
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none"
              />
            </div>
            {editData[editKey] && !isSaving && (
              <button
                type="button"
                onClick={() => editKey && setEditData({ ...editData, [editKey]: '' })}
                className="px-2 py-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                title="Clear date"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : type === 'time' ? (
          <div className={`relative ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TimePicker
                  value={getTimeValue()}
                  onChange={handleTimeChange}
                />
              </div>
              {getTimeValue() && !isSaving && (
                <button
                  type="button"
                  onClick={() => {
                    if (editKey) {
                      setEditData({ ...editData, [editKey]: '' });
                    }
                  }}
                  className="px-2 py-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                  title="Clear time"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <input
            disabled={isSaving}
            type={type}
            value={editData[editKey] as string || ''}
            onChange={(e) => setEditData({ ...editData, [editKey]: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        )
      ) : (
        <div className="text-sm text-slate-300 font-medium break-words whitespace-pre-wrap">{value || <span className="text-slate-600 italic">N/A</span>}</div>
      )}
    </div>
  );
};

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ isOpen, onClose, ticket, onUpdate }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Ticket>>({});
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<TicketAttachment | null>(null);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]); // IDs of attachments marked for deletion
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]); // New files to upload on save
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]); // Preview URLs for pending files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [showDeleteTicketConfirm, setShowDeleteTicketConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if user is admin and has manage_tickets permission
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        setIsAdmin(profile?.role === 'admin');
        setUserPosition((profile?.positions as any)?.name || '');

        // Debug logging
        console.log('TicketDetailModal - User Info:', {
          userId: user.id,
          role: profile?.role,
          position: (profile?.positions as any)?.name,
        });
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserInfo();
  }, [user?.id]);

  // Fetch KB articles when modal opens
  useEffect(() => {
    const fetchKBArticles = async () => {
      try {
        const response = await fetch('/api/knowledge-base/get?limit=1000');
        const data = await response.json();
        if (response.ok) {
          setKbArticles(data.articles || []);
        }
      } catch (error) {
        console.error('Error fetching KB articles:', error);
      }
    };

    if (isOpen) {
      fetchKBArticles();
    }
  }, [isOpen]);

  // Fetch attachments when ticket changes
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!ticket?.id) {
        setAttachments([]);
        setAttachmentUrls({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from('ticket_attachments')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching attachments:', error);
          setAttachments([]);
          setAttachmentUrls({});
        } else {
          setAttachments(data || []);

          // Fetch signed URLs for all attachments
          const urls: Record<string, string> = {};
          for (const attachment of data || []) {
            const url = await getAttachmentUrl(attachment.file_path);
            urls[attachment.id] = url;
          }
          setAttachmentUrls(urls);
        }
      } catch (error) {
        console.error('Error fetching attachments:', error);
        setAttachments([]);
        setAttachmentUrls({});
      }
    };

    if (isOpen && ticket) {
      fetchAttachments();
    }
  }, [isOpen, ticket?.id]);

  // Helper to format time strings from HH:MM:SS to HH:MM
  const formatTimeField = (timeString: string | null | undefined): string => {
    if (!timeString) return '';
    // If it's already in HH:MM format or shorter, return as is
    if (timeString.length <= 5) return timeString;
    // Extract HH:MM from HH:MM:SS
    return timeString.substring(0, 5);
  };

  // Reset edit data when ticket changes
  useEffect(() => {
    if (ticket) {
      setEditData({
        action_taken: ticket.action_taken || '',
        final_resolution: ticket.final_resolution || '',
        status: toUiStatus(ticket.status || 'Open'),
        parts_replaced: ticket.parts_replaced || '',
        new_parts_serial: ticket.new_parts_serial || '',
        old_parts_serial: ticket.old_parts_serial || '',
        date_ack: ticket.date_ack || '',
        time_ack: formatTimeField(ticket.time_ack),
        date_attended: ticket.date_attended || '',
        store_arrival: ticket.store_arrival || '',
        work_start: ticket.work_start || '',
        work_end: ticket.work_end || '',
        date_resolved: ticket.date_resolved || '',
        time_resolved: formatTimeField(ticket.time_resolved),
        sla_status: ticket.sla_status || '',
        downtime: ticket.downtime || '',
        date_responded: ticket.date_responded || '',
        time_responded: formatTimeField(ticket.time_responded),
        pause_time_start: ticket.pause_time_start || '',
        pause_time_end: ticket.pause_time_end || '',
        kb_id: ticket.kb_id || '',
      });
    }
  }, [ticket]);

  // Helper function to show toast
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, description, onClose: removeToast }]);
  };

  // Helper function to remove toast
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  if (!isOpen || !ticket) return null;

  // Permission checks using the usePermissions hook
  const canEdit = hasPermission('manage_tickets'); // All users with manage_tickets can edit
  const canDelete = hasPermission('delete_tickets');

  // Debug logging
  console.log('TicketDetailModal - Render:', {
    hasManageTicketsPermission: hasPermission('manage_tickets'),
    userPosition,
    canEdit,
    canDelete,
    isEditMode
  });

  // Get signed URL for attachment (for private buckets)
  const getAttachmentUrl = async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(filePath, 3600); // URL valid for 1 hour

    if (error) {
      console.error('Error creating signed URL:', error);
      return '';
    }

    return data.signedUrl;
  };

  // Show delete confirmation modal
  const showDeleteConfirmation = (attachment: TicketAttachment) => {
    setAttachmentToDelete(attachment);
    setShowDeleteConfirm(true);
  };

  // Mark attachment for deletion (will be deleted on save)
  const handleMarkForDeletion = () => {
    if (!attachmentToDelete) return;

    // Add to deletion list
    setAttachmentsToDelete(prev => [...prev, attachmentToDelete.id]);

    // Close modal
    setShowDeleteConfirm(false);
    setAttachmentToDelete(null);
  };

  // Handle adding new attachments (stored as pending until save)
  const handleUploadAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Calculate total after adding new files
    const currentTotal = attachments.length - attachmentsToDelete.length + pendingAttachments.length;
    if (currentTotal + files.length > 10) {
      showToast('error', 'Too Many Attachments', `You can only have up to 10 attachments per ticket. Current total: ${currentTotal}`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        showToast('error', 'Invalid File Type', `${file.name} is not an image file`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File Too Large', `${file.name} is too large. Maximum size is 5MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Create preview URLs
    const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));

    // Add to pending state
    setPendingAttachments(prev => [...prev, ...validFiles]);
    setPendingPreviewUrls(prev => [...prev, ...newPreviewUrls]);

    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  // Remove pending attachment before save
  const handleRemovePendingAttachment = (index: number) => {
    // Revoke preview URL
    URL.revokeObjectURL(pendingPreviewUrls[index]);

    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    setPendingPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Handle ticket deletion
  const handleDeleteTicket = async () => {
    if (!ticket || !user?.id) return;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/tickets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticket.id })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete ticket');
      }

      showToast('success', 'Ticket Deleted', 'The ticket has been permanently deleted.');
      setShowDeleteTicketConfirm(false);

      // Close modal and notify parent to refresh list
      setTimeout(() => {
        onClose();
        if (onUpdate) {
          // Trigger refresh by passing null or similar signal
          window.location.reload(); // Or use a better refresh mechanism
        }
      }, 1000);

    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      showToast('error', 'Delete Failed', error.message || 'Failed to delete ticket');
      setShowDeleteTicketConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

      const handleSave = async () => {
      if (!ticket || !user?.id) return;
  
      setIsSaving(true);
  
      // Validate that Date Resolved is not before Date Reported
      if (editData.date_resolved) {
        const dateReported = ticket.date_reported;
        const timeReported = ticket.time_reported;
        const dateResolved = editData.date_resolved;
        const timeResolved = editData.time_resolved;
  
        if (dateReported && timeReported && dateResolved && timeResolved) {
          const reportedDate = new Date(dateReported);
          const [reportedHours, reportedMinutes] = timeReported.split(':');
          reportedDate.setHours(parseInt(reportedHours), parseInt(reportedMinutes), 0, 0);
  
          const resolvedDate = new Date(dateResolved);
          const [resolvedHours, resolvedMinutes] = timeResolved.split(':');
          resolvedDate.setHours(parseInt(resolvedHours), parseInt(resolvedMinutes), 0, 0);
  
          if (resolvedDate < reportedDate) {
            showToast('error', 'Invalid Date', 'Date Resolved cannot be earlier than Date Reported.');
            setIsSaving(false);
            return;
          }
        }
      }
  
      try {      // 1. Sanitize date fields - convert empty strings to null
      const sanitizedData = Object.entries(editData).reduce((acc, [key, value]) => {
        // Convert empty strings to null for all fields
        acc[key] = value === '' ? null : value;
        return acc;
      }, {} as Record<string, any>);

      // 2. Update ticket fields
      const response = await fetch('/api/tickets/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ticket.id,
          ...sanitizedData,
          status: toDbStatus(editData.status || 'Open')
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update ticket');
      }

      // 2. Delete marked attachments
      for (const attachmentId of attachmentsToDelete) {
        const attachment = attachments.find(a => a.id === attachmentId);
        if (!attachment) continue;

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('ticket-attachments')
          .remove([attachment.file_path]);

        if (storageError) {
          console.error('Error deleting from storage:', storageError);
          continue;
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from('ticket_attachments')
          .delete()
          .eq('id', attachmentId);

        if (dbError) {
          console.error('Error deleting from database:', dbError);
        }
      }

      // 3. Upload pending attachments
      for (const [index, file] of pendingAttachments.entries()) {
        const currentCount = attachments.length - attachmentsToDelete.length + index;
        const fileExt = file.name.split('.').pop();
        const fileName = `image-${currentCount + 1}.${fileExt}`;
        const filePath = `${ticket.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        // Create database record
        const { error: dbError } = await supabase
          .from('ticket_attachments')
          .insert({
            ticket_id: ticket.id,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (dbError) {
          console.error('Error saving attachment record:', dbError);
          await supabase.storage.from('ticket-attachments').remove([filePath]);
        }
      }

      // Clean up pending previews
      pendingPreviewUrls.forEach(url => URL.revokeObjectURL(url));

      // Clear pending state
      setAttachmentsToDelete([]);
      setPendingAttachments([]);
      setPendingPreviewUrls([]);

      if (onUpdate && data.ticket) {
        onUpdate(data.ticket);
      }

      setIsEditMode(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      showToast('error', 'Update Failed', error.message || 'Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);

    // Reset edit data
    if (ticket) {
      setEditData({
        action_taken: ticket.action_taken || '',
        final_resolution: ticket.final_resolution || '',
        status: toUiStatus(ticket.status || 'Open'),
        parts_replaced: ticket.parts_replaced || '',
        new_parts_serial: ticket.new_parts_serial || '',
        old_parts_serial: ticket.old_parts_serial || '',
        date_ack: ticket.date_ack || '',
        time_ack: ticket.time_ack || '',
        date_attended: ticket.date_attended || '',
        store_arrival: ticket.store_arrival || '',
        work_start: ticket.work_start || '',
        work_end: ticket.work_end || '',
        date_resolved: ticket.date_resolved || '',
        time_resolved: ticket.time_resolved || '',
        sla_status: ticket.sla_status || '',
        downtime: ticket.downtime || '',
        date_responded: ticket.date_responded || '',
        time_responded: ticket.time_responded || '',
        pause_time_start: ticket.pause_time_start || '',
        pause_time_end: ticket.pause_time_end || '',
        kb_id: ticket.kb_id || '',
      });
    }

    // Clear attachment changes
    setAttachmentsToDelete([]);
    pendingPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setPendingAttachments([]);
    setPendingPreviewUrls([]);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) { // Check if date is invalid
        return 'N/A';
      }
      return format(date, 'MMM dd, yyyy');
    } catch (e) {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase().replace(/_/g, ' ');
    switch (s) {
      case 'open':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in progress':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'on hold':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'closed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'sev3':
        return 'text-red-400';
      case 'sev2':
        return 'text-yellow-400';
      case 'sev1':
        return 'text-blue-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between p-4 sm:p-6 gap-4 sm:gap-0 border-b border-slate-800 bg-slate-900 sticky top-0 rounded-t-xl sm:rounded-t-2xl z-10">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {isEditMode ? (
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    disabled={isSaving}
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${getStatusColor(editData.status || 'Open')} uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {editData.status || 'Open'}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isStatusDropdownOpen && !isSaving && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden ring-1 ring-slate-800 animate-in fade-in zoom-in-95 duration-100">
                      {['Open', 'In Progress', 'On Hold', 'Closed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setEditData({ ...editData, status });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-semibold uppercase hover:bg-slate-800 transition-all border-b border-slate-800 last:border-0 flex items-center gap-3 ${
                            status === editData.status ? 'bg-slate-800/50 text-white' : 'text-slate-400'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                             status === 'Open' ? 'bg-blue-500 shadow-blue-500/50' :
                             status === 'In Progress' ? 'bg-yellow-500 shadow-yellow-500/50' :
                             status === 'On Hold' ? 'bg-orange-500 shadow-orange-500/50' :
                             'bg-green-500 shadow-green-500/50'
                          }`} />
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(ticket.status)} uppercase`}>
                  {toUiStatus(ticket.status)}
                </span>
              )}
              <span className={`flex items-center gap-1.5 text-sm font-medium ${getSeverityColor(ticket.sev)}`}>
                <AlertTriangle size={14} />
                {ticket.sev} Priority
              </span>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3 flex-wrap">
              {ticket.request_type}
              <span className="text-slate-500 text-base sm:text-lg font-normal">#{ticket.rcc_reference_number}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end">
            {canEdit && !isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Edit2 size={16} />
                Edit
              </button>
            )}
            {canDelete && !isEditMode && (
              <button
                onClick={() => setShowDeleteTicketConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          
          <DetailSection title="General Information" icon={FileText}>
            <LabelValue label="RCC Reference" value={ticket.rcc_reference_number} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Date Reported" value={formatDate(ticket.date_reported)} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Time Reported" value={ticket.time_reported} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Problem Category" value={ticket.problem_category} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Device" value={ticket.device} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Request Detail" value={ticket.request_detail} fullWidth isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />

            {/* KB Article Dropdown */}
            <div className="col-span-full">
              <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">
                Related KB Article <span className="text-slate-600 text-xs normal-case">(Optional)</span>
              </span>
              {isEditMode ? (
                <select
                  disabled={isSaving}
                  value={editData.kb_id || ''}
                  onChange={(e) => setEditData({ ...editData, kb_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">No KB article selected</option>
                  {kbArticles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.kb_code} - {article.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-slate-300 font-medium break-words">
                  {ticket.kb_id ? (
                    (() => {
                      const linkedArticle = kbArticles.find(a => a.id === ticket.kb_id);

                      // If article not found (soft-deleted), show N/A
                      if (!linkedArticle) {
                        return <span className="text-slate-600 italic">N/A</span>;
                      }

                      return (
                        <button
                          onClick={() => window.open(`/dashboard/knowledge-base/${ticket.kb_id}`, '_blank')}
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline transition-colors cursor-pointer group"
                        >
                          <span>{linkedArticle.kb_code} - {linkedArticle.title}</span>
                          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })()
                  ) : (
                    <span className="text-slate-600 italic">N/A</span>
                  )}
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection title="Location & Contact" icon={MapPin}>
            <LabelValue label="Store Name" value={ticket.stores?.store_name} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Store Code" value={ticket.stores?.store_code} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Station" value={ticket.stations?.name} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Manager on Duty (MOD)" value={ticket.manager_on_duty?.manager_name} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
          </DetailSection>

          <DetailSection title="People Involved" icon={User}>
            <LabelValue label="Reported By" value={ticket.reported_by_user ? `${ticket.reported_by_user.first_name} ${ticket.reported_by_user.last_name}` : ticket.reported_by} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Serviced By" value={ticket.serviced_by_user ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}` : ticket.serviced_by} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
          </DetailSection>

          <DetailSection title="Resolution & Action" icon={CheckCircle}>
            <LabelValue
              label="Action Taken"
              value={ticket.action_taken}
              fullWidth
              editable
              editKey="action_taken"
              isTextarea
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Final Resolution"
              value={ticket.final_resolution}
              fullWidth
              editable
              editKey="final_resolution"
              isTextarea
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Date Resolved"
              value={formatDate(ticket.date_resolved)}
              editable
              editKey="date_resolved"
              type="date"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Time Resolved"
              value={ticket.time_resolved}
              editable
              editKey="time_resolved"
              type="time"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue label="SLA Status" value={ticket.sla_status} editable editKey="sla_status" isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
          </DetailSection>

          <DetailSection title="Timeline & Metrics" icon={Timer}>
            <LabelValue
              label="Date Acknowledged"
              value={formatDate(ticket.date_ack)}
              editable
              editKey="date_ack"
              type="date"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Time Acknowledged"
              value={getTimestampTime(ticket.time_ack)}
              editable
              editKey="time_ack"
              type="time"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Date Attended"
              value={formatDate(ticket.date_attended)}
              editable
              editKey="date_attended"
              type="date"
              isEditMode={isEditMode}
              editData={editData}
              setEditData={(newData) => {
                // Check if date_attended changed
                if (newData.date_attended !== editData.date_attended) {
                    // Update dependent fields in editData to ensure they are sent to API
                    // even if they weren't explicitly touched in this edit session
                   ['work_end', 'pause_time_start', 'pause_time_end'].forEach(field => {
                       const currentVal = (editData[field as keyof Ticket] as string) || (ticket[field as keyof Ticket] as string);
                       if (currentVal) {
                           (newData as any)[field] = currentVal.substring(0, 5);
                       }
                   });
                }
                setEditData(newData);
              }}
              isSaving={isSaving}
            />
            <LabelValue
              label="Store Arrival"
              value={getTimestampTime(ticket.store_arrival)}
              editable
              editKey="store_arrival"
              type="time"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Work Start"
              value={getTimestampTime(ticket.work_start)}
              editable
              editKey="work_start"
              type="time"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Work End"
              value={getTimestampTime(ticket.work_end)}
              editable
              editKey="work_end"
              type="time"
              dateAttended={ticket.date_attended}
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Pause Start"
              value={getTimestampTime(ticket.pause_time_start)}
              editable
              editKey="pause_time_start"
              type="time"
              dateAttended={ticket.date_attended}
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Pause End"
              value={getTimestampTime(ticket.pause_time_end)}
              editable
              editKey="pause_time_end"
              type="time"
              dateAttended={ticket.date_attended}
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue label="Downtime" value={ticket.downtime} editable editKey="downtime" isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="SLA Count (Hrs)" value={ticket.sla_count_hrs?.toString()} isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Date Responded" value={formatDate(ticket.date_responded)} editable editKey="date_responded" type="date" isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
            <LabelValue label="Time Responded" value={getTimestampTime(ticket.time_responded)} editable editKey="time_responded" type="time" isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving} />
          </DetailSection>

           <DetailSection title="Parts Information" icon={Box}>
            <LabelValue
              label="Parts Replaced"
              value={ticket.parts_replaced}
              editable
              editKey="parts_replaced"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="New Parts Serial"
              value={ticket.new_parts_serial}
              editable
              editKey="new_parts_serial"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
            <LabelValue
              label="Old Parts Serial"
              value={ticket.old_parts_serial}
              editable
              editKey="old_parts_serial"
              isEditMode={isEditMode} editData={editData} setEditData={setEditData} isSaving={isSaving}
            />
          </DetailSection>

          {/* Attachments Section */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-blue-400" />
                <h3 className="font-semibold text-slate-200">
                  Attachments ({attachments.length - attachmentsToDelete.length + pendingAttachments.length}/10)
                </h3>
              </div>
              {canEdit && isEditMode && attachments.length < 10 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadAttachments}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImages}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImages ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Add Images</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            {(attachments.length - attachmentsToDelete.length + pendingAttachments.length) > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Existing attachments (not marked for deletion) */}
                {attachments
                  .filter(attachment => !attachmentsToDelete.includes(attachment.id))
                  .map((attachment) => {
                    const imageUrl = attachmentUrls[attachment.id];
                    const isMarkedForDeletion = attachmentsToDelete.includes(attachment.id);
                    return (
                      <div key={attachment.id} className={`relative group ${isMarkedForDeletion ? 'opacity-50' : ''}`}>
                        <button
                          onClick={() => imageUrl && setSelectedImage(imageUrl)}
                          className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-slate-700 hover:border-blue-500 transition-all cursor-pointer group-hover:scale-105"
                          disabled={!imageUrl}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={attachment.file_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </button>
                        {canEdit && isEditMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showDeleteConfirmation(attachment);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                            title="Delete image"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs text-white truncate">
                            {attachment.file_name}
                          </p>
                          <p className="text-xs text-slate-300">
                            {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    );
                  })}

                {/* Pending attachments (not yet uploaded) */}
                {pendingAttachments.map((file, index) => (
                  <div key={`pending-${index}`} className="relative group">
                    <button
                      onClick={() => setSelectedImage(pendingPreviewUrls[index])}
                      className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-yellow-500/50 hover:border-yellow-500 transition-all cursor-pointer group-hover:scale-105"
                    >
                      <img
                        src={pendingPreviewUrls[index]}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Pending badge */}
                      <div className="absolute top-2 left-2 bg-yellow-500/90 text-black text-xs px-2 py-0.5 rounded-md font-medium">
                        Pending
                      </div>
                    </button>
                    {canEdit && isEditMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePendingAttachment(index);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                        title="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-300">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                <p>No attachments</p>
                {canEdit && (
                  <p className="text-sm mt-1">
                    {isEditMode ? 'Click "Add Images" to upload' : 'Click "Edit" to add images'}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-xl sm:rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-3">
          {isEditMode ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle size={18} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl transform transition-all scale-100 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white text-center">Update Successful</h3>
            <p className="text-slate-400 text-center">The ticket has been updated successfully.</p>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                onClose();
              }}
              className="mt-2 w-full px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors z-10"
          >
            <X size={24} />
          </button>
          <div className="relative max-w-7xl max-h-full">
            <img
              src={selectedImage}
              alt="Full size attachment"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && attachmentToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 sm:p-6 md:p-8 shadow-2xl transform transition-all scale-100 flex flex-col items-center gap-3 sm:gap-4 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={28} className="text-red-500 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white text-center">Mark for Deletion?</h3>
            <p className="text-sm sm:text-base text-slate-400 text-center leading-relaxed">
              Mark <span className="text-white font-medium break-all">"{attachmentToDelete.file_name}"</span> for deletion?
              <span className="block mt-1 text-slate-500 text-xs sm:text-sm">
                It will be permanently deleted when you click "Save Changes".
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full mt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setAttachmentToDelete(null);
                }}
                className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg transition-all font-medium text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkForDeletion}
                className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="whitespace-nowrap">Mark for Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ticket Confirmation Modal */}
      {showDeleteTicketConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6 shadow-2xl transform transition-all scale-100 flex flex-col items-center gap-3 max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={24} className="text-red-500 sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white text-center">Delete Ticket?</h3>
            <p className="text-xs sm:text-sm text-slate-400 text-center leading-relaxed">
              Are you sure you want to permanently delete ticket <span className="text-white font-medium">#{ticket?.rcc_reference_number}</span>?
              <span className="block mt-2 text-red-400 font-medium text-xs sm:text-sm">
                This action cannot be undone.
              </span>
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full mt-1">
              <button
                onClick={() => setShowDeleteTicketConfirm(false)}
                disabled={isDeleting}
                className="w-full sm:flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-md transition-all font-medium text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTicket}
                disabled={isDeleting}
                className="w-full sm:flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-md transition-all font-medium flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} className="sm:w-4 sm:h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default TicketDetailModal;


