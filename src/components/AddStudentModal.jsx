import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AddStudentModal({ onClose, onSuccess, editData }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchSemesters();
    
    if (editData) {
      setFullName(editData.users?.full_name || "");
      setEmail(editData.users?.email || "");
      setStudentId(editData.student_code || "");
      setDeptId(editData.dept_id?.toString() || "");
      setSemesterId(editData.enrolled_at?.toString() || "");
    }
  }, [editData]);

  async function fetchDepartments() {
    const { data, error } = await supabase.from("departments").select("*");
    if (error) {
      console.error("Error fetching departments:", error);
    } else {
      setDepartments(data || []);
    }
  }

  async function fetchSemesters() {
    const { data, error } = await supabase
      .from("semesters")
      .select("id, name")
      .order("id", { ascending: false });
    
    if (error) {
      console.error("Error fetching semesters:", error);
    } else {
      if (data && data.length > 0) {
        setSemesters(data);
        setSemesterId(data[0].id.toString());
      } else {
        setSemesters([]);
      }
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      if (!deptId) {
        alert("Please select a department.");
        setLoading(false);
        return;
      }
      
      const deptIdNum = parseInt(deptId);
      
      if (isNaN(deptIdNum)) {
        alert("Department ID must be a valid number.");
        setLoading(false);
        return;
      }

      if (!semesterId) {
        alert("Please select a semester.");
        setLoading(false);
        return;
      }

      const semesterIdNum = parseInt(semesterId);
      if (isNaN(semesterIdNum)) {
        alert("Semester ID must be a valid number.");
        setLoading(false);
        return;
      }

      // Edit mode: update existing student
      if (editData) {
        const { error: userError } = await supabase
          .from("users")
          .update({
            full_name: fullName,
            email: email,
          })
          .eq("id", editData.user_id);

        if (userError) {
          alert("User Update Error: " + userError.message);
          setLoading(false);
          return;
        }

        const { error: studentError } = await supabase
          .from("students")
          .update({
            student_code: studentId,
            dept_id: deptIdNum,
            enrolled_at: semesterIdNum,
          })
          .eq("user_id", editData.user_id);

        if (studentError) {
          alert("Student Update Error: " + studentError.message);
          setLoading(false);
          return;
        }

        alert("Student updated successfully!");
        onSuccess();
        setLoading(false);
        return;
      }

      // Create mode: create new student
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
          password: studentId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorJson = JSON.parse(errorText);
          const errorMsg = errorJson.error?.message || errorJson.error?.code || errorText;
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

      if (result.error) {
        alert("Auth Error: " + result.error.message);
        setLoading(false);
        return;
      }

      if (!result.user) {
        alert("Unexpected Error: Edge Function did not return user data.");
        setLoading(false);
        return;
      }

      const userId = result.user.id;

      const { error: userError, data: userData } = await supabase.from("users").insert({
        email,
        full_name: fullName,
        role: "student",
        first_login: true,
      }).select();

      if (userError) {
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

      const { error: studentError } = await supabase.from("students").insert({
        user_id: dbUserId,
        student_code: studentId,
        dept_id: deptIdNum,
        enrolled_at: semesterIdNum,
        credits: 0,
      });

      if (studentError) {
        alert("Student Insert Error: " + studentError.message);
        setLoading(false);
        return;
      }

      alert(`Student created successfully!\nEmail: ${email}\nPassword: ${studentId}`);
      onSuccess();

    } catch (err) {
      alert("Unexpected Error: " + err.message);
    }

    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{editData ? "Edit Student" : "Add Student"}</h2>
            <p className="text-sm text-slate-600">{editData ? "Update student information" : "Create a new student account"}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAddStudent} className="space-y-4 p-8">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Full Name</label>
            <input
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Email</label>
            <input
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Student ID</label>
            <input
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Department</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Semester</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              required
            >
              <option value="">Select Semester</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-lg bg-brandButton text-white font-semibold hover:bg-menuHover disabled:opacity-50 transition"
            >
              {loading ? (editData ? "Updating..." : "Creating...") : (editData ? "Update Student" : "Create Student")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
