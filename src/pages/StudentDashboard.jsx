import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import UserProfile from "../components/UserProfile";
import Advising from "./Advising";
import EnrolledClassesLMS from "./EnrolledClassesLMS";
import ClassSchedule from "./ClassSchedule";
import GradeReport from "./GradeReport";

const defaultStats = [
  { label: "Current GPA", value: "—", detail: "Loading...", change: "", badgeBg: "bg-blue-50", badgeText: "text-blue-700" },
  { label: "Credits Earned", value: "-- / 120", detail: "6 courses in progress", change: "", badgeBg: "bg-sky-50", badgeText: "text-sky-700" },
  { label: "Attendance", value: "94%", detail: "All classes on track", change: "+2.1% vs last month", badgeBg: "bg-emerald-50", badgeText: "text-emerald-700" },
  { label: "Fees", value: "Cleared", detail: "Next due Jan 15", change: "Receipt #34821", badgeBg: "bg-amber-50", badgeText: "text-amber-700" },
];

const announcements = [
  { title: "Library opens late for finals week", meta: "Student Affairs • Dec 8" },
  { title: "Career fair registrations close Friday", meta: "Career Services • Dec 10" },
  { title: "Wellness hour added on Thursdays", meta: "Campus Life • Dec 11" },
];

const sidebarItems = [
  { icon: "bx-grid-alt", label: "Dashboard" },
  { icon: "bx-user-check", label: "Advising" },
  { icon: "bx-book", label: "Enrolled Classes" },
  { icon: "bx-time-five", label: "Class Schedule" },
  { icon: "bx-file", label: "Support Tickets" },
  { icon: "bx-file", label: "Grade Report" },
 // { icon: "bx-spreadsheet", label: "Accounts Ledger" },
];

