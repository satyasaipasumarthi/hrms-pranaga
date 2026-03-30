import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xxloktwsvxgrjatmnvdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_VYq3PYoYKKhUpSY_pXim0Q_bohfTiPX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
