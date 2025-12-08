import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    async function loadSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      setUser(sessionData.session?.user || null);
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();

  }, []);

  return { user, loading };
}
