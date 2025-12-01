import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Service Role) for admin-level access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Fallback for safety in case env vars are missing
const supabase = createClient(supabaseUrl, supabaseServiceKey || 'placeholder');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure only GET requests are handled for fetching
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // --- Data Fetching ---
    // We verify the relationship using the specific foreign key constraint to avoid ambiguity
    // (since both 'requested_by' and 'approved_by' point to 'profiles')
    const { data, error } = await supabase
      .from('overtime')
      .select(`
        *,
        requested_by:profiles!overtime_requests_requested_by_fkey (first_name, last_name, email),
        reviewer:profiles!reviewer (first_name, last_name, email),
        attendance (date, total_minutes)
      `)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Supabase query error details:', error);
      // Return the specific error from Supabase to help debugging
      return res.status(500).json({ message: 'Database query failed', error: error.message, details: error });
    }

    return res.status(200).json({ data });

  } catch (error: any) {
    console.error('API Error fetching overtime requests:', error.message);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
