import { useState } from "react";
import { supabase } from "../supabase";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters long!");
      return;
    }

    setLoading(true);

    // 1. Update password in Supabase Auth
    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authError) {
      alert("Failed to update password: " + authError.message);
      setLoading(false);
      return;
    }

    // 2. Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 3. Update first_login flag in users table
      const { error: updateError } = await supabase
        .from("users")
        .update({ first_login: false })
        .eq("email", user.email);

      if (updateError) {
        console.error("Failed to update first_login flag:", updateError);
      }
    }

    alert("Password changed successfully!");

    // 4. Fetch user profile to redirect based on role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("email", user.email)
      .single();

    if (profile) {
      switch (profile.role) {
        case "admin":
          window.location.href = "/admin";
          break;
        case "staff":
          window.location.href = "/staff";
          break;
        case "faculty":
          window.location.href = "/faculty";
          break;
        case "student":
          window.location.href = "/student";
          break;
        default:
          window.location.href = "/dashboard";
          break;
      }
    } else {
      window.location.href = "/dashboard";
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form
        onSubmit={handleChangePassword}
        className="bg-white p-6 rounded shadow-md w-80"
      >
        <h1 className="text-2xl mb-4 text-center">Change Password</h1>
        <p className="text-sm text-gray-600 mb-4 text-center">
          This is your first login. Please set a new password.
        </p>

        <input
          className="border p-2 w-full mb-3"
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />

        <input
          className="border p-2 w-full mb-3"
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <button
          disabled={loading}
          className="bg-blue-600 text-white py-2 w-full rounded hover:bg-blue-700"
        >
          {loading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
