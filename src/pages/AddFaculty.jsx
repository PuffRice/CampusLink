import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import AddFacultyModal from "../components/AddFacultyModal";

export default function AddFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);

  useEffect(() => {
    fetchFaculty();
  }, []);

  async function fetchFaculty() {
    const { data, error } = await supabase
      .from("faculty")
      .select(`
        *,
        users!user_id(full_name, email),
        departments!dept_id(name)
      `)
      .order("faculty_code");
    
    if (error) {
      console.error("Error fetching faculty:", error);
    } else {
      setFaculty(data || []);
    }
  }

  function handleSuccess() {
    setShowModal(false);
    setEditingFaculty(null);
    fetchFaculty();
  }

  function handleEdit(fac) {
    setEditingFaculty(fac);
    setShowModal(true);
  }

  async function handleDelete(userId) {
    if (!confirm("Are you sure you want to delete this faculty member? This will also delete their user account.")) {
      return;
    }

    const { error: facultyError } = await supabase
      .from("faculty")
      .delete()
      .eq("user_id", userId);

    if (facultyError) {
      alert("Error deleting faculty: " + facultyError.message);
      return;
    }

    const { error: userError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userError) {
      alert("Error deleting user: " + userError.message);
    } else {
      alert("Faculty deleted successfully!");
      fetchFaculty();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Faculty</h1>
            <p className="text-slate-600">Manage faculty accounts</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brandButton hover:bg-menuHover text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition"
          >
            <i className='bx bx-plus text-xl'></i>
            Add Faculty
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Faculty Code</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Full Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Department</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Designation</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {faculty.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No faculty found. Click "+ Add Faculty" to create one.
                    </td>
                  </tr>
                ) : (
                  faculty.map((fac) => (
                    <tr key={fac.user_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{fac.faculty_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{fac.users?.full_name || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{fac.users?.email || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{fac.departments?.name || "N/A"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{fac.designation || "N/A"}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(fac)}
                          className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(fac.user_id)}
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
          <AddFacultyModal
            onClose={() => {
              setShowModal(false);
              setEditingFaculty(null);
            }}
            onSuccess={handleSuccess}
            editData={editingFaculty}
          />
        )}
      </div>
    </div>
  );
}
