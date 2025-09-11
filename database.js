const supabaseUrl = 'https://tevtrhkabycoddnwssar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRyaGthYnljb2Rkbndzc2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTg3NTMsImV4cCI6MjA3MjM3NDc1M30.icqgrtyNhBKoHXk5RP4EzElG_4EMUKI3YihdUblr4w4';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      
    autoRefreshToken: true,    
    detectSessionInUrl: true,  
  },
});