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
  };

  const logout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("[useAuth] Logout error:", error);
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
