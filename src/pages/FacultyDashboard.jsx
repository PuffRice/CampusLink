import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import UserProfile from "../components/UserProfile";
import FacultyAssignedCourses from "./FacultyAssignedCourses";
import FacultyClassSchedule from "./FacultyClassSchedule";

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
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState("0%");

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
      if (courseClasses.length > 0) {
        setSelectedCourse(courseClasses[0]);
      }

      // Fetch total students across all courses
      const classIds = courseClasses.map(cc => cc.id);
      if (classIds.length > 0) {
        const { data: enrollments, error: enrollErr } = await supabase
          .from("enrollments")
          .select("id")
          .in("class_id", classIds);
        if (!enrollErr && enrollments) {
          setTotalStudents(enrollments.length);
        }

        // Fetch attendance data for all enrollments
        const { data: attendanceRecords, error: attErr } = await supabase
          .from("attendance")
          .select("*")
          .in("enrollment_id", enrollments?.map(e => e.id) || []);
        
        if (!attErr && attendanceRecords && attendanceRecords.length > 0) {
          let totalClasses = 0;
          let presentCount = 0;
          attendanceRecords.forEach(record => {
            for (let i = 1; i <= 12; i++) {
              const val = record[`class${i}`];
              if (val !== null && val !== undefined) {
                totalClasses++;
                if (val === true) presentCount++;
              }
            }
          });
          const rate = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
          setAttendanceRate(`${rate}%`);
        }
      }

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
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-[#F6EAEA] to-slate-50">
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
                      onClick={() => setSelectedCourse(course)}
                      className={`w-full text-left px-4 py-2 text-xs rounded transition ${
                        selectedCourse?.id === course.id
                          ? "bg-brandButton text-white font-semibold"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
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
            <FacultyAssignedCourses courses={assignedCourses} selectedCourse={selectedCourse} onCourseChange={setSelectedCourse} />
          ) : activeMenu === "Class Schedule" ? (
            <FacultyClassSchedule />
          ) : activeMenu === "Dashboard" ? (
            <div className="p-8 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="bg-[#F6EAEA] rounded-lg p-3 mb-4 w-fit">
                    <p className="text-[#7A2F2F] text-xs font-semibold uppercase">Assigned Courses</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{assignedCourses.length}</p>
                  <p className="text-xs text-slate-600 mb-1">This semester</p>
                  <p className="text-xs text-slate-500">Active sections</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="bg-[#F6EAEA] rounded-lg p-3 mb-4 w-fit">
                    <p className="text-[#7A2F2F] text-xs font-semibold uppercase">Total Students</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{totalStudents}</p>
                  <p className="text-xs text-slate-600 mb-1">Across all sections</p>
                  <p className="text-xs text-slate-500">Enrolled this semester</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="bg-[#F6EAEA] rounded-lg p-3 mb-4 w-fit">
                    <p className="text-[#7A2F2F] text-xs font-semibold uppercase">Grades Submitted</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">82%</p>
                  <p className="text-xs text-slate-600 mb-1">2 courses completed</p>
                  <p className="text-xs text-slate-500">2 pending</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="bg-[#F6EAEA] rounded-lg p-3 mb-4 w-fit">
                    <p className="text-[#7A2F2F] text-xs font-semibold uppercase">Attendance Rate</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{attendanceRate}</p>
                  <p className="text-xs text-slate-600 mb-1">Average across courses</p>
                  <p className="text-xs text-slate-500">This semester</p>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="bg-gradient-to-r from-[#8B3A3A] to-[#6B2A2A] text-white rounded-xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Welcome back, Faculty Member</h2>
                <p className="text-white/80">You have {assignedCourses.length} courses assigned this semester. Check your assigned courses for more details.</p>
              </div>

              {/* Assigned Courses Overview */}
              <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Your Assigned Courses</h3>
                {assignedCourses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assignedCourses.slice(0, 6).map((course) => (
                      <div key={course.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-[#8B3A3A]/30 transition-all duration-300">
                        {/* Course Header with Accent */}
                        <div className="bg-gradient-to-r from-[#8B3A3A] to-[#6B2A2A] px-6 py-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-bold text-xl text-white mb-1">{course.courses?.course_code}</h4>
                              <p className="text-sm text-white/90 font-medium">{course.courses?.name}</p>
                            </div>
                            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                              <span className="text-xs font-bold text-white">Sec {course.section}</span>
                            </div>
                          </div>
                        </div>

                        {/* Course Details */}
                        <div className="p-6 space-y-4">
                          {/* Time */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <i className="bx bx-time text-xl text-slate-600"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Time</p>
                              <p className="text-sm text-slate-900 font-semibold">{course.time_slot}</p>
                            </div>
                          </div>

                          {/* Days */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <i className="bx bx-calendar text-xl text-slate-600"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Days</p>
                              <p className="text-sm text-slate-900 font-medium">{course.day_slot}</p>
                            </div>
                          </div>

                          {/* Room */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                              <i className="bx bx-building text-xl text-slate-600"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Room</p>
                              <p className="text-sm text-slate-900 font-semibold">{course.room_no || "TBA"}</p>
                            </div>
                          </div>

                          {/* Enrollment with maroon accent */}
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <i className="bx bx-group text-lg text-[#8B3A3A]"></i>
                                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Enrollment</span>
                              </div>
                              <span className="text-sm text-slate-700 font-bold">{course.filled_seats} / {course.seats}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-gradient-to-r from-[#8B3A3A] to-[#6B2A2A]"
                                style={{ width: `${course.seats ? (course.filled_seats / course.seats) * 100 : 0}%` }}
                              ></div>
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
