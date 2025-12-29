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
    // Check if user has required position
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', req.user?.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;
    const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer', 'Help Desk Lead', 'Operations Technical Lead'];

    if (!allowedPositions.includes(userPosition)) {
      return res.status(403).json({
        error: 'Forbidden: Only Operations Manager, Technical Support Lead, Technical Support Engineer, Help Desk Lead, and Operations Technical Lead can export reports'
      });
    }
  } catch (error: any) {
    console.error('Error checking user position:', error);
    return res.status(500).json({ error: 'Failed to verify user permissions' });
  }

  try {
    let attendanceData: any[] | null = null;
    let error: any = null;

    // First, try to get data from attendance_daily_summary
    let summaryQuery = supabase
      .from('attendance_daily_summary')
      .select('*, profiles(first_name, last_name, email, employee_id, position_id, positions(name))')
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
        .select('*, profiles(first_name, last_name, email, employee_id, position_id, positions(name))')
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

    // Fetch overtime requests from overtime_v2 table
    // Get unique user IDs from attendance data
    const userIds = [...new Set(attendanceData?.map(a => a.user_id) || [])];

    // Fetch overtime_v2 requests for the date range
    let allOvertimeV2Data: any[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const { data: batchData, error: batchError } = await supabase
        .from('overtime_v2')
        .select('*')
        .in('requested_by', batch)
        .gte('overtime_date', startDate)
        .lte('overtime_date', endDate);

      if (batchError) {
        console.error('Overtime_v2 fetch error for batch:', batchError);
      } else if (batchData) {
        allOvertimeV2Data = allOvertimeV2Data.concat(batchData);
      }
    }

    console.log('User IDs count:', userIds.length);
    console.log('Overtime_v2 records fetched:', allOvertimeV2Data?.length || 0);

    // Fetch reviewer profiles for level1 and level2 reviewers
    const reviewerIds = [
      ...allOvertimeV2Data.filter(ot => ot.level1_reviewer).map(ot => ot.level1_reviewer),
      ...allOvertimeV2Data.filter(ot => ot.level2_reviewer).map(ot => ot.level2_reviewer)
    ].filter((id, index, self) => self.indexOf(id) === index); // unique IDs

    let reviewersMap = new Map();
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', reviewerIds);
      reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
    }

    // Create overtime map keyed by user_id + date
    const overtimeV2Map = new Map(
      allOvertimeV2Data?.map(ot => [
        `${ot.requested_by}_${ot.overtime_date}`,
        {
          id: ot.id,
          overtime_date: ot.overtime_date,
          start_time: ot.start_time,
          end_time: ot.end_time,
          total_hours: ot.total_hours,
          reason: ot.reason,
          status: ot.final_status || ot.status,
          level1_status: ot.level1_status,
          level2_status: ot.level2_status,
          final_status: ot.final_status,
          level1_reviewer: ot.level1_reviewer ? reviewersMap.get(ot.level1_reviewer) : null,
          level2_reviewer: ot.level2_reviewer ? reviewersMap.get(ot.level2_reviewer) : null,
          level1_comment: ot.level1_comment,
          level2_comment: ot.level2_comment,
          requested_at: ot.requested_at,
          level1_reviewed_at: ot.level1_reviewed_at,
          level2_reviewed_at: ot.level2_reviewed_at,
          approved_at: ot.approved_at
        }
      ]) || []
    );

    // Also store the raw overtime_v2 data for the overtime-only export
    const overtimeV2Records = allOvertimeV2Data;

    // First, calculate daily totals for each user/date combination
    const dailyTotals = new Map<string, { totalHours: number; hasActiveSession: boolean }>();

    attendanceData?.forEach(record => {
      const key = `${record.user_id}_${record.date}`;
      const existing = dailyTotals.get(key) || { totalHours: 0, hasActiveSession: false };

      let sessionHours = 0;
      let isActive = false;

      if (record.total_minutes_final !== undefined) {
        sessionHours = record.total_minutes_final / 60;
      } else if (record.total_minutes_raw !== undefined) {
        sessionHours = record.total_minutes_raw / 60;
      } else if (record.time_in && record.time_out) {
        const timeIn = new Date(record.time_in);
        const timeOut = new Date(record.time_out);
        const diffMs = timeOut.getTime() - timeIn.getTime();
        sessionHours = diffMs / (1000 * 60 * 60);
      } else if (record.time_in && !record.time_out) {
        // Active session - don't include in daily total for overtime calculation
        isActive = true;
      }

      dailyTotals.set(key, {
        totalHours: existing.totalHours + sessionHours,
        hasActiveSession: existing.hasActiveSession || isActive
      });
    });

    // Calculate daily overtime for each day
    const dailyOvertimeMap = new Map<string, number>();

    // Create a map to track Field Engineer status per user
    const userFieldEngineerMap = new Map<string, boolean>();
    attendanceData?.forEach(record => {
      const isFieldEngineer = record.profiles?.positions && (record.profiles.positions as any).name === 'Field Engineer';
      userFieldEngineerMap.set(record.user_id, isFieldEngineer);
    });

    dailyTotals.forEach((dailyData, key) => {
      const userId = key.split('_')[0];
      const isFieldEngineer = userFieldEngineerMap.get(userId) || false;

      const totalHours = Math.round(dailyData.totalHours * 100) / 100;
      // Apply lunch deduction once per day only for Field Engineers
      const effectiveHours = (isFieldEngineer && totalHours > 5) ? totalHours - 1 : totalHours;
      const roundedEffective = Math.round(effectiveHours * 100) / 100;
      // Calculate overtime based on daily total
      const dailyOvertime = Math.max(0, roundedEffective - 8);
      dailyOvertimeMap.set(key, Math.round(dailyOvertime * 100) / 100);
    });

    // Process attendance data with per-session calculations
    const data = attendanceData?.map(record => {
      // Check if user is a Field Engineer
      const isFieldEngineer = record.profiles?.positions && (record.profiles.positions as any).name === 'Field Engineer';

      let totalHours = 0;
      let isActiveSession = false;

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
      } else if (record.time_in && !record.time_out) {
        // Active session - calculate hours from time_in to now
        isActiveSession = true;
        const timeIn = new Date(record.time_in);
        const now = new Date();
        const diffMs = now.getTime() - timeIn.getTime();
        totalHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
      }

      // Round to 2 decimal places
      totalHours = Math.round(totalHours * 100) / 100;

      // Per-session lunch deduction only for Field Engineers (for display in detailed records)
      let effectiveHours = (isFieldEngineer && totalHours > 5) ? totalHours - 1 : totalHours;
      effectiveHours = Math.round(effectiveHours * 100) / 100;

      // Per-session overtime (kept for backward compatibility in detailed view)
      const standardHours = 8;
      let regularHours = Math.min(effectiveHours, standardHours);
      let overtimeHours = Math.max(0, effectiveHours - standardHours);

      regularHours = Math.round(regularHours * 100) / 100;
      overtimeHours = Math.round(overtimeHours * 100) / 100;

      // Get daily overtime for this record
      const dailyKey = `${record.user_id}_${record.date}`;
      const dailyOvertime = dailyOvertimeMap.get(dailyKey) || 0;

      // Get overtime_v2 request for this user and date
      const overtimeV2Key = `${record.user_id}_${record.date}`;
      const overtimeRequest = overtimeV2Map.get(overtimeV2Key) || null;

      return {
        ...record,
        is_active_session: isActiveSession, // Flag to indicate active session
        total_hours_raw: totalHours, // Original hours before lunch deduction
        lunch_deduction: (isFieldEngineer && totalHours > 5) ? 1 : 0,
        total_hours: effectiveHours, // Hours after lunch deduction
        regular_hours: regularHours,
        overtime_hours: overtimeHours, // Per-session overtime (for detailed records)
        daily_overtime_hours: dailyOvertime, // Daily-based overtime (for DTR summary)
        overtimeRequest: overtimeRequest
      };
    });

    // For overtime-only export, fetch profiles for overtime_v2 records
    const overtimeV2WithProfiles = await Promise.all(
      overtimeV2Records.map(async (ot) => {
        const { data: profile } = await supabase!
          .from('profiles')
          .select('first_name, last_name, email, employee_id')
          .eq('id', ot.requested_by)
          .single();

        return {
          ...ot,
          profiles: profile,
          level1_reviewer_profile: ot.level1_reviewer ? reviewersMap.get(ot.level1_reviewer) : null,
          level2_reviewer_profile: ot.level2_reviewer ? reviewersMap.get(ot.level2_reviewer) : null
        };
      })
    );

    return res.status(200).json({ data, overtimeV2: overtimeV2WithProfiles });

  } catch (error: any) {
    console.error('Export attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance records'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
