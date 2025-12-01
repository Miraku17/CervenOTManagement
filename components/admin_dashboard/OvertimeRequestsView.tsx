import React from 'react';

const OvertimeRequestsView: React.FC = () => {
  return (
    <div className="p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-800">
      <h2 className="text-3xl font-bold text-white mb-6">Overtime Requests</h2>
      <p className="text-slate-400">
        This section will display a list of all submitted overtime requests.
      </p>
      {/* Placeholder for future overtime requests table/list */}
      <div className="mt-8 p-4 bg-slate-800 rounded-md text-slate-300">
        <p>No overtime requests to display yet.</p>
        <p className="text-sm mt-2">Future: Filter, sort, and approve/reject requests here.</p>
      </div>
    </div>
  );
};

export default OvertimeRequestsView;
