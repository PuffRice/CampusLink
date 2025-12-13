import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import AddStudent from "./AddStudent";
import AddFaculty from "./AddFaculty";
import CourseClasses from "./CourseClasses";
import SystemConfig from "./SystemConfig";
import ServiceRequestManagement from "../components/ServiceRequestManagement";
import UserProfile from "../components/UserProfile";

export default function StaffDashboard() {
  const [activeOption, setActiveOption] = useState("dashboard");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalCourses: 0,
    totalClasses: 0,
    newStudentsThisSemester: 0,
    newFacultyThisSemester: 0,
    totalDepartments: 0,
    activeClassesThisSemester: 0,
    recentStudents: [],
    recentFaculty: [],
    recentClasses: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  function handleUserDataFetch(data) {
    setUserName(data.userName);
    setUserId(data.userId);
    setUserRole(data.userRole);
  }

  async function fetchDashboardStats() {
    setLoading(true);

    // Get current semester (largest id in semesters)
    const { data: currentSemester } = await supabase
      .from("semesters")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const currentSemesterId = currentSemester?.id;

    // Fetch total students
    const { count: studentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true });

    // Fetch students enrolled this semester
    const { count: newStudentsCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("enrolled_at", currentSemesterId);

    // Fetch total faculty
    const { count: facultyCount } = await supabase
      .from("faculty")
      .select("*", { count: "exact", head: true });

    // Fetch faculty created this semester (using user_id from users table created_at)
    const { data: facultyThisSemester } = await supabase
      .from("faculty")
      .select("user_id");

    let newFacultyCount = 0;
    if (facultyThisSemester && currentSemester) {
      // For simplicity, we'll count all faculty as "new" if enrolled_at matches current semester
      // Since faculty doesn't have enrolled_at, we'll just use total count for now
      // You can enhance this by adding a created_at field to faculty table
      newFacultyCount = facultyCount || 0;
    }

    // Fetch total courses
    const { count: courseCount } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true });

    // Fetch total departments
    const { count: deptCount } = await supabase
      .from("departments")
      .select("*", { count: "exact", head: true });

    // Fetch total classes
    const { count: classCount } = await supabase
      .from("course_classes")
      .select("*", { count: "exact", head: true });

    // Fetch recent students (last 5) without joins to avoid PostgREST FK errors
    const { data: recentStudents, error: recentStudentsError } = await supabase
      .from("students")
      .select("student_code")
      .order("id", { ascending: false })
      .limit(5);

    if (recentStudentsError) {
      console.error("Recent students fetch error:", recentStudentsError);
    }

    // Fetch recent faculty (last 5) without joins
    const { data: recentFaculty, error: recentFacultyError } = await supabase
      .from("faculty")
      .select("faculty_code")
      .order("id", { ascending: false })
      .limit(5);

    if (recentFacultyError) {
      console.error("Recent faculty fetch error:", recentFacultyError);
    }

    // Fetch recent classes (last 5) without course join
    const { data: recentClasses, error: recentClassesError } = await supabase
      .from("course_classes")
      .select("id, section, course_id, day_slot, time_slot")
      .order("id", { ascending: false })
      .limit(5);

    if (recentClassesError) {
      console.error("Recent classes fetch error:", recentClassesError);
    }

    setStats({
      totalStudents: studentCount || 0,
      totalFaculty: facultyCount || 0,
      totalCourses: courseCount || 0,
      totalClasses: classCount || 0,
      newStudentsThisSemester: newStudentsCount || 0,
      newFacultyThisSemester: newFacultyCount || 0,
      totalDepartments: deptCount || 0,
      activeClassesThisSemester: classCount || 0,
      recentStudents: recentStudents || [],
      recentFaculty: recentFaculty || [],
      recentClasses: recentClasses || []
    });

    setLoading(false);
  }

  const renderContent = () => {
    switch (activeOption) {
      case "student":
        return <AddStudent />;
      case "faculty":
        return <AddFaculty />;
      case "classes":
        return <CourseClasses />;
      case "config":
        return <SystemConfig />;
      case "service-requests":
        return <ServiceRequestManagement />;
      case "dashboard":
      default:
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Welcome Header */}
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-slate-900 mb-2">
                  Hello, {userName || "Staff"}
                </h1>
                <p className="text-slate-600">Welcome back to your dashboard</p>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-slate-600 text-lg">Loading dashboard...</div>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-600 text-sm font-medium">Total Students</p>
                          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalStudents}</p>
                          <p className="text-xs text-slate-500 mt-1">+{stats.newStudentsThisSemester} this semester</p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <i className="bx bxs-graduation text-2xl text-blue-600" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-600 text-sm font-medium">Total Faculty</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalFaculty}</p>
                          <p className="text-xs text-slate-500 mt-1">+{stats.newFacultyThisSemester} this semester</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-lg">
                          <i className="bx bxs-chalkboard text-2xl text-green-600" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-600 text-sm font-medium">Total Courses</p>
                          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.totalCourses}</p>
                          <p className="text-xs text-slate-500 mt-1">across {stats.totalDepartments} departments</p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <i className="bx bxs-book-alt text-2xl text-purple-600" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-600 text-sm font-medium">Total Classes</p>
                          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.totalClasses}</p>
                          <p className="text-xs text-slate-500 mt-1">{stats.activeClassesThisSemester} active sections</p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-lg">
                          <i className="bx bxs-school text-2xl text-orange-600" aria-hidden="true"></i>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Students */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Students</h2>
                      {stats.recentStudents.length > 0 ? (
                        <div className="space-y-3">
                          {stats.recentStudents.map((student, idx) => (
                            <div key={`${student.student_code}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-semibold text-slate-900">New student</p>
                                <p className="text-sm text-slate-600">{student.student_code}</p>
                              </div>
                              <span className="text-xs text-slate-500">—</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-4">No students yet</p>
                      )}
                    </div>

                    {/* Recent Faculty */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Faculty</h2>
                      {stats.recentFaculty.length > 0 ? (
                        <div className="space-y-3">
                          {stats.recentFaculty.map((faculty, idx) => (
                            <div key={`${faculty.faculty_code}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-semibold text-slate-900">New faculty</p>
                                <p className="text-sm text-slate-600">{faculty.faculty_code}</p>
                              </div>
                              <span className="text-xs text-slate-500">—</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-4">No faculty yet</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Classes */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 mt-6">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Course Classes</h2>
                    {stats.recentClasses.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Course</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Section</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Day Slot</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Time Slot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.recentClasses.map((classItem) => (
                              <tr key={classItem.id} className="border-b border-slate-200">
                                <td className="px-4 py-3 text-sm text-slate-900">Course #{classItem.course_id}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{classItem.section}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-semibold text-xs">
                                    {classItem.day_slot}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{classItem.time_slot}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">No classes yet</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-menuBg text-white p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-8">Staff Menu</h2>

        <nav className="flex flex-col gap-4">
          <button
            onClick={() => setActiveOption("dashboard")}
            className={`px-4 py-3 rounded transition text-left ${
              activeOption === "dashboard"
                ? "bg-brandButton"
                : "bg-menuBg hover:bg-menuHover"
            }`}
          >
            <i className="bx bxs-dashboard text-lg mr-2 align-middle" aria-hidden="true"></i>
            Dashboard
          </button>

          {/* Admin Only: Add Student */}
          {userRole === "admin" && (
            <button
              onClick={() => setActiveOption("student")}
              className={`px-4 py-3 rounded transition text-left ${
                activeOption === "student"
                  ? "bg-brandButton"
                  : "bg-menuBg hover:bg-menuHover"
              }`}
            >
              <i className="bx bxs-user-plus text-lg mr-2 align-middle" aria-hidden="true"></i>
              Add Student
            </button>
          )}

          {/* Admin Only: Add Faculty */}
          {userRole === "admin" && (
            <button
              onClick={() => setActiveOption("faculty")}
              className={`px-4 py-3 rounded transition text-left ${
                activeOption === "faculty"
                  ? "bg-brandButton"
                  : "bg-menuBg hover:bg-menuHover"
              }`}
            >
              <i className="bx bxs-user-check text-lg mr-2 align-middle" aria-hidden="true"></i>
              Add Faculty
            </button>
          )}

          {/* Staff & Admin: Course Classes */}
          <button
            onClick={() => setActiveOption("classes")}
            className={`px-4 py-3 rounded transition text-left ${
              activeOption === "classes"
                ? "bg-brandButton"
                : "bg-menuBg hover:bg-menuHover"
            }`}
          >
            <i className="bx bxs-book-content text-lg mr-2 align-middle" aria-hidden="true"></i>
            Course Classes
          </button>

          {/* Admin Only: System Config */}
          {userRole === "admin" && (
            <button
              onClick={() => setActiveOption("config")}
              className={`px-4 py-3 rounded transition text-left ${
                activeOption === "config"
                  ? "bg-brandButton"
                  : "bg-menuBg hover:bg-menuHover"
              }`}
            >
              <i className="bx bxs-cog text-lg mr-2 align-middle" aria-hidden="true"></i>
              System Config
            </button>
          )}

          {/* Staff & Admin: Service Requests */}
          <button
            onClick={() => setActiveOption("service-requests")}
            className={`px-4 py-3 rounded transition text-left ${
              activeOption === "service-requests"
                ? "bg-brandButton"
                : "bg-menuBg hover:bg-menuHover"
            }`}
          >
            <i className="bx bxs-file text-lg mr-2 align-middle" aria-hidden="true"></i>
            Service Requests
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with User Profile */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-end items-center">
          <UserProfile onUserDataFetch={handleUserDataFetch} />
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
