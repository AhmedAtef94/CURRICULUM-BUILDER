import { createClient } from '@supabase/supabase-js';

// Same Supabase backend as the original app.
export const SUPABASE_URL = 'https://cvcoqcfpqdndqohjiude.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_6y2RxSoqXf6LQd2QkSlepQ_V1uedc4l';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
