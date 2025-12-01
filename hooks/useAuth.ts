import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase";
import { useUser } from "./useUser";

interface LoginCredentials {
  email: string;
  password: string;
}

export const useAuth = () => {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const login = async ({ email, password }: LoginCredentials) => {
    console.log("🔵 [LOGIN] Starting login...");
    console.log("📧 Email entered:", email);

    // Step 1 — try login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("🟡 [LOGIN RESULT] data:", data);
    console.log("🟡 [LOGIN RESULT] error:", error);

    if (error) {
      console.error("🔴 [LOGIN ERROR] Failed to sign in:", error);
      throw error;
    }

    if (!data.user) {
      console.error("🔴 [LOGIN ERROR] No user returned by Supabase.");
      throw new Error("Failed to sign in");
    }

    console.log("🟢 [LOGIN] Logged in user ID:", data.user.id);

    // Step 2 — fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    console.log("🟡 [PROFILE] profile:", profile);
    console.log("🟡 [PROFILE] profileError:", profileError);

    if (profileError) {
      console.error(
        "🔴 [PROFILE ERROR] Failed to fetch profile:",
        profileError
      );
      throw profileError;
    }

    if (!profile?.role) {
      console.error("🔴 [PROFILE ERROR] No role found for user!");
      throw new Error("User has no assigned role.");
    }

    console.log("🟢 [PROFILE] User role:", profile.role);

    // Step 3 — redirect based on role
    const path =
      profile.role === "admin" ? "/admin/dashboard" : "/dashboard/employee";

    console.log("🟢 [REDIRECT] Redirecting to:", path);

    return path;
  };

  const logout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      // Sign out from Supabase (this automatically clears auth storage)
      await supabase.auth.signOut();

      // Redirect to login page
      router.push("/auth/login");
    } catch (error) {
      console.error("[useAuth] Logout error:", error);
      // Force redirect even on error
      router.push("/auth/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    isLoggingOut,
  };
};
