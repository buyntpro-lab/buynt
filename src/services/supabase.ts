import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sxzpfndudjgpgwhafwlq.supabase.co';
const supabaseAnonKey = 'sb_publishable_NS1lJsdGAQedKjwNBToE9A_B61urQ3s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
