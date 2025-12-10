import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import UserProfile from "../components/UserProfile";
import FacultyAssignedCourses from "./FacultyAssignedCourses";

const sidebarItems = [
  { icon: "bx-grid-alt", label: "Dashboard" },
  { icon: "bx-book", label: "Assigned Courses" },
  { icon: "bx-time-five", label: "Class Schedule" },
  { icon: "bx-bar-chart", label: "Grade Submission" },
  { icon: "bx-file", label: "Reports" },
];

export default function FacultyDashboard() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const stats = [
    { label: "Assigned Courses", value: assignedCourses.length.toString(), detail: "This semester", change: "2 labs + 2 lectures", badgeBg: "bg-blue-50", badgeText: "text-blue-700" },
    { label: "Total Students", value: "128", detail: "Across all sections", change: "Average 32 per course", badgeBg: "bg-sky-50", badgeText: "text-sky-700" },
    { label: "Grades Submitted", value: "82%", detail: "2 courses completed", change: "2 pending", badgeBg: "bg-emerald-50", badgeText: "text-emerald-700" },
    { label: "Attendance Rate", value: "91%", detail: "Average across courses", change: "+3.2% from last month", badgeBg: "bg-amber-50", badgeText: "text-amber-700" },
  ];

  useEffect(() => {
    fetchAssignedCourses();
  }, []);

  async function fetchAssignedCourses() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        console.log("No user found");
        setLoading(false);
        return;
      }

      // Get user id from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (userError || !userData) {
        console.error("User fetch error:", userError);
        setLoading(false);
        return;
      }

      console.log("User ID:", userData.id);

      // Get assigned course_classes where faculty_id matches users.id
      const { data: courseClasses, error: classError } = await supabase
        .from("course_classes")
        .select(`
          *,
          courses:course_id (*)
        `)
        .eq("faculty_id", userData.id);
      
      console.log("Course classes fetch error:", classError);
      console.log("Course classes:", courseClasses);
      
      if (classError || !courseClasses) {
        setLoading(false);
        return;
      }

      setAssignedCourses(courseClasses);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching assigned courses:", err);
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-[#800000] min-h-screen p-6 flex flex-col">
        <div className="mb-8">
          <div className="bg-white/10 rounded-2xl p-4 text-center">
            <h2 className="text-xl font-bold text-white">EAST WEST</h2>
            <p className="text-xs text-white/70">UNIVERSITY</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {sidebarItems.map((item) => (
            <div key={item.label}>
              <button
                onClick={() => setActiveMenu(item.label)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                  activeMenu === item.label
                    ? "bg-brandButton text-white"
                    : "text-white/70 hover:bg-menuHover hover:text-white"
                }`}
              >
                <i className={`bx ${item.icon} text-xl`}></i>
                <span className="text-sm font-medium">{item.label}</span>
              </button>

              {/* Course Dropdown for Assigned Courses */}
              {item.label === "Assigned Courses" && activeMenu === "Assigned Courses" && assignedCourses.length > 0 && (
                <div className="ml-4 mt-2 space-y-1 border-l border-white/20 pl-3">
                  {assignedCourses.map((course) => (
                    <button
                      key={course.id}
                      className="w-full text-left px-4 py-2 text-xs text-white/60 hover:text-white rounded transition"
                      title={course.courses?.name}
                    >
                      {course.courses?.course_code} - Section {course.section}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Fixed Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center flex-shrink-0">
          <h1 className="text-4xl font-bold text-slate-900">
            {activeMenu === "Dashboard" ? "Faculty Dashboard" : activeMenu}
          </h1>
          <div className="flex items-center gap-4">
            <UserProfile onUserDataFetch={() => {}} />
            <button className="relative">
              <i className="bx bx-bell text-2xl text-slate-600"></i>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">2</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          {activeMenu === "Assigned Courses" ? (
            <FacultyAssignedCourses courses={assignedCourses} />
          ) : activeMenu === "Dashboard" ? (
            <div className="p-8 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <div className={`${stat.badgeBg} rounded-lg p-3 mb-4 w-fit`}>
                      <p className={`${stat.badgeText} text-xs font-semibold uppercase`}>{stat.label}</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 mb-2">{stat.value}</p>
                    <p className="text-xs text-slate-600 mb-1">{stat.detail}</p>
                    <p className="text-xs text-slate-500">{stat.change}</p>
                  </div>
                ))}
              </div>

              {/* Welcome Message */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Welcome back, Faculty Member</h2>
                <p className="text-blue-100">You have {assignedCourses.length} courses assigned this semester. Check your assigned courses for more details.</p>
              </div>

              {/* Assigned Courses Overview */}
              <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Your Assigned Courses</h3>
                {assignedCourses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignedCourses.slice(0, 6).map((course) => (
                      <div key={course.id} className="group bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                        {/* Course Header */}
                        <div className="mb-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-lg text-blue-600 mb-1">{course.courses?.course_code}</h4>
                              <p className="text-sm text-slate-700 font-semibold">{course.courses?.name}</p>
                            </div>
                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                              Sec {course.section}
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-slate-300 mb-4"></div>

                        {/* Course Details Grid */}
                        <div className="space-y-3">
                          {/* Time */}
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 bg-blue-100 rounded-lg p-2">
                              <i className="bx bx-time text-lg text-blue-600"></i>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Time</p>
                              <p className="text-sm text-slate-900 font-medium">{course.time_slot}</p>
                            </div>
                          </div>

                          {/* Days */}
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 bg-emerald-100 rounded-lg p-2">
                              <i className="bx bx-calendar text-lg text-emerald-600"></i>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Days</p>
                              <p className="text-sm text-slate-900 font-medium">{course.day_slot}</p>
                            </div>
                          </div>

                          {/* Room */}
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 bg-amber-100 rounded-lg p-2">
                              <i className="bx bx-building text-lg text-amber-600"></i>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-semibold uppercase">Room</p>
                              <p className="text-sm text-slate-900 font-medium">{course.room_no || "TBA"}</p>
                            </div>
                          </div>

                          {/* Enrollment */}
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 bg-purple-100 rounded-lg p-2">
                              <i className="bx bx-user-check text-lg text-purple-600"></i>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-slate-500 font-semibold uppercase">Enrollment</p>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-900 font-medium">{course.filled_seats} / {course.seats} students</p>
                              </div>
                              <div className="w-full bg-slate-300 rounded-full h-2 mt-1">
                                <div 
                                  className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600"
                                  style={{ width: `${course.seats ? (course.filled_seats / course.seats) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">No courses assigned.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
                <p>Coming soon...</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
