import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://koagashnqnjbpetddbor.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYWdhc2hucW5qYnBldGRkYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzAyNTQsImV4cCI6MjA4MjgwNjI1NH0.tcH0_pvoxjBX9h_piYHX-oMwLQgFSuWUE8gHoTLpCGI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

