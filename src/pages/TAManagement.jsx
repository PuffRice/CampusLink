import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_CODES = { S: "Sun", M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", A: "Sat" };
const DAY_COMBINATIONS = {
  ST: ["Sun", "Tue"], SR: ["Sun", "Thu"], SM: ["Sun", "Mon"], SF: ["Sun", "Fri"],
  MT: ["Mon", "Tue"], MW: ["Mon", "Wed"], MR: ["Mon", "Thu"], MF: ["Mon", "Fri"],
  TW: ["Tue", "Wed"], TR: ["Tue", "Thu"], TF: ["Tue", "Fri"],
  WR: ["Wed", "Thu"], WF: ["Wed", "Fri"], RF: ["Thu", "Fri"],
};

function daysForSlot(daySlot) {
  const key = (daySlot || "").replace(/\s+/g, "").toUpperCase();
  if (DAY_COMBINATIONS[key]) return DAY_COMBINATIONS[key];
  return [...new Set([...key].map((character) => DAY_CODES[character]).filter(Boolean))];
}

function timeToMinutes(value) {
  if (!value) return null;
  const cleaned = value.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function splitTimeSlot(timeSlot) {
  const [start = "", end = ""] = (timeSlot || "").split(/\s*-\s*/);
  return { start, end, startMinutes: timeToMinutes(start), endMinutes: timeToMinutes(end) };
}

function shortTime(value) {
  return value ? value.slice(0, 5) : "";
}

function courseItems(courseClasses, source) {
  return (courseClasses || []).flatMap((courseClass) => {
    const times = splitTimeSlot(courseClass.time_slot);
    return daysForSlot(courseClass.day_slot).map((day) => ({
      id: `${source}-${courseClass.id}-${day}`,
      day,
      source,
      title: courseClass.courses?.course_code || "Course",
      subtitle: `${courseClass.courses?.name || ""}${courseClass.section ? ` · Section ${courseClass.section}` : ""}`,
      location: courseClass.room_no || "Room TBA",
      start: times.start,
      end: times.end,
      startMinutes: times.startMinutes,
      endMinutes: times.endMinutes,
    }));
  });
}

function officeItems(hours) {
  return (hours || []).map((officeHour) => ({
    id: `office-${officeHour.id}`,
    recordId: officeHour.id,
    day: officeHour.day,
    source: "office",
    title: "TA Office Hour",
    subtitle: "Available to students",
    location: officeHour.location || "Location not specified",
    start: shortTime(officeHour.start_time),
    end: shortTime(officeHour.end_time),
    startMinutes: timeToMinutes(officeHour.start_time),
    endMinutes: timeToMinutes(officeHour.end_time),
  }));
}

const SOURCE_STYLES = {
  own: "border-blue-200 bg-blue-50 text-blue-950",
  faculty: "border-violet-200 bg-violet-50 text-violet-950",
  office: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

export default function TAManagement() {
  const [assignment, setAssignment] = useState(null);
  const [facultyInfo, setFacultyInfo] = useState(null);
  const [routine, setRoutine] = useState([]);
  const [officeHours, setOfficeHours] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTAData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userError || !currentUser) {
      setError("Unable to identify the signed-in student.");
      setLoading(false);
      return;
    }

    const { data: currentAssignment, error: assignmentError } = await supabase
      .from("ta_assignments")
      .select("id, student_id, faculty_id, active")
      .eq("student_id", currentUser.id)
      .eq("active", true)
      .maybeSingle();

    if (assignmentError || !currentAssignment) {
      setError("You do not have an active teaching assistant assignment.");
      setLoading(false);
      return;
    }
    setAssignment(currentAssignment);

    const [{ data: config }, facultyUserResult, facultyRecordResult] = await Promise.all([
      supabase.from("system_config").select("current_semester_id").eq("id", 1).maybeSingle(),
      supabase.from("users").select("full_name, email").eq("id", currentAssignment.faculty_id).maybeSingle(),
      supabase.from("faculty").select("faculty_code, designation, office_room").eq("user_id", currentAssignment.faculty_id).maybeSingle(),
    ]);

    setFacultyInfo({
      ...(facultyUserResult.data || {}),
      ...(facultyRecordResult.data || {}),
    });

    const semesterId = config?.current_semester_id;
    const ownCoursesQuery = supabase
      .from("enrollments")
      .select(`class_id, course_classes:class_id (id, section, day_slot, time_slot, room_no, semester_id, courses:course_id (course_code, name))`)
      .eq("student_id", currentUser.id);
    const facultyCoursesQuery = supabase
      .from("course_classes")
      .select(`id, section, day_slot, time_slot, room_no, semester_id, courses:course_id (course_code, name)`)
      .eq("faculty_id", currentAssignment.faculty_id);
    const officeHoursQuery = supabase
      .from("ta_office_hours")
      .select("id, ta_assignment_id, day, start_time, end_time, location")
      .eq("ta_assignment_id", currentAssignment.id)
      .order("day")
      .order("start_time");

    const [ownResult, facultyCoursesResult, officeResult] = await Promise.all([
      ownCoursesQuery,
      facultyCoursesQuery,
      officeHoursQuery,
    ]);
    const firstError = ownResult.error || facultyCoursesResult.error || officeResult.error;
    if (firstError) {
      setError(firstError.message || "Unable to load the TA routine.");
      setLoading(false);
      return;
    }

    const ownClasses = (ownResult.data || [])
      .map((enrollment) => enrollment.course_classes)
      .filter((courseClass) => courseClass && (!semesterId || courseClass.semester_id === semesterId));
    const ownClassIds = new Set(ownClasses.map((courseClass) => courseClass.id));
    const facultyClasses = (facultyCoursesResult.data || [])
      .filter((courseClass) => (!semesterId || courseClass.semester_id === semesterId) && !ownClassIds.has(courseClass.id));
    const fetchedOfficeHours = officeResult.data || [];

    setOfficeHours(fetchedOfficeHours);
    setRoutine([
      ...courseItems(ownClasses, "own"),
      ...courseItems(facultyClasses, "faculty"),
      ...officeItems(fetchedOfficeHours),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(loadTAData, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadTAData]);

  const routineByDay = useMemo(() => {
    return new Map(DAYS.map((day) => [
      day,
      routine
        .filter((item) => item.day === day)
        .sort((left, right) => (left.startMinutes ?? 0) - (right.startMinutes ?? 0)),
    ]));
  }, [routine]);

  function toggleDay(day) {
    setSelectedDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]);
  }

  function hasConflict(day, newStart, newEnd) {
    return routine.some((item) => item.day === day
      && newStart < item.endMinutes
      && newEnd > item.startMinutes);
  }

  async function addOfficeHours(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    if (!assignment || selectedDays.length === 0 || newStart === null || newEnd === null) {
      setError("Choose at least one day and provide both times.");
      return;
    }
    if (newEnd <= newStart) {
      setError("End time must be later than start time.");
      return;
    }

    const conflictDay = selectedDays.find((day) => hasConflict(day, newStart, newEnd));
    if (conflictDay) {
      setError(`The new office hour overlaps an existing routine block on ${conflictDay}.`);
      return;
    }

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("ta_office_hours")
      .insert(selectedDays.map((day) => ({
        ta_assignment_id: assignment.id,
        day,
        start_time: startTime,
        end_time: endTime,
        location: location.trim() || null,
      })))
      .select("id, ta_assignment_id, day, start_time, end_time, location");

    if (insertError) {
      setError(insertError.message || "Unable to add office hours.");
      setSaving(false);
      return;
    }

    const added = data || [];
    setOfficeHours((current) => [...current, ...added]);
    setRoutine((current) => [...current, ...officeItems(added)]);
    setSelectedDays([]);
    setStartTime("");
    setEndTime("");
    setLocation("");
    setNotice("Office hours added to your TA routine.");
    setSaving(false);
  }

  async function deleteOfficeHour(officeHour) {
    if (!window.confirm(`Delete the ${officeHour.day} office hour?`)) return;
    const { error: deleteError } = await supabase
      .from("ta_office_hours")
      .delete()
      .eq("id", officeHour.id);

    if (deleteError) {
      setError(deleteError.message || "Unable to delete the office hour.");
      return;
    }

    setOfficeHours((current) => current.filter((item) => item.id !== officeHour.id));
    setRoutine((current) => current.filter((item) => item.recordId !== officeHour.id));
    setNotice("Office hour removed.");
  }

  if (loading) return <div className="p-8 text-slate-600">Loading TA management...</div>;
  if (!assignment) return <div className="p-8 text-red-700">{error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-brandButton">Teaching Assistant</p>
            <h1 className="text-3xl font-bold text-slate-900">TA Management</h1>
            <p className="mt-1 text-slate-600">
              Assigned to <span className="font-semibold text-slate-900">{facultyInfo?.full_name || "Faculty member"}</span>
              {facultyInfo?.faculty_code ? ` · ${facultyInfo.faculty_code}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">My courses</span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800">Faculty courses</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">Office hours</span>
          </div>
        </div>

        {(error || notice) && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Combined weekly routine</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {DAYS.map((day) => (
              <div key={day} className="min-h-48 rounded-lg bg-slate-50 p-3">
                <h3 className="mb-3 border-b border-slate-200 pb-2 font-bold text-slate-800">{day}</h3>
                <div className="space-y-2">
                  {(routineByDay.get(day) || []).map((item) => (
                    <article key={item.id} className={`rounded-lg border p-3 ${SOURCE_STYLES[item.source]}`}>
                      <p className="text-xs font-bold uppercase tracking-wide">{item.start}–{item.end}</p>
                      <p className="mt-1 text-sm font-bold">{item.title}</p>
                      <p className="mt-1 text-xs opacity-80">{item.subtitle}</p>
                      <p className="mt-2 text-xs font-semibold">{item.location}</p>
                    </article>
                  ))}
                  {(routineByDay.get(day) || []).length === 0 && <p className="text-xs text-slate-400">No scheduled blocks</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={addOfficeHours} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Add office hours</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">The selected slot cannot overlap your courses, your faculty member's courses, or another office hour.</p>

            <div className="mb-4">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Days</span>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedDays.includes(day) ? "border-brandButton bg-brandButton text-white" : "border-slate-300 bg-white text-slate-700"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-700">Start time</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-700">End time</span>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Location (optional)</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room or online link" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>

            <button type="submit" disabled={saving} className="mt-5 rounded-lg bg-brandButton px-5 py-2 font-semibold text-white hover:bg-menuHover disabled:opacity-60">
              {saving ? "Saving..." : "Add office hours"}
            </button>
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">My office hours</h2>
            <div className="mt-4 space-y-3">
              {officeHours.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No TA office hours have been added.</p>
              ) : officeHours.map((officeHour) => (
                <div key={officeHour.id} className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="font-bold text-emerald-950">{officeHour.day} · {shortTime(officeHour.start_time)}–{shortTime(officeHour.end_time)}</p>
                    <p className="text-sm text-emerald-800">{officeHour.location || "Location not specified"}</p>
                  </div>
                  <button type="button" onClick={() => deleteOfficeHour(officeHour)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
