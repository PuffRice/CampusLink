import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function AdminTAManagement() {
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [studentResult, facultyResult, assignmentResult] = await Promise.all([
      supabase.from("students").select("user_id, student_code, dept_id").order("student_code"),
      supabase.from("faculty").select("user_id, faculty_code, designation, dept_id").order("faculty_code"),
      supabase.from("ta_assignments").select("id, student_id, faculty_id, active, created_at").eq("active", true).order("created_at", { ascending: false }),
    ]);

    const firstError = studentResult.error || facultyResult.error || assignmentResult.error;
    if (firstError) {
      setMessage(firstError.message || "Unable to load TA assignments.");
      setLoading(false);
      return;
    }

    const userIds = [
      ...(studentResult.data || []).map((student) => student.user_id),
      ...(facultyResult.data || []).map((member) => member.user_id),
    ];

    let usersById = new Map();
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email")
        .in("id", [...new Set(userIds)]);

      if (usersError) {
        setMessage(usersError.message || "Unable to load user names.");
        setLoading(false);
        return;
      }
      usersById = new Map((users || []).map((user) => [user.id, user]));
    }

    setStudents((studentResult.data || []).map((student) => ({
      ...student,
      ...usersById.get(student.user_id),
    })));
    setFaculty((facultyResult.data || []).map((member) => ({
      ...member,
      ...usersById.get(member.user_id),
    })));
    setAssignments(assignmentResult.data || []);
    setLoading(false);
  }

  const assignedStudentIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.student_id)),
    [assignments],
  );

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.user_id, student])),
    [students],
  );

  const facultyById = useMemo(
    () => new Map(faculty.map((member) => [member.user_id, member])),
    [faculty],
  );

  async function assignTA(event) {
    event.preventDefault();
    if (!studentId || !facultyId) return;

    setSaving(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;
    const { data: admin, error: adminError } = await supabase
      .from("users")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (adminError || admin?.role !== "admin") {
      setMessage("Only an administrator can assign a teaching assistant.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("ta_assignments").upsert(
      {
        student_id: Number(studentId),
        faculty_id: Number(facultyId),
        assigned_by: admin.id,
        active: true,
      },
      { onConflict: "student_id" },
    );

    if (error) {
      setMessage(error.message || "Unable to assign the teaching assistant.");
      setSaving(false);
      return;
    }

    setStudentId("");
    setFacultyId("");
    setMessage("Teaching assistant assigned successfully.");
    await loadData();
    setSaving(false);
  }

  async function revokeAssignment(assignment) {
    const student = studentsById.get(assignment.student_id);
    if (!window.confirm(`Remove ${student?.full_name || "this student"} as a teaching assistant?`)) return;

    const { error } = await supabase
      .from("ta_assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      setMessage(error.message || "Unable to remove the teaching assistant.");
      return;
    }

    setMessage("Teaching assistant assignment removed.");
    await loadData();
  }

  if (loading) {
    return <div className="p-8 text-slate-600">Loading TA assignments...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">TA Assignments</h1>
          <p className="mt-1 text-slate-600">Promote a student to teaching assistant and assign one supervising faculty member.</p>
        </div>

        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <form onSubmit={assignTA} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">New TA assignment</h2>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Student</span>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
              >
                <option value="">Select a student</option>
                {students.filter((student) => !assignedStudentIds.has(student.user_id)).map((student) => (
                  <option key={student.user_id} value={student.user_id}>
                    {student.full_name || student.email} ({student.student_code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Supervising faculty</span>
              <select
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
              >
                <option value="">Select faculty</option>
                {faculty.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name || member.email} ({member.faculty_code})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brandButton px-5 py-2 font-semibold text-white hover:bg-menuHover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Assigning..." : "Assign TA"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Active teaching assistants</h2>
          </div>
          {assignments.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No teaching assistants are assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Student ID</th>
                    <th className="px-6 py-3">Assigned faculty</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assignments.map((assignment) => {
                    const student = studentsById.get(assignment.student_id);
                    const supervisor = facultyById.get(assignment.faculty_id);
                    return (
                      <tr key={assignment.id}>
                        <td className="px-6 py-4 font-semibold text-slate-900">{student?.full_name || "Unknown student"}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{student?.student_code || "—"}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{supervisor?.full_name || "Unknown faculty"}</p>
                          <p className="text-xs text-slate-500">{supervisor?.faculty_code || supervisor?.designation || ""}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => revokeAssignment(assignment)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
