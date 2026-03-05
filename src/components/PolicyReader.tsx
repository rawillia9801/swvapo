'use client'; // This tells the React Compiler to make this part interactive

import { useState } from 'react';

export default function PolicyReader({ policies }: { policies: any[] }) {
  // We start by showing the first policy in your list
  const [activePolicy, setActivePolicy] = useState(policies[0]);

  return (
    <div className="flex flex-col md:flex-row min-h-[600px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      
      {/* Sidebar - The Policy List */}
      <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Business Policies</h2>
        <nav className="space-y-2">
          {policies.map((policy) => (
            <button
              key={policy.id}
              onClick={() => setActivePolicy(policy)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePolicy?.id === policy.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {policy.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Pane - The Reading Area */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
        {activePolicy ? (
          <article className="max-w-2xl">
            <h1 className="text-3xl font-black text-slate-900 mb-6">{activePolicy.title}</h1>
            <div className="prose prose-blue text-slate-700 leading-relaxed whitespace-pre-wrap">
              {activePolicy.content}
            </div>
          </article>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 italic">
            Select a policy to view details
          </div>
        )}
      </div>
    </div>
  );
}