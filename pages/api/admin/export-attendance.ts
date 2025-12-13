import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { startDate, endDate, userId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }

  try {
    let attendanceData: any[] | null = null;
    let error: any = null;

    // First, try to get data from attendance_daily_summary
    let summaryQuery = supabase
      .from('attendance_daily_summary')
      .select('*, profiles(first_name, last_name, email)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (userId) {
      summaryQuery = summaryQuery.eq('user_id', userId);
    }

    const { data: summaryData, error: summaryError } = await summaryQuery;

    // If summary data exists and has records, use it
    if (!summaryError && summaryData && summaryData.length > 0) {
      attendanceData = summaryData;
    } else {
      // Fallback to attendance table
      let query = supabase
        .from('attendance')
        .select('*, profiles(first_name, last_name, email)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: rawData, error: rawError } = await query;
      attendanceData = rawData;
      error = rawError;

      if (error) throw error;
    }

    // Get attendance IDs to fetch overtime requests
    const attendanceIds = attendanceData?.map(a => a.id) || [];

    // Fetch overtime requests for these attendance records
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('attendance_id, comment, status, approved_hours, reviewer, requested_at, approved_at')
      .in('attendance_id', attendanceIds);

    // Fetch reviewer profiles if any
    const reviewerIds = overtimeData?.filter(ot => ot.reviewer).map(ot => ot.reviewer) || [];
    let reviewersMap = new Map();
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', reviewerIds);
      reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
    }

    // Create overtime map
    const overtimeMap = new Map(
      overtimeData?.map(ot => [
        ot.attendance_id,
        {
          comment: ot.comment,
          status: ot.status,
          approved_hours: ot.approved_hours,
          requested_at: ot.requested_at,
          approved_at: ot.approved_at,
          reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null
        }
      ]) || []
    );

    // Process attendance data with lunch deduction and overtime calculation
    const data = attendanceData?.map(record => {
      let totalHours = 0;

      // Check if data is from attendance_daily_summary (has total_minutes_final or total_minutes_raw)
      if (record.total_minutes_final !== undefined) {
        totalHours = record.total_minutes_final / 60; // Convert minutes to hours
      } else if (record.total_minutes_raw !== undefined) {
        totalHours = record.total_minutes_raw / 60; // Convert minutes to hours
      } else if (record.time_in && record.time_out) {
        // Calculate from time_in and time_out for regular attendance table
        const timeIn = new Date(record.time_in);
        const timeOut = new Date(record.time_out);
        const diffMs = timeOut.getTime() - timeIn.getTime();
        totalHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
      }

      // Round to 2 decimal places
      totalHours = Math.round(totalHours * 100) / 100;

      // Deduct 1 hour for lunch if worked more than 5 hours
      let effectiveHours = totalHours > 5 ? totalHours - 1 : totalHours;
      effectiveHours = Math.round(effectiveHours * 100) / 100;

      // Calculate regular and overtime hours (assuming 8 hours is standard workday)
      const standardHours = 8;
      let regularHours = Math.min(effectiveHours, standardHours);
      let overtimeHours = Math.max(0, effectiveHours - standardHours);

      regularHours = Math.round(regularHours * 100) / 100;
      overtimeHours = Math.round(overtimeHours * 100) / 100;

      return {
        ...record,
        total_hours_raw: totalHours, // Original hours before lunch deduction
        lunch_deduction: totalHours > 5 ? 1 : 0,
        total_hours: effectiveHours, // Hours after lunch deduction
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        overtimeRequest: overtimeMap.get(record.id) || null
      };
    });

    return res.status(200).json({ data });

  } catch (error: any) {
    console.error('Export attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance records'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
