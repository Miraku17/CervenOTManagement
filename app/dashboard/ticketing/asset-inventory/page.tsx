'use client';

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Monitor, Laptop, Server, AlertTriangle, Tag } from 'lucide-react';

export default function AssetInventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Inventory</h1>
          <p className="text-slate-400">Manage company assets, equipment, and hardware.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            <button
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} />
              <span>Add Asset</span>
            </button>
            <button
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
              >
                <Download size={20} />
                <span>Export</span>
              </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
            type="text"
            placeholder="Search asset tag, serial number, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
        </div>
        <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl hover:border-slate-600 transition-colors">
                <Filter size={18} />
                <span>Status</span>
            </button>
             <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl hover:border-slate-600 transition-colors">
                <Monitor size={18} />
                <span>Type</span>
            </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Total Assets</p>
                      <h3 className="text-2xl font-bold text-white">342</h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Server size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Assigned Assets</p>
                      <h3 className="text-2xl font-bold text-white">285</h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Tag size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Maintenance Due</p>
                      <h3 className="text-2xl font-bold text-white">8</h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                      <AlertTriangle size={24} />
                  </div>
              </div>
          </div>
      </div>

      {/* Inventory Table Placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Asset Name</th>
                        <th className="p-4 font-semibold">Asset Tag</th>
                        <th className="p-4 font-semibold">Serial Number</th>
                        <th className="p-4 font-semibold">Type</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold">Assigned To</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {/* Placeholder Rows */}
                    {[1, 2, 3, 4, 5].map((item) => (
                        <tr key={item} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="p-4 text-slate-300 font-medium">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                                        {item % 2 === 0 ? <Laptop size={20} /> : <Monitor size={20} />}
                                    </div>
                                    <div>
                                        <div>MacBook Pro M{item}</div>
                                        <div className="text-xs text-slate-500">Purchased: 2024</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-sm">AST-2024-{item}00{item}</td>
                            <td className="p-4 text-slate-500 font-mono text-xs">SN78234{item}99X</td>
                            <td className="p-4 text-slate-400">
                                {item % 2 === 0 ? 'Laptop' : 'Monitor'}
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs border ${
                                    item === 3 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                    {item === 3 ? 'Maintenance' : 'Deployed'}
                                </span>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">
                                {item === 3 ? 'IT Department' : 'John Doe'}
                            </td>
                            <td className="p-4 text-right">
                                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">View</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
         <div className="p-4 border-t border-slate-800 flex justify-center">
            <button className="text-slate-500 hover:text-white text-sm transition-colors">View All Assets</button>
         </div>
      </div>
    </div>
  );
}
