import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bxekgxacfjnybfidriyd.supabase.co'
const supabaseAnonKey = 'sb_publishable_-JUQvYzSz-TaBt6EC9pFAA_oYF8phbW'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
