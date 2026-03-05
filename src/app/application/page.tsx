"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Initialization
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ApplicationPage() {
  const [userId, setUserId] = useState<string | null>(null);

  // Check if the user happens to be logged in to the portal
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    getUser();
  }, []);

  // IMPORTANT: Replace this string with your actual Zoho Form permalink URL
  const baseUrl = "https://forms.zohopublic.com/southwestvirginiachihuahua/form/PuppyApplication/formperma/MxCOxyG77E3yShC2GCnwbjiMu1z3vqR8Gql1nug9gTY";
  
  // If they are logged in, append their ID silently to the URL. If not, just load the normal form.
  const formUrl = userId ? `${baseUrl}?user_id=${userId}` : baseUrl;

  return (
    <main className="bg-stone-50 min-h-screen py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/70 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-orange-800 uppercase tracking-wide shadow-sm mb-6">
            Take the next step
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-slate-900 mb-4">
            Puppy Application
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Please fill out the form below to begin the process. We review every application personally to ensure the best lifelong matches.
          </p>
        </div>
        
        {/* Embedded Zoho Form */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden p-2 sm:p-4 animate-fade-in-up">
          {/* We set a tall height so the user doesn't have to double-scroll */}
          <iframe 
            src={formUrl} 
            className="w-full h-[1000px] border-0 rounded-2xl"
            title="Southwest Virginia Chihuahua Application"
          />
        </div>

      </div>
    </main>
  );
}