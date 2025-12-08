import { useEffect } from "react";
import { supabase } from "../supabase";

export default function useAutoLogout(timeoutMinutes = 15) {
  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      }, timeoutMinutes * 60 * 1000);
    };

    // user activity events
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) => window.addEventListener(event, resetTimer));

    // initialize timer at start
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutMinutes]);
}
