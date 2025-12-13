import { useState } from "react";
import { supabase } from "../supabase";
import { motion } from "framer-motion";
import "../styles/login.css";
import bgImage from "../assets/ewu-web-ui-revamp-login-bg.jpg";
import logo from "../assets/ewuxcampuslink.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("student"); // "student" or "faculty"

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .single();

    if (profileError || !profile) {
      alert("User profile not found.");
      setLoading(false);
      return;
    }

    // Validate login based on active tab
    if (activeTab === "student" && profile.role !== "student") {
      alert("Please use the Admin/Faculty tab to login.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (activeTab === "faculty" && profile.role === "student") {
      alert("Please use the Student tab to login.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (profile.first_login === true) {
      window.location.href = "/change-password";
      return;
    }

    switch (profile.role) {
      case "admin":
        window.location.href = "/staff";
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
        alert("Unknown user role.");
    }

    setLoading(false);
  }

  return (
    <div
      className="login-page"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="login-box"
      >
        {/* LEFT HALF */}
        <div className="login-left">
          <div className="login-tabs">
            <button 
              className={activeTab === "student" ? "login-tab-active" : "login-tab"}
              onClick={() => setActiveTab("student")}
              type="button"
            >
              Student
            </button>
            <button 
              className={activeTab === "faculty" ? "login-tab-active" : "login-tab"}
              onClick={() => setActiveTab("faculty")}
              type="button"
            >
              Admin/Faculty
            </button>
          </div>

          <form onSubmit={handleLogin} className="w-full max-w-xs">
            <input
              type="email"
              placeholder={activeTab === "student" ? "Email" : "Email"}
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="login-input mb-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="w-full flex items-start justify-between mb-2">
              <p className="login-forgot">Forgot Password? Reset It Now!</p>
            </div>

            <p className="login-disclaimer">
              First-time login: use your Student ID (without dashes) as the password.
            </p>

            <button className="login-btn">
              {loading ? "Logging in..." : "LOGIN"}
            </button>
          </form>
        </div>

        {/* RIGHT HALF */}
        <div className="login-right">
          <img src={logo} alt="EWU Logo" className="login-logo" />

          <p className="login-text">
            A/2, Jahurul Islam Avenue<br />
            Jahurul Islam City, Aftabnagar<br />
            Dhaka-1212, Bangladesh
          </p>

          <p className="login-contact">
            02-55046678, 09666775577<br />
            01755587224, 018519333094
          </p>

          <p className="login-contact">
            admissions@ewubd.edu, info@ewubd.edu
          </p>

          <p className="login-footer">
            Developed by CampusLink<br />
            Copyright © 2023 East West University
          </p>
        </div>
      </motion.div>
    </div>
  );
}
