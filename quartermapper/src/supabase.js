import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hrufrodmeqrsaxnjnira.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWZyb2RtZXFyc2F4bmpuaXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MTQ5NDEsImV4cCI6MjA5MTE5MDk0MX0.Ko9v-HgDoMh-5a0_3sOI-RjZqVHhHJpxtOMUmWr2VSI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
