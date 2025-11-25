import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  
   new Error('Missing Supabase URL or anon key');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, latitude, longitude, address } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check if user already clocked in today
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .is('time_out', null)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingAttendance) {
      return res.status(400).json({
        error: 'Already clocked in',
        attendance: existingAttendance
      });
    }

    // Create new attendance record
    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .insert({
        user_id: userId,
        date: today,
        time_in: now.toISOString(),
        clock_in_lat: latitude || null,
        clock_in_lng: longitude || null,
        clock_in_address: address || null,
        is_overtime_requested: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      message: 'Clocked in successfully',
      attendance
    });

  } catch (error: any) {
    console.error('Clock-in error:', error);

    // Handle specific database errors
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(400).json({
        error: 'You have already clocked in today'
      });
    }

    // Generic error
    return res.status(500).json({
      error: 'Failed to clock in. Please try again.'
    });
  }
}
