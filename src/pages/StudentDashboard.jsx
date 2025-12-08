import { supabase } from "../supabase";

const stats = [
  { label: "Current GPA", value: "3.82", detail: "Excellent standing", change: "+0.12 this term", badgeBg: "bg-rose-50", badgeText: "text-rose-700" },
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

const tasks = [
  { title: "Submit Lab 4", course: "Algorithms", due: "Today • 11:59 PM", progress: 70 },
  { title: "Read Ch. 6", course: "Operating Systems", due: "Tomorrow • 6:00 PM", progress: 45 },
  { title: "Capstone outline", course: "CS499", due: "Dec 12", progress: 25 },
];

const announcements = [
  { title: "Library opens late for finals week", meta: "Student Affairs • Dec 8" },
  { title: "Career fair registrations close Friday", meta: "Career Services • Dec 10" },
  { title: "Wellness hour added on Thursdays", meta: "Campus Life • Dec 11" },
];

const quickActions = [
  { label: "Join live class", href: "#", color: "from-rose-500 to-orange-500" },
  { label: "View courses", href: "#", color: "from-sky-500 to-cyan-500" },
  { label: "Download ID", href: "#", color: "from-emerald-500 to-lime-500" },
];

const resources = [
  { title: "Attendance report", badge: "PDF", action: "Download" },
  { title: "Academic calendar", badge: "Update", action: "View" },
  { title: "Payment portal", badge: "Finance", action: "Open" },
];

export default function StudentDashboard() {
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#ffe4e6,transparent_35%),radial-gradient(circle_at_80%_0%,#e0f2fe,transparent_25%),linear-gradient(180deg,#f9fafb,#fff)]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-600">Student Portal</p>
            <h1 className="text-3xl font-semibold text-slate-900">Welcome back, Student</h1>
            <p className="text-slate-500">Friday, Dec 8 • Eastern Web University</p>
          </div>

          <div className="flex items-center gap-3 self-start">
            <button className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-transform">
              Notifications
            </button>
            <button
              onClick={logout}
              className="rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(244,63,94,0.35)] hover:shadow-[0_18px_38px_rgba(244,63,94,0.4)] hover:-translate-y-0.5 transition"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
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

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.09)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Today</p>
                <h2 className="text-xl font-semibold text-slate-900">Schedule</h2>
              </div>
              <button className="text-sm font-semibold text-rose-600 hover:text-rose-700">View week</button>
            </div>

            <div className="mt-4 space-y-3">
              {schedule.map((block) => (
                <div
                  key={block.time + block.course}
                  className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{block.time}</p>
                      <p className="text-lg font-semibold text-slate-900">{block.course}</p>
                      <p className="text-sm text-slate-500">{block.instructor}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{block.room}</span>
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">{block.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-900">Quick actions</h3>
              <div className="mt-4 space-y-3">
                {quickActions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`flex items-center justify-between rounded-2xl bg-gradient-to-r ${action.color} px-4 py-3 text-white shadow-[0_16px_32px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5`}
                  >
                    <span className="text-sm font-semibold">{action.label}</span>
                    <span className="text-lg">→</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-900">Resources</h3>
              <div className="mt-4 space-y-3">
                {resources.map((item) => (
                  <div key={item.title} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.badge}</p>
                    </div>
                    <button className="text-xs font-semibold text-rose-600 hover:text-rose-700">{item.action}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Tasks</h3>
              <button className="text-xs font-semibold text-rose-600">View all</button>
            </div>
            <div className="mt-4 space-y-4">
              {tasks.map((task) => (
                <div key={task.title} className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.course} • {task.due}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{task.progress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Announcements</h3>
              <button className="text-xs font-semibold text-rose-600">All</button>
            </div>
            <div className="mt-4 space-y-3">
              {announcements.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.meta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-900">Support</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Need help with enrollment, payments, or tech? Reach out to the student support desk.</p>
              <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                <p className="font-semibold text-slate-900">Live chat</p>
                <p className="text-xs text-slate-500">Weekdays 8 AM - 7 PM</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                <p className="font-semibold text-slate-900">helpdesk@ewu.edu</p>
                <p className="text-xs text-slate-500">We reply within one business day</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
