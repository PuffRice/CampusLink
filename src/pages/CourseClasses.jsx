import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import CreateCourseClassModal from "../components/CreateCourseClassModal";

export default function CourseClasses() {
  const [courseClasses, setCourseClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [courses, setCourses] = useState({});
  const [faculty, setFaculty] = useState({});

  async function fetchCourseClasses() {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_classes")
      .select("*")
      .order("day_slot", { ascending: true });

    if (error) {
      console.error("Error fetching course classes:", error);
    } else {
      setCourseClasses(data || []);
    }
    setLoading(false);
  }

  async function fetchMetadata() {
    // Fetch courses
    const { data: courseData } = await supabase.from("courses").select("id, course_code, name");
    const courseMap = {};
    courseData?.forEach((c) => {
      courseMap[c.id] = `${c.course_code} - ${c.name}`;
    });
    setCourses(courseMap);

    // Fetch faculty
    const { data: facultyData } = await supabase
      .from("faculty")
      .select("user_id, faculty_code, users!user_id(full_name)");
    const facultyMap = {};
    facultyData?.forEach((f) => {
      facultyMap[f.user_id] = `${f.users?.full_name} (${f.faculty_code})`;
    });
    setFaculty(facultyMap);
  }

  useEffect(() => {
    fetchCourseClasses();
    fetchMetadata();
  }, []);

  const handleClassCreated = () => {
    setShowModal(false);
    fetchCourseClasses();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Course Classes</h1>
            <p className="text-slate-600">Manage all course classes and schedules</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition"
          >
            + Add Class
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-slate-600 text-lg">Loading course classes...</div>
          </div>
        ) : courseClasses.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center border border-slate-200">
            <p className="text-slate-600 text-lg mb-4">No course classes found</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Create the first class
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Course</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Section</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Day Slot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Time Slot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Room</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Faculty</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Seats</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courseClasses.map((cc, idx) => (
                    <tr
                      key={cc.id}
                      className={`${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                      } border-b border-slate-200 hover:bg-slate-100 transition`}
                    >
                      <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                        {courses[cc.course_id] || "Loading..."}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cc.section}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold text-xs">
                          {cc.day_slot}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cc.time_slot}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-semibold text-xs">
                          {cc.room_no}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {faculty[cc.faculty_id] || "Loading..."}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg font-semibold text-xs ${
                            cc.class_type === "Class"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {cc.class_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">{cc.seats}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button className="text-blue-600 hover:text-blue-700 font-semibold">Edit</button>
                        <button className="text-red-600 hover:text-red-700 font-semibold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CreateCourseClassModal
          onClose={() => setShowModal(false)}
          onSuccess={handleClassCreated}
        />
      )}
    </div>
  );
}
