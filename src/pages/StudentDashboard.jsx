import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import UserProfile from "../components/UserProfile";

const stats = [
  { label: "Current GPA", value: "3.82", detail: "Excellent standing", change: "+0.12 this term", badgeBg: "bg-blue-50", badgeText: "text-blue-700" },
  { label: "Credits Earned", value: "82 / 120", detail: "6 courses in progress", change: "18 credits remaining", badgeBg: "bg-sky-50", badgeText: "text-sky-700" },
  { label: "Attendance", value: "94%", detail: "All classes on track", change: "+2.1% vs last month", badgeBg: "bg-emerald-50", badgeText: "text-emerald-700" },
  { label: "Fees", value: "Cleared", detail: "Next due Jan 15", change: "Receipt #34821", badgeBg: "bg-amber-50", badgeText: "text-amber-700" },
];

const schedule = [
  { time: "08:00 - 09:30", course: "Data Structures", room: "Hall B-204", type: "Lecture", instructor: "Dr. Lin" },
  { time: "10:00 - 11:30", course: "Operating Systems", room: "Lab C-310", type: "Lab", instructor: "Prof. Malik" },
  { time: "12:30 - 14:00", course: "Linear Algebra", room: "Hall A-105", type: "Seminar", instructor: "Dr. Ortega" },
  { time: "15:00 - 16:00", course: "Capstone Sync", room: "Innovation Hub", type: "Workshop", instructor: "Capstone Team" },
];

const announcements = [
  { title: "Library opens late for finals week", meta: "Student Affairs • Dec 8" },
  { title: "Career fair registrations close Friday", meta: "Career Services • Dec 10" },
  { title: "Wellness hour added on Thursdays", meta: "Campus Life • Dec 11" },
];

const sidebarItems = [
  { icon: "bx-grid-alt", label: "Dashboard", active: true },
  { icon: "bx-injection", label: "Vaccination" },
  { icon: "bx-user-check", label: "Advising" },
  { icon: "bx-time-five", label: "Class Schedule" },
  { icon: "bx-file", label: "Grade Report" },
  { icon: "bx-log-out-circle", label: "Semester Drop" },
  { icon: "bx-book-bookmark", label: "Curriculumn" },
  { icon: "bx-spreadsheet", label: "Accounts Ledger" },
  { icon: "bx-book-open", label: "Offered Courses" },
  { icon: "bx-receipt", label: "Degree Review" },
  { icon: "bx-star", label: "Faculty Evaluation" },
  { icon: "bx-conversation", label: "Convocation" },
];

export default function StudentDashboard() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [enrolledSemester, setEnrolledSemester] = useState("");

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

      if (error || !data?.id) {
        console.error("Error fetching user data:", error);
        setEnrolledSemester("Not enrolled");
        return;
      }

      const userId = data.id;

      // Now get enrolled_at via students
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("enrolled_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (studentError || !studentData?.enrolled_at) {
        console.error("Failed to fetch enrolled semester id", studentError);
        setEnrolledSemester("Not enrolled");
        return;
      }

      const { data: semesterData, error: semesterError } = await supabase
        .from("semesters")
        .select("name")
        .eq("id", studentData.enrolled_at)
        .maybeSingle();

      if (semesterError || !semesterData?.name) {
        console.error("Failed to fetch semester name", semesterError);
        setEnrolledSemester("Not enrolled");
        return;
      }

      setEnrolledSemester(semesterData.name);
    }

    loadSemesterName();
  }, []);

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
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header with Profile */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
            <div className="flex items-center gap-4">
              <UserProfile onUserDataFetch={() => {}} />
              <button className="relative">
                <i className="bx bx-bell text-2xl text-slate-600"></i>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
              </button>
            </div>
          </div>

          {/* Hero Section */}
          <div className="bg-gradient-to-r from-menuBg via-brandButton to-menuBg rounded-3xl p-8 mb-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute right-0 top-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-white rounded-full translate-y-1/2"></div>
            </div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold mb-2 text-blue-200">Welcome, Md. Rashid</p>
                <h2 className="text-3xl font-bold mb-1">Department of CSE</h2>
                <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mt-4">
                  <span className="text-sm font-semibold">BSc. in CSE</span>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 text-center">
                <p className="text-sm text-blue-200 mb-1">Enrolled</p>
                <p className="text-2xl font-bold">{enrolledSemester || "Loading..."}</p>
                <p className="text-xs text-blue-200 mt-3">CGPA</p>
                <p className="text-4xl font-bold mt-1">3.86</p>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Main Stats and Content */}
            <div className="flex-1">
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
            </div>

            {/* Right Sidebar - Schedule and Announcements */}
            <div className="w-96 space-y-6">
              {/* Today's Schedule */}
              <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brandButton">Today</p>
                    <h3 className="text-xl font-bold text-slate-900">Schedule</h3>
                  </div>
                  <button className="text-xs font-semibold text-brandButton hover:text-menuHover">View week</button>
                </div>
                <div className="space-y-3">
                  {schedule.map((block) => (
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
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brandButton">{block.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
      </main>
    </div>
  );
}
