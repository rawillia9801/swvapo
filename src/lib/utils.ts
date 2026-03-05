import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://iywgzsmnxbptititowtp.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5d2d6c21ueGJwdGl0aXRvd3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTMyNTQsImV4cCI6MjA3OTU4OTI1NH0.KIv0nzANGw1JsIW9n13dCrywJtHc5KnQJzKfs2kT7w0";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const T = {
  applications: "puppy_applications",
  puppies: "puppies",
  buyers: "buyers",
  messages: "portal_messages"
};

export const OPTIONAL = { puppy_events: "puppy_events" };

export function fmtMoney(n: any) { 
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0)); 
}

export function fmtDate(d: any) {
  if(!d) return "";
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

export function pick(o: any, keys: string[]) {
  for(const k of keys) {
    if(o && o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "") return o[k];
  }
  return null;
}

export function buildPuppyPhotoUrl(path: string) {
  if(!path) return "";
  if(path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/puppy-images/${encodeURIComponent(path)}`;
}