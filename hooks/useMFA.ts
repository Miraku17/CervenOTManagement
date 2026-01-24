import { useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';

export interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: 'totp';
  status: 'unverified' | 'verified';
  created_at: string;
  updated_at: string;
}

export interface EnrollmentResult {
  id: string;
  type: 'totp';
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export const useMFA = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Enroll a new TOTP factor
   * Returns QR code data for the authenticator app
   */
  const enrollTOTP = useCallback(async (friendlyName?: string): Promise<EnrollmentResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: friendlyName || 'Authenticator App',
      });

      if (enrollError) {
        console.error('MFA enrollment error:', enrollError);
        setError(enrollError.message);
        return null;
      }

      return data as EnrollmentResult;
    } catch (err: any) {
      console.error('MFA enrollment exception:', err);
      setError(err.message || 'Failed to enroll MFA');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Verify the TOTP code during enrollment to activate the factor
   */
  const verifyEnrollment = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // First, create a challenge for the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        console.error('MFA challenge error:', challengeError);
        setError(challengeError.message);
        return false;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        console.error('MFA verify error:', verifyError);
        setError(verifyError.message);
        return false;
      }

      console.log('MFA enrollment verified successfully');
      return true;
    } catch (err: any) {
      console.error('MFA verification exception:', err);
      setError(err.message || 'Failed to verify MFA code');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get all enrolled MFA factors for the current user
   */
  const listFactors = useCallback(async (): Promise<MFAFactor[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (listError) {
        console.error('MFA list factors error:', listError);
        setError(listError.message);
        return [];
      }

      // Return only TOTP factors
      return (data?.totp || []) as MFAFactor[];
    } catch (err: any) {
      console.error('MFA list factors exception:', err);
      setError(err.message || 'Failed to list MFA factors');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check if user has verified TOTP factor
   */
  const hasVerifiedTOTP = useCallback(async (): Promise<boolean> => {
    const factors = await listFactors();
    return factors.some(f => f.status === 'verified');
  }, [listFactors]);

  /**
   * Get the Authenticator Assurance Level (AAL)
   * aal1 = password only, aal2 = password + MFA
   */
  const getAssuranceLevel = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (error) {
        console.error('Get AAL error:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Get AAL exception:', err);
      return null;
    }
  }, []);

  /**
   * Create an MFA challenge for login verification
   */
  const createChallenge = useCallback(async (factorId: string): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        console.error('MFA challenge error:', challengeError);
        setError(challengeError.message);
        return null;
      }

      return data.id;
    } catch (err: any) {
      console.error('MFA challenge exception:', err);
      setError(err.message || 'Failed to create MFA challenge');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Verify an MFA challenge (for login flow)
   */
  const verifyChallenge = useCallback(async (
    factorId: string,
    challengeId: string,
    code: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verifyError) {
        console.error('MFA verify error:', verifyError);
        setError(verifyError.message);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('MFA verify exception:', err);
      setError(err.message || 'Failed to verify MFA code');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Combined challenge and verify for login flow
   */
  const challengeAndVerify = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    const challengeId = await createChallenge(factorId);
    if (!challengeId) return false;

    return verifyChallenge(factorId, challengeId, code);
  }, [createChallenge, verifyChallenge]);

  /**
   * Unenroll (remove) an MFA factor
   */
  const unenrollFactor = useCallback(async (factorId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        console.error('MFA unenroll error:', unenrollError);
        setError(unenrollError.message);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('MFA unenroll exception:', err);
      setError(err.message || 'Failed to remove MFA factor');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    setError,
    enrollTOTP,
    verifyEnrollment,
    listFactors,
    hasVerifiedTOTP,
    getAssuranceLevel,
    createChallenge,
    verifyChallenge,
    challengeAndVerify,
    unenrollFactor,
  };
};
