// database.js

// The global 'supabase' object from the CDN is available here.
const supabaseUrl = 'https://tevtrhkabycoddnwssar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRyaGthYnljb2Rkbndzc2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTg3NTMsImV4cCI6MjA3MjM3NDc1M30.icqgrtyNhBKoHXk5RP4EzElG_4EMUKI3YihdUblr4w4';

// Create the client and assign it to a new variable name
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);