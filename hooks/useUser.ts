import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import { User } from "@supabase/supabase-js";

interface UserProfile extends User {
  first_name?: string;
  last_name?: string;
  positions?: { name: string };
  contact_number?: string;
  address?: string;
  role?: string;
}

export const useUser = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUserProfile = async (authUser: User): Promise<UserProfile> => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*, positions(name)")
          .eq("id", authUser.id)
          .single();

        return { ...authUser, ...profile };
      } catch (err) {
        console.error("[useUser] Profile fetch error:", err);
        return { ...authUser };
      }
    };

    // ---- INITIAL SESSION ----
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!mounted) return;

      if (authUser) {
        const profile = await fetchUserProfile(authUser);
        if (mounted) setUser(profile);
      }

      if (mounted) setLoading(false);
    });

    // ---- AUTH SUBSCRIPTION ----
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log("[useUser] Auth event:", event);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (mounted) setUser(profile);
        }
        if (mounted) setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY") {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};
