import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function GradeReport() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState([]);
  const [cgpa, setCgpa] = useState(null);
  const [totalCredits, setTotalCredits] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReport();
  }, []);

  async function fetchReport() {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setError("Not authenticated"); setLoading(false); return; }

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (userErr || !userRow?.id) { setError("Unable to resolve user"); setLoading(false); return; }

      // Current semester from system_config
      const { data: cfg } = await supabase
        .from("system_config")
        .select("current_semester_id")
        .eq("id", 1)
        .maybeSingle();
      let currentSemesterId = cfg?.current_semester_id || null;
      if (!currentSemesterId) {
        const { data: latest } = await supabase
          .from("semesters")
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentSemesterId = latest?.id || null;
      }

      // Fetch enrollments with all available fields
      const { data: enrollments, error: enrollErr } = await supabase
        .from("enrollments")
        .select(`
          id, grade, class_id,
          course_classes:class_id (
            semester_id,
            courses:course_id (course_code, name, credit)
          )
        `)
        .eq("student_id", userRow.id);
      if (enrollErr) { setError(enrollErr.message); setLoading(false); return; }

      // Exclude current semester
      const filtered = (enrollments || []).filter(e => {
        const semId = e?.course_classes?.semester_id;
        return semId && semId !== currentSemesterId;
      });

      // Collect semester ids
      const semIds = Array.from(new Set(filtered.map(e => e.course_classes.semester_id)));
      let semesterNamesMap = {};
      if (semIds.length > 0) {
        const { data: semRows } = await supabase
          .from("semesters")
          .select("id, name")
          .in("id", semIds);
        semesterNamesMap = Object.fromEntries((semRows || []).map(s => [s.id, s.name]));
      }

      // Group by semester
      const bySemester = {};
      for (const e of filtered) {
        const semId = e.course_classes.semester_id;
        const course = e.course_classes?.courses || {};
        const gradePoint = typeof e.grade === "number" ? e.grade : (parseFloat(e.grade) || 0);
        const credits = e.course_classes?.courses?.credit || 0;
        const gp = gradePoint * credits; // gp = grade point * credits

        if (!bySemester[semId]) {
          bySemester[semId] = {
            semester_id: semId,
            semester_name: semesterNamesMap[semId] || `Semester ${semId}`,
            courses: [],
            _totalGp: 0,
            _totalCredits: 0,
          };
        }

        bySemester[semId].courses.push({
          code: course.course_code || "",
          name: course.name || "",
          credits,
          gradePoint,
          gp,
        });
        bySemester[semId]._totalGp += gp;
        bySemester[semId]._totalCredits += credits;
      }

      // Compute semester GPA and cumulative CGPA up to each semester
      let cumulativeGp = 0;
      let cumulativeCredits = 0;
      const reportData = Object.values(bySemester)
        .sort((a, b) => a.semester_id - b.semester_id)
        .map(s => {
          const semesterGpa = s._totalCredits > 0 ? s._totalGp / s._totalCredits : null;
          cumulativeGp += s._totalGp;
          cumulativeCredits += s._totalCredits;
          const cumulativeCgpa = cumulativeCredits > 0 ? cumulativeGp / cumulativeCredits : null;
          return {
            semester_id: s.semester_id,
            semester_name: s.semester_name,
            courses: s.courses,
            semesterCredits: s._totalCredits,
            semesterGPA: semesterGpa,
            cumulativeCGPA: cumulativeCgpa,
            isDeanList: semesterGpa !== null && semesterGpa >= 3.8,
          };
        });

      // Compute overall CGPA (same as last semester's cumulative CGPA)
      let totalGp = 0;
      let totalCredits = 0;
      reportData.forEach(sem => {
        sem.courses.forEach(c => {
          totalGp += c.gp;
          totalCredits += c.credits;
        });
      });
      const cg = totalCredits > 0 ? totalGp / totalCredits : null;

      setReport(reportData);
      setCgpa(cg);
      setTotalCredits(totalCredits);
    } catch (err) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Generating grade report...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Grade Report</h1>
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 flex items-center gap-2">
          <i className="bx bx-printer"></i>
          <span>Print</span>
        </button>
      </div>

      {report.length === 0 ? (
        <div className="bg-white rounded-lg p-6 border border-slate-200">No past semesters found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {report.map((sem) => (
            <section key={sem.semester_id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">{sem.semester_name}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border">Course</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border">Title of the Course</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 border">cr</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 border">gr</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 border">gp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sem.courses.map((c, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-2 text-slate-900">{c.code}</td>
                        <td className="px-3 py-2 text-slate-900">{c.name}</td>
                        <td className="px-3 py-2 text-center text-slate-900">{c.credits > 0 ? c.credits.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-900">{c.gradePoint > 0 ? c.gradePoint.toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-900">{c.gp > 0 ? c.gp.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Credits</p>
                  <p className="text-xl font-bold text-slate-900">{sem.semesterCredits > 0 ? sem.semesterCredits.toFixed(1) : "—"}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                  <p className="text-xs text-blue-600 mb-1">CGPA</p>
                  <p className="text-xl font-bold text-blue-900">{sem.cumulativeCGPA?.toFixed(2) || "—"}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
                  <p className="text-xs text-emerald-600 mb-1">Term GPA</p>
                  <p className="text-xl font-bold text-emerald-900">{sem.semesterGPA?.toFixed(2) || "—"}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-sm space-y-4">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300">
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1">CGPA</p>
              <p className="text-2xl font-bold text-slate-900">{cgpa !== null ? cgpa.toFixed(2) : "—"}</p>
              <p className="text-xs text-slate-500 mt-1">(out of 4.00)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1">Total Credits Earned</p>
              <p className="text-2xl font-bold text-slate-900">{totalCredits.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Minimum Required: 140.00</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              <strong>cr:</strong> course credit | 
              <strong> gr:</strong> grade point | 
              <strong> gp:</strong> Grade Point = gr × cr
            </p>
            <p className="text-xs text-slate-600">
              <strong>Formula:</strong> CGPA = Σgp / Σcr
            </p>
          </div>

          {/* Grade Scale - From Fall 2023 */}
          <div className="pt-2 border-t border-slate-300">
            <p className="font-bold text-xs mb-2">Grading Scale (From Fall 2023)</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p>A+ = 4.0</p>
                <p>A = 3.75</p>
                <p>A- = 3.50</p>
                <p>B+ = 3.25</p>
              </div>
              <div>
                <p>B = 3.00</p>
                <p>B- = 2.75</p>
                <p>C+ = 2.50</p>
                <p>C = 2.25</p>
              </div>
              <div>
                <p>D = 2.0</p>
                <p>F = Fail = 0</p>
                <p>W = Withdrawal = 0</p>
                <p>I = Incomplete = 0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
