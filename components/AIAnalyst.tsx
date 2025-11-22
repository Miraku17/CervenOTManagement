import React, { useState } from 'react';
import { WorkLog } from '../types';
import { generateTimesheetAnalysis } from '../services/geminiService';
import { Sparkles, BrainCircuit, Loader2 } from 'lucide-react';

interface AIAnalystProps {
  logs: WorkLog[];
}

export const AIAnalyst: React.FC<AIAnalystProps> = ({ logs }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const result = await generateTimesheetAnalysis(logs);
    setAnalysis(result);
    setLoading(false);
  };

  const completedLogs = logs.filter(l => l.status === 'COMPLETED');

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                Gemini Productivity Insights
            </h3>
            {completedLogs.length > 0 && (
                <button 
                    onClick={handleAnalyze} 
                    disabled={loading}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-indigo-900/20"
                >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {loading ? 'Analyzing...' : 'Analyze Pattern'}
                </button>
            )}
        </div>

        <div className="relative z-10 min-h-[80px] flex items-center">
            {analysis ? (
                <div className="bg-indigo-950/50 border border-indigo-500/20 rounded-xl p-4 w-full animate-fadeIn">
                    <p className="text-indigo-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {analysis}
                    </p>
                </div>
            ) : (
                <div className="w-full text-center py-4 border-2 border-dashed border-slate-700 rounded-xl">
                    <p className="text-slate-500 text-sm">
                        {completedLogs.length > 0 
                            ? "Generate an AI summary of your recent work habits." 
                            : "Clock in some hours to unlock AI insights."}
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};