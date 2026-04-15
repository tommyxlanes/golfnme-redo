// components/AuthHydration.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/stores";

export function AuthHydration() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    if (status === "authenticated" && session?.user) {
      setUser(session.user as any); // cast if needed
    } else {
      setUser(null);
    }
  }, [session, status, setUser, setLoading]);

  return null;
}
