'use client';

import { useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import AddTicketModal from '@/components/ticketing/AddTicketModal';

export default function TicketsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = () => {
    // Refresh tickets list or show success message
    console.log('Ticket created successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets Management</h1>
          <p className="text-slate-400">Manage and track all support tickets.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={20} />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Tickets list will be added here */}
      <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
        <Ticket size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-300">No tickets yet</h3>
        <p className="text-slate-500 mt-1">Create your first ticket to get started.</p>
      </div>

      <AddTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
