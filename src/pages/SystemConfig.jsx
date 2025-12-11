import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function SystemConfig() {
  const [config, setConfig] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    current_semester_id: "",
    advising_start_date: "",
    advising_end_date: "",
    add_drop_deadline: "",
    grade_submission_deadline: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // Fetch semesters
    const { data: semesterData } = await supabase
      .from("semesters")
      .select("*")
      .order("id", { ascending: false });
    setSemesters(semesterData || []);

    // Fetch current config
    const { data: configData, error } = await supabase
      .from("system_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching config:", error);
    }

    if (configData) {
      setConfig(configData);
      setFormData({
        current_semester_id: configData.current_semester_id?.toString() || "",
        advising_start_date: configData.advising_start_date ? new Date(configData.advising_start_date).toISOString().slice(0, 16) : "",
        advising_end_date: configData.advising_end_date ? new Date(configData.advising_end_date).toISOString().slice(0, 16) : "",
        add_drop_deadline: configData.add_drop_deadline ? new Date(configData.add_drop_deadline).toISOString().slice(0, 16) : "",
        grade_submission_deadline: configData.grade_submission_deadline ? new Date(configData.grade_submission_deadline).toISOString().slice(0, 16) : "",
      });
    }

    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser();
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("email", user?.email)
      .maybeSingle();

    const payload = {
      current_semester_id: parseInt(formData.current_semester_id),
      advising_start_date: formData.advising_start_date || null,
      advising_end_date: formData.advising_end_date || null,
      add_drop_deadline: formData.add_drop_deadline || null,
      grade_submission_deadline: formData.grade_submission_deadline || null,
      updated_at: new Date().toISOString(),
      updated_by: userData?.id || null,
    };

    const { error } = await supabase
      .from("system_config")
      .upsert({ id: 1, ...payload });

    if (error) {
      alert("Error saving config: " + error.message);
    } else {
      alert("Configuration saved successfully!");
      fetchData();
    }

    setSaving(false);
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  const currentSemesterName = semesters.find(
    (s) => s.id === parseInt(formData.current_semester_id)
  )?.name;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6 flex items-center justify-center">
        <div className="text-slate-600 text-lg">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">System Configuration</h1>
          <p className="text-slate-600">Manage global system settings</p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-xl p-8 space-y-8">
          {/* Current Semester */}
          <div className="border-b border-slate-200 pb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="bx bx-calendar text-brandButton"></i>
              Academic Semester
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Current Semester <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.current_semester_id}
                onChange={(e) => handleChange("current_semester_id", e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brandButton focus:border-transparent text-base"
              >
                <option value="">Select Current Semester</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                  </option>
                ))}
              </select>
              {currentSemesterName && (
                <p className="mt-2 text-sm text-slate-600">
                  Active semester: <span className="font-semibold text-brandButton">{currentSemesterName}</span>
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                This semester will be used for enrollment, class schedules, and student dashboards.
              </p>
            </div>
          </div>

          {/* Advising Window */}
          <div className="border-b border-slate-200 pb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="bx bx-edit text-brandButton"></i>
              Advising Window
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Advising Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.advising_start_date}
                  onChange={(e) => handleChange("advising_start_date", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brandButton focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">When students can begin course enrollment</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Advising End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.advising_end_date}
                  onChange={(e) => handleChange("advising_end_date", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brandButton focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">When advising period closes</p>
              </div>
            </div>
          </div>

          {/* Deadlines */}
          <div className="border-b border-slate-200 pb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="bx bx-time text-brandButton"></i>
              Important Deadlines
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Add/Drop Deadline
                </label>
                <input
                  type="datetime-local"
                  value={formData.add_drop_deadline}
                  onChange={(e) => handleChange("add_drop_deadline", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brandButton focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">Last date for students to add/drop courses</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Grade Submission Deadline
                </label>
                <input
                  type="datetime-local"
                  value={formData.grade_submission_deadline}
                  onChange={(e) => handleChange("grade_submission_deadline", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brandButton focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-500">Deadline for faculty to submit final grades</p>
              </div>
            </div>
          </div>

          {/* Last Updated Info */}
          {config && (
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              <p>
                <span className="font-semibold">Last updated:</span>{" "}
                {config.updated_at ? new Date(config.updated_at).toLocaleString() : "Never"}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={fetchData}
              className="flex-1 py-3 px-6 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-6 rounded-lg bg-brandButton text-white font-semibold hover:bg-menuHover disabled:opacity-50 transition shadow-lg"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
