import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { differenceInDays, parseISO } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, type, startDate, endDate, reason } = req.body;

  if (!userId || !type || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // 1. Calculate duration
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const duration = differenceInDays(end, start) + 1;

    if (duration <= 0) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    // 2. Check Leave Credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('leave_credits')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile.');
    }

    const currentCredits = profile.leave_credits || 0;
    if (currentCredits < duration) {
      return res.status(400).json({ 
        error: `Insufficient leave credits. You have ${currentCredits} credits but requested ${duration} days.` 
      });
    }

    // 3. Check for Overlapping Approved Requests
    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    const { data: overlappingRequests, error: overlapError } = await supabaseAdmin
      .from('leave_requests')
      .select('id')
      .eq('employee_id', userId)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (overlapError) {
      throw new Error('Failed to check overlapping requests.');
    }

    if (overlappingRequests && overlappingRequests.length > 0) {
      return res.status(400).json({ 
        error: 'You already have an approved leave request that overlaps with these dates.' 
      });
    }

    // 4. Insert Request
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        employee_id: userId,
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ message: 'Leave request submitted successfully', data });
  } catch (error: any) {
    console.error('Error creating leave request:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit leave request.' });
  }
}