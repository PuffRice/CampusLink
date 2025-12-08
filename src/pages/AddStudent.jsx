import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AddStudent() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    const { data, error } = await supabase.from("departments").select("*");
    if (error) {
      console.error("Error fetching departments:", error);
    } else {
      console.log("Departments loaded:", data);
      if (data && data.length > 0) {
        console.log("First department structure:", data[0]);
      }
      setDepartments(data || []);
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Call Supabase Edge Function
      const functionUrl =
        "https://txvsnagzlkgbgbvaxfux.functions.supabase.co/create-student";
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!anonKey) {
        alert("Missing VITE_SUPABASE_ANON_KEY environment variable.");
        setLoading(false);
        return;
      }

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          email,
          password: studentId, // default password = student ID
        }),
      });

      if (!res.ok) {
        console.error(`HTTP Error: ${res.status} ${res.statusText}`);
        const errorText = await res.text();
        console.error("Response body:", errorText);
        try {
          const errorJson = JSON.parse(errorText);
          const errorMsg = errorJson.error?.message || errorJson.error?.code || errorText;
          // Friendly message for common errors
          let friendlyMsg = errorMsg;
          if (errorJson.error?.code === "email_exists") {
            friendlyMsg = "This email is already registered. Please use a different email.";
          }
          alert(`Error: ${friendlyMsg}`);
        } catch {
          alert(`Edge Function Error: ${res.status} - ${errorText}`);
        }
        setLoading(false);
        return;
      }

      const result = await res.json();

      console.log("FUNCTION RESPONSE:", result);

      // Handle errors returned by the function
      if (result.error) {
        alert("Auth Error: " + result.error.message);
        setLoading(false);
        return;
      }

      // If result.user is missing → something is wrong
      if (!result.user) {
        alert("Unexpected Error: Edge Function did not return user data.");
        console.error("Unexpected Function Response:", result);
        setLoading(false);
        return;
      }

      const userId = result.user.id;
      console.log("Created Auth User ID:", userId);

      // Validate dept_id is selected and is a valid number
      console.log("Selected deptId:", deptId, "Type:", typeof deptId);
      
      if (!deptId) {
        alert("Please select a department.");
        setLoading(false);
        return;
      }
      
      const deptIdNum = parseInt(deptId);
      console.log("Parsed deptIdNum:", deptIdNum);
      
      if (isNaN(deptIdNum)) {
        alert("Department ID must be a valid number.");
        setLoading(false);
        return;
      }

      // 2. Insert into "users" table (without id - let DB auto-generate)
      const { error: userError, data: userData } = await supabase.from("users").insert({
        email,
        full_name: fullName,
        password_hash: "", // Placeholder - passwords managed by Auth
        role: "student",
        first_login: true,
      }).select();

      console.log("User Insert Response:", { error: userError, data: userData });

      if (userError) {
        console.error("Full User Insert Error Details:", {
          message: userError.message,
          code: userError.code,
          status: userError.status,
          details: userError.details,
        });
        alert("User Insert Error: " + (userError.details || userError.message));
        setLoading(false);
        return;
      }

      const dbUserId = userData && userData[0] ? userData[0].id : null;
      if (!dbUserId) {
        alert("Error: User was created but ID not returned.");
        setLoading(false);
        return;
      }

      // 3. Insert into "students" table
      const { error: studentError } = await supabase.from("students").insert({
        user_id: dbUserId,
        student_code: studentId,
        dept_id: deptIdNum,
        credits: 0,
      });

      if (studentError) {
        alert("Student Insert Error: " + studentError.message);
        setLoading(false);
        return;
      }

      alert(`Student created successfully!
Email: ${email}
Password: ${studentId}`);

      // Reset fields
      setFullName("");
      setEmail("");
      setStudentId("");
      setDeptId("");

    } catch (err) {
      alert("Unexpected Error: " + err.message);
      console.error("Full Error Details:", err);
      console.error("Function URL:", functionUrl);
    }

    setLoading(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Add Student</h1>

      <form onSubmit={handleAddStudent} className="max-w-md bg-white p-4 rounded shadow">

        <input
          className="border p-2 w-full mb-3"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          className="border p-2 w-full mb-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="border p-2 w-full mb-3"
          placeholder="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        />

        <select
          className="border p-2 w-full mb-3"
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          required
        >
          <option value="">Select Department</option>
          {departments.map((dept) => (
            <option key={dept.dept_id} value={dept.dept_id}>
              {dept.name}
            </option>
          ))}
        </select>

        <button
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          {loading ? "Creating..." : "Create Student"}
        </button>

      </form>
    </div>
  );
}
