import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/** Validate a JWT and return the user + profile */
export async function validateToken(jwt: string) {
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  return { userId: user.id, username: profile?.username ?? 'Unknown' };
}