export default function StudentDashboard() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [stats, setStats] = useState(defaultStats);
  const [cgpa, setCgpa] = useState(null);
  const [enrolledSemester, setEnrolledSemester] = useState("");
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [selectedCourseCode, setSelectedCourseCode] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [departmentName, setDepartmentName] = useState("");
  const [departmentLoaded, setDepartmentLoaded] = useState(false);

  useEffect(() => {
    async function loadSemesterName() {
      // Mirror UserProfile fetch: map auth email -> users row
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser?.email) {
        setEnrolledSemester("Not enrolled");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select(
          `id`
        )
        .eq("email", authUser.email)
        .maybeSingle();

      if (error  ||!data?.id) {
        console.error("Error fetching user data:", error);
        setEnrolledSemester("Not enrolled");
        return;
      }

      const userId = data.id;

      // Get student's department
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("dept_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (studentData?.dept_id) {
        const { data: deptData } = await supabase
          .from("departments")
          .select("name")
          .eq("dept_id", studentData.dept_id)
          .maybeSingle();
        
        if (deptData?.name) {
          setDepartmentName(deptData.name);
        } else {
          setDepartmentName("");
        }
      } else {
        setDepartmentName("");
      }
      setDepartmentLoaded(true);

      // Get current semester from system_config
      const { data: studentSems } = await supabase
        .from("students")
        .select("enrolled_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!studentSems?.enrolled_at) {
        console.error("Failed to fetch current semester id");
        setEnrolledSemester("Not available");
        return;
      }

      const { data: semesterData, error: semesterError } = await supabase
        .from("semesters")
        .select("name")
        .eq("id", studentSems.enrolled_at)
        .maybeSingle();

      if (semesterError || !semesterData?.name) {
        console.error("Failed to fetch semester name", semesterError);
        setEnrolledSemester("Not enrolled");
        return;
      }

      setEnrolledSemester(semesterData.name);
      
      // Fetch CGPA from enrollments
      await fetchCGPA(userId);
    }

    async function fetchCGPA(userId) {
      try {
        // Get current semester
        const { data: cfg } = await supabase
          .from("system_config")
          .select("current_semester_id")
          .eq("id", 1)
          .maybeSingle();
        let currentSemesterId = cfg?.current_semester_id || null;

        // Fetch enrollments
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select(`
            grade, class_id,
            course_classes:class_id (
              semester_id,
              courses:course_id (credit)
            )
          `)
          .eq("student_id", userId);

        if (!enrollments || enrollments.length === 0) {
          return;
        }

        // Filter out current semester and calculate CGPA
        let totalGp = 0;
        let totalCredits = 0;
        enrollments.forEach(e => {
          const semId = e?.course_classes?.semester_id;
          if (semId && semId !== currentSemesterId) {
            const gradePoint = typeof e.grade === "number" ? e.grade : (parseFloat(e.grade) || 0);
            const credits = e.course_classes?.courses?.credit || 0;
            const gp = gradePoint * credits;
            totalGp += gp;
            totalCredits += credits;
          }
        });

        const cgpa = totalCredits > 0 ? totalGp / totalCredits : null;
        
        // Fetch attendance data
        const { data: attendanceRecords } = await supabase
          .from("attendance")
          .select("*")
          .in("enrollment_id", enrollments.map(e => e.class_id).filter(Boolean));

        // Calculate attendance percentage
        let totalClasses = 0;
        let attendedClasses = 0;
        
        if (attendanceRecords && attendanceRecords.length > 0) {
          attendanceRecords.forEach(record => {
            // Count attendance fields (class_1 to class_45)
            for (let i = 1; i <= 45; i++) {
              const classField = `class_${i}`;
              if (record[classField] !== null && record[classField] !== undefined) {
                totalClasses++;
                if (record[classField] === true || record[classField] === 1) {
                  attendedClasses++;
                }
              }
            }
          });
        }
        
        const attendancePercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : null;
        
        // Update stats with actual CGPA, Credits, and Attendance
        if (cgpa !== null) {
          setCgpa(cgpa);
          setStats(prev => [
            { ...prev[0], value: cgpa.toFixed(2), detail: cgpa >= 3.5 ? "Excellent standing" : cgpa >= 3.0 ? "Good standing" : "Academic standing" },
            { ...prev[1], value: `${totalCredits.toFixed(0)} / 140`, detail: totalCredits >= 140 ? "Completed" : `${(140 - totalCredits).toFixed(0)} credits remaining` },
            { 
              ...prev[2], 
              value: attendancePercentage !== null ? `${attendancePercentage.toFixed(0)}%` : "—",
              detail: attendancePercentage !== null 
                ? (attendancePercentage >= 90 ? "Excellent attendance" : attendancePercentage >= 75 ? "Good attendance" : "Below minimum")
                : "No data"
            },
            ...prev.slice(3)
          ]);
        }
      } catch (err) {
        console.error("Error fetching CGPA:", err);
      }
    }

    loadSemesterName();
    loadTodaySchedule();
    loadEnrolledCourses();
  }, []);

  const baseDayNames = { S: "Sun", M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri" };
  const comboDayNames = {
    ST: ["Sun", "Tue"],
    SR: ["Sun", "Thu"],
    SM: ["Sun", "Mon"],
    SF: ["Sun", "Fri"],
    MT: ["Mon", "Tue"],
    MW: ["Mon", "Wed"],
    MR: ["Mon", "Thu"],
    MF: ["Mon", "Fri"],
    TW: ["Tue", "Wed"],
    TR: ["Tue", "Thu"],
    TF: ["Tue", "Fri"],
    WR: ["Wed", "Thu"],
    WF: ["Wed", "Fri"],
    RF: ["Thu", "Fri"],
  };

  function getDaysForSlot(daySlot) {
    if (!daySlot) return [];
    const key = daySlot.replace(/\s+/g, "").toUpperCase();
    if (comboDayNames[key]) return comboDayNames[key];
    const days = [];
    for (const ch of key.split("")) {
      const name = baseDayNames[ch];
      if (name && !days.includes(name)) days.push(name);
    }
    return days;
  }

  function isMeetingToday(daySlot) {
    const todayIdx = new Date().getDay(); // 0=Sun
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayName = dayNames[todayIdx];
    return getDaysForSlot(daySlot).includes(todayName);
  }

  function toMinutes(timeStr) {
    if (!timeStr) return 0;
    const [start] = timeStr.split("-");
    const trimmed = start.trim();
    const ampmMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const mer = ampmMatch[3].toUpperCase();
      if (mer === "PM" && h !== 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
    const [h, m] = trimmed.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  async function loadTodaySchedule() {
    setScheduleLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser?.email) {
        setTodaySchedule([]);
        setScheduleLoading(false);
        return;
      }

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", authUser.email)
        .maybeSingle();

      if (userErr || !userRow?.id) {
        console.error("loadTodaySchedule user fetch error", userErr);
        setTodaySchedule([]);
        setScheduleLoading(false);
        return;
      }

      // Get current semester
      const { data: sysConfig } = await supabase
        .from("system_config")
        .select("current_semester_id")
        .eq("id", 1)
        .maybeSingle();

      const { data: enrollments, error: enrollErr } = await supabase
        .from("enrollments")
        .select(
          `id, class_id,
           course_classes:class_id (
             id,
             day_slot,
             time_slot,
             room_no,
             section,
             semester_id,
             courses:course_id (name, course_code),
             faculty_user:faculty_id (full_name)
           )`
        )
        .eq("student_id", userRow.id);

      if (enrollErr || !enrollments) {
        console.error("loadTodaySchedule enrollments error", enrollErr);
        setTodaySchedule([]);
        setScheduleLoading(false);
        return;
      }

      const todays = enrollments
        .map((en) => en.course_classes)
        .filter(Boolean)
        .filter((cls) => cls.semester_id === sysConfig?.current_semester_id)
        .filter((cls) => isMeetingToday(cls.day_slot))
        .map((cls) => ({
          time: cls.time_slot || "TBA",
          course:
            cls.courses?.course_code && cls.courses?.name
              ? `${cls.courses.course_code} — ${cls.courses.name}`
              : cls.courses?.name || "Course",
          room: cls.room || "Room TBA",
          type: `Section ${cls.section || ""}`.trim(),
          instructor: cls.faculty_user?.full_name || "Faculty",
          sortKey: toMinutes(cls.time_slot),
        }))
        .sort((a, b) => a.sortKey - b.sortKey);

      setTodaySchedule(todays);
    } catch (err) {
      console.error("loadTodaySchedule exception", err);
      setTodaySchedule([]);
    }
    setScheduleLoading(false);
  }

  async function loadEnrolledCourses() {
    setCoursesLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser?.email) {
        setEnrolledCourses([]);
        setCoursesLoading(false);
        return;
      }

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", authUser.email)
        .maybeSingle();

      if (userErr || !userRow?.id) {
        console.error("loadEnrolledCourses user fetch error", userErr);
        setEnrolledCourses([]);
        setCoursesLoading(false);
        return;
      }

      // Get current semester
      const { data: sysConfig } = await supabase
        .from("system_config")
        .select("current_semester_id")
        .eq("id", 1)
        .maybeSingle();

      if (!sysConfig?.current_semester_id) {
        setEnrolledCourses([]);
        setCoursesLoading(false);
        return;
      }

      const { data: enrollments, error: enrollErr } = await supabase
        .from("enrollments")
        .select(
          `id, class_id,
           course_classes:class_id (
             id,
             section,
             semester_id,
             courses:course_id (name, course_code, credit)
           )`
        )
        .eq("student_id", userRow.id);

      if (enrollErr || !enrollments) {
        console.error("loadEnrolledCourses enrollments error", enrollErr);
        setEnrolledCourses([]);
        setCoursesLoading(false);
        return;
      }

      // Filter for current semester only
      const currentSemesterCourses = enrollments
        .map((en) => en.course_classes)
        .filter(Boolean)
        .filter((cls) => cls.semester_id === sysConfig.current_semester_id)
        .map((cls) => ({
          code: cls.courses?.course_code || "N/A",
          name: cls.courses?.name || "Course",
          credits: cls.courses?.credit || 0,
          section: cls.section || "N/A",
        }));

      setEnrolledCourses(currentSemesterCourses);
    } catch (err) {
      console.error("loadEnrolledCourses exception", err);
      setEnrolledCourses([]);
    }
    setCoursesLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-menuBg min-h-screen p-6 flex flex-col">
        <div className="mb-8">
          <div className="bg-white/10 rounded-2xl p-4 text-center">
            <h2 className="text-xl font-bold text-white">EAST WEST</h2>
            <p className="text-xs text-white/70">UNIVERSITY</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveMenu(item.label)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                item.active || activeMenu === item.label
                  ? "bg-brandButton text-white"
                  : "text-white/70 hover:bg-menuHover hover:text-white"
              }`}
            >
              <i className={`bx ${item.icon} text-xl`}></i>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Fixed Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center flex-shrink-0">
          <h1 className="text-4xl font-bold text-slate-900">CampusLink Student Portal</h1>
          <div className="flex items-center gap-4">
            <UserProfile onUserDataFetch={() => {}} />
            <button className="relative">
              <i className="bx bx-bell text-2xl text-slate-600"></i>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          {activeMenu === "Advising" ? (
            <Advising />
          ) : activeMenu === "Enrolled Classes" ? (
            <EnrolledClassesLMS selectedCourseCode={selectedCourseCode} />
          ) : activeMenu === "Class Schedule" ? (
            <ClassSchedule onCourseSelect={(courseCode) => {
              setSelectedCourseCode(courseCode);
              setActiveMenu("Enrolled Classes");
            }} />
                  ) : activeMenu === "Grade Report" ? (
                    <GradeReport />
          ) : (
            <div className="p-8">
              {/* Hero Section */}
              <div className="bg-gradient-to-r from-menuBg via-brandButton to-menuBg rounded-3xl p-8 mb-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute right-0 top-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-white rounded-full translate-y-1/2"></div>
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold mb-2 text-blue-200">Welcome, Md. Rashid</p>
                    <h2 className="text-3xl font-bold mb-1">{departmentLoaded ? (departmentName ? `Department of ${departmentName}` : "Department not set") : "Loading..."}</h2>
                    <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mt-4">
                      <span className="text-sm font-semibold">BSc. in CSE</span>
                    </div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <p className="text-sm text-blue-200 mb-1">Enrolled</p>
                    <p className="text-2xl font-bold">{enrolledSemester || "Loading..."}</p>
                    <p className="text-xs text-blue-200 mt-3">CGPA</p>
                    <p className="text-4xl font-bold mt-1">{cgpa !== null ? cgpa.toFixed(2) : "—"}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-lg backdrop-blur"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.badgeBg} ${item.badgeText}`}>
                        {item.change}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </section>

              <div className="flex gap-8">
                {/* Left Side - Enrolled Courses */}
                <div className="flex-1">
                  <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Enrolled Courses</h3>
                      <p className="text-sm font-semibold text-brandButton">{enrolledSemester || "Loading..."}</p>
                    </div>
                    
                    {coursesLoading ? (
                      <div className="text-center py-8 text-slate-500">Loading courses...</div>
                    ) : enrolledCourses.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">No courses enrolled for this semester.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {enrolledCourses.map((course) => (
                          <button
                            key={course.code}
                            onClick={() => {
                              setSelectedCourseCode(course.code);
                              setActiveMenu("Enrolled Classes");
                            }}
                            className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:shadow-lg hover:border-brandButton transition-all duration-200 group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="inline-block rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-brandButton group-hover:bg-brandButton group-hover:text-white transition-colors">
                                {course.code}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{course.credits} Credits</span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900 mb-2 line-clamp-2">{course.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                Section {course.section}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Right Sidebar - Schedule and Announcements */}
                <div className="w-96 space-y-6">
                  {/* Today's Schedule */}
                  <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur flex flex-col">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-brandButton">Today</p>
                      <h3 className="text-xl font-bold text-slate-900">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h3>
                    </div>
                    <div className="space-y-3">
                        {scheduleLoading ? (
                          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                            Loading today's classes...
                          </div>
                        ) : todaySchedule.length === 0 ? (
                          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                            No classes scheduled for today.
                          </div>
                        ) : (
                          todaySchedule.map((block) => (
                            <div
                              key={block.time + block.course}
                              className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm hover:shadow-md transition"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{block.time}</p>
                                  <p className="text-base font-bold text-slate-900 mb-1">{block.course}</p>
                                  <p className="text-sm text-slate-600">{block.instructor}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{block.room}</span>
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brandButton">{block.type || "Class"}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                      <button onClick={() => setActiveMenu("Class Schedule")} className="text-xs font-semibold text-brandButton hover:text-menuHover">View week</button>
                    </div>
                  </div>

                  {/* Announcements */}
                  <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">News</h3>
                    <div className="space-y-3">
                      {announcements.map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-100 bg-white p-4 flex gap-3">
                          <div className="w-12 h-12 bg-brandButton rounded-lg flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{item.meta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}