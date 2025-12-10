import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import { User } from "@supabase/supabase-js";

interface UserProfile extends User {
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  address?: string;
  role?: string;
  position?: string; // Flattened position name
  leave_credits?: number;
}

/**
 * Simplified useUser hook - only fetches user data for display
 * Auth routing is handled by middleware.ts
 */
export const useUser = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        // Get authenticated user (middleware ensures this exists on protected routes)
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser || !mounted) {
          if (mounted) setLoading(false);
          return;
        }

        // Fetch profile data
        const { data: profile } = await supabase
          .from("profiles")
          .select("*, positions(name), leave_credits")
          .eq("id", authUser.id)
          .single();

        if (mounted) {
          const userWithProfile: UserProfile = {
            ...authUser,
            ...profile,
            position: (profile?.positions as any)?.name, // Extract and flatten position name
          };
          setUser(userWithProfile);
          setLoading(false);
        }
      } catch (err) {
        console.error("[useUser] Error:", err);
        if (mounted) setLoading(false);
      }
    };

    fetchUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
};
