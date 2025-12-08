import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import AddStudentModal from "../components/AddStudentModal";

export default function AddStudent() {
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    const { data, error } = await supabase
      .from("students")
      .select(`
        *,
        users!user_id(full_name, email),
        departments!dept_id(name),
        semesters!enrolled_at(name)
      `)
      .order("student_code");
    
    if (error) {
      console.error("Error fetching students:", error);
    } else {
      setStudents(data || []);
    }
  }

  function handleSuccess() {
    setShowModal(false);
    setEditingStudent(null);
    fetchStudents();
  }

  function handleEdit(student) {
    setEditingStudent(student);
    setShowModal(true);
  }

  async function handleDelete(userId) {
    if (!confirm("Are you sure you want to delete this student? This will also delete their user account.")) {
      return;
    }

    const { error: studentError } = await supabase
      .from("students")
      .delete()
      .eq("user_id", userId);

    if (studentError) {
      alert("Error deleting student: " + studentError.message);
      return;
    }

    const { error: userError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userError) {
      alert("Error deleting user: " + userError.message);
    } else {
      alert("Student deleted successfully!");
      fetchStudents();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Students</h1>
            <p className="text-slate-600">Manage student accounts</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brandButton hover:bg-menuHover text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition"
          >
            <i className='bx bx-plus text-xl'></i>
            Add Student
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Student Code</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Full Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Department</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Enrolled At</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No students found. Click "+ Add Student" to create one.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.user_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{student.student_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{student.users?.full_name || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{student.users?.email || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{student.departments?.name || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{student.semesters?.name || "N/A"}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(student.user_id)}
                          className="text-red-600 hover:text-red-700 font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <AddStudentModal
            onClose={() => {
              setShowModal(false);
              setEditingStudent(null);
            }}
            onSuccess={handleSuccess}
            editData={editingStudent}
          />
        )}
      </div>
    </div>
  );
}
