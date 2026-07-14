import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ouddccqhzjzsgjevbkrj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGRjY3Foemp6c2dqZXZia3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDAyNzQsImV4cCI6MjA5OTUxNjI3NH0.F8XHA3bYBXT8lIACWCDn577V2PqPV8x0ipicTZMmyEE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
