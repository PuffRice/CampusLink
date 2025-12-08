import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function UserProfile({ onUserDataFetch }) {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserData();

    // Close dropdown when clicking outside
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from("users")
        .select(`
          full_name,
          staff:staff!user_id(staff_code)
        `)
        .eq("email", user.email)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        return;
      }

      if (data) {
        const name = data.full_name || "User";
        setUserName(name);

        // Supabase join returns either a single object or array; handle both safely
        const staffCode = data.staff?.staff_code || data.staff?.[0]?.staff_code || "";
        setUserId(staffCode);

        if (onUserDataFetch) {
          onUserDataFetch({ userName: name, userId: staffCode });
        }
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  function handleViewProfile() {
    navigate("/profile");
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 hover:bg-slate-100 p-2 rounded-lg transition"
      >
        {/* Avatar Circle */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg border-2 border-slate-300">
          {userName ? userName.charAt(0).toUpperCase() : "?"}
        </div>

        {/* User Info */}
        <div className="text-left">
          <p className="font-semibold text-slate-900 text-sm">{userName || "User"}</p>
          <p className="text-xs text-slate-600">{userId || "Staff Code"}</p>
        </div>

        {/* Dropdown Icon */}
        <svg
          className={`w-4 h-4 text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
          <button
            onClick={handleViewProfile}
            className="w-full text-left px-4 py-2 hover:bg-slate-100 transition text-slate-900 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            View Profile
          </button>

          <hr className="my-1 border-slate-200" />

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 hover:bg-red-50 transition text-red-600 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
