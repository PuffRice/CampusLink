import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function FacultyClassSchedule() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const [officeHours, setOfficeHours] = useState([]);
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [ohDays, setOhDays] = useState([]);
  const [ohStart, setOhStart] = useState("");
  const [ohEnd, setOhEnd] = useState("");
  const [facultyInfo, setFacultyInfo] = useState({ full_name: "", position: "", email: "", department_name: "" });
  const [hoveredOfficeHourId, setHoveredOfficeHourId] = useState(null);

  useEffect(() => {
    fetchClassSchedule();
    fetchOfficeHours();
  }, []);

  const baseDayNames = { S: "Sun", M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri" };

  function getDaysForSlot(daySlot) {
    if (!daySlot) return [];

    const combos = {
      ST: ["Sun", "Tue"],
      SR: ["Sun", "Thu"],
      SM: ["Sun", "Mon"],
      MT: ["Mon", "Tue"],
      MW: ["Mon", "Wed"],
      MR: ["Mon", "Thu"],
      TW: ["Tue", "Wed"],
      TR: ["Tue", "Thu"],
      WR: ["Wed", "Thu"],
    };

    if (combos[daySlot]) return combos[daySlot];

    const days = [];
    for (const ch of daySlot.split("")) {
      const name = baseDayNames[ch];
      if (name && !days.includes(name)) days.push(name);
    }
    return days;
  }

  function toMinutes(timeStr) {
    if (!timeStr) return null;
    const trimmed = timeStr.trim();
    if (/AM|PM$/i.test(trimmed)) {
      const [time, rawPeriod] = trimmed.split(" ");
      const period = rawPeriod.toUpperCase();
      const [hours, minutes] = time.split(":").map(Number);
      let hour24 = hours;
      if (period === "PM" && hours !== 12) hour24 += 12;
      if (period === "AM" && hours === 12) hour24 = 0;
      return hour24 * 60 + minutes;
    }
    const [hours24, minutes24] = trimmed.split(":").map(Number);
    if (Number.isFinite(hours24) && Number.isFinite(minutes24)) return hours24 * 60 + minutes24;
    return null;
  }

  const slots = [
    { label: "8:30 - 10:00", start: toMinutes("8:30"), end: toMinutes("10:00") },
    { label: "10:10 - 11:40", start: toMinutes("10:10"), end: toMinutes("11:40") },
    { label: "11:50 - 1:20", start: toMinutes("11:50"), end: toMinutes("13:20") },
    { label: "1:30 - 3:00", start: toMinutes("13:30"), end: toMinutes("15:00") },
    { label: "3:00 - 4:40", start: toMinutes("15:00"), end: toMinutes("16:40") },
    { label: "4:50 - 6:20", start: toMinutes("16:50"), end: toMinutes("18:20") },
    { label: "6:30 - 7:50", start: toMinutes("18:30"), end: toMinutes("19:50") },
  ];

  function buildTable(classesArray, officeHoursArray) {
    const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu"];

    const officeItems = officeHoursArray.map((oh) => ({
      id: `oh-${oh.id}`,
      course: "Office Hour",
      room: "",
      day: normalizeDay(oh.day),
      startMin: parseHMToMinutes(oh.start_time),
      endMin: parseHMToMinutes(oh.end_time),
      section: null,
      isOfficeHour: true,
    }));

    const allItems = [...classesArray, ...officeItems];

    return dayOrder.map((day) => {
      const dayItems = allItems.filter((c) => (c.isOfficeHour ? [c.day] : getDaysForSlot(c.day)).includes(day));
      const used = new Set();
      const cells = [];
      let i = 0;

      while (i < slots.length) {
        const slot = slots[i];
        const item = dayItems.find((c) => {
          const key = `${c.id || c.course}-${c.startMin}-${c.endMin}-${c.day}`;
          return !used.has(key) && c.startMin < slot.end && c.endMin > slot.start;
        });

        if (item) {
          let span = 0;
          while (
            i + span < slots.length &&
            item.startMin < slots[i + span].end &&
            item.endMin > slots[i + span].start
          ) {
            span++;
          }
          const key = `${item.id || item.course}-${item.startMin}-${item.endMin}-${item.day}`;
          used.add(key);
          cells.push({ type: "class", colSpan: span, content: item });
          i += span;
        } else {
          cells.push({ type: "empty", colSpan: 1 });
          i += 1;
        }
      }

      return { day, cells };
    });
  }

  async function fetchClassSchedule() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setLoading(false);
        return;
      }

      // Fetch only id to avoid RLS issues; enrich info separately without blocking
      const { data: userIdRow, error: userIdErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (userIdErr || !userIdRow?.id) {
        setLoading(false);
        return;
      }

      // Try to fetch additional optional fields from related tables; ignore errors to not block schedule
      try {
        // users table: email and name
        const { data: userInfo } = await supabase
          .from("users")
          .select("full_name, email")
          .eq("email", user.email)
          .single();

        // faculty table: designation and dept_id (assuming relation via users.id)
        const { data: facultyInfoRow } = await supabase
          .from("faculty")
          .select("designation, dept_id, departments:dept_id(name)")
          .eq("user_id", userIdRow.id)
          .single();

        const department_name = facultyInfoRow?.departments?.name || "";

        setFacultyInfo({
          full_name: userInfo?.full_name || "",
          position: facultyInfoRow?.designation || "",
          email: userInfo?.email || user.email || "",
          department_name,
        });
      } catch (_) {
        setFacultyInfo({ full_name: "", position: "", email: user.email || "", department_name: "" });
      }

      const { data: courseClasses, error: classError } = await supabase
        .from("course_classes")
        .select(`
          *,
          courses:course_id (course_code, name)
        `)
        .eq("faculty_id", userIdRow.id);

      if (classError || !courseClasses) {
        setLoading(false);
        return;
      }

      const classesArray = courseClasses
        .map((cls) => {
          if (!cls.time_slot || !cls.day_slot) return null;
          const [startStr, endStr] = cls.time_slot.split(" - ");
          const startMin = toMinutes(startStr);
          const endMin = toMinutes(endStr);
          return {
            course: cls.courses?.course_code || "Course",
            name: cls.courses?.name || "",
            room: cls.room_no || "TBA",
            day: cls.day_slot,
            startMin,
            endMin,
            section: cls.section,
          };
        })
        .filter(Boolean);

      setClasses(classesArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching faculty class schedule:", err);
      setLoading(false);
    }
  }

  async function fetchOfficeHours() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) return;
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (!userData?.id) return;
      const { data } = await supabase
        .from("office_hours")
        .select("*")
        .eq("faculty_id", userData.id)
        .order("day")
        .order("start_time");
      console.log("Office hours fetched:", data);
      setOfficeHours(data || []);
    } catch (err) {
      console.error("Error fetching office hours:", err);
    }
  }

  function parseHMToMinutes(hm) {
    const [h, m] = hm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function formatHM(minutes) {
    if (!minutes && minutes !== 0) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  function normalizeDay(day) {
    // Normalize to title case: sun -> Sun, mon -> Mon, etc.
    return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
  }

  function hasClash(day, startHM, endHM) {
    const startMin = parseHMToMinutes(startHM);
    const endMin = parseHMToMinutes(endHM);
    const dayClasses = classes.filter(c => getDaysForSlot(c.day).includes(day));
    for (const cls of dayClasses) {
      // overlap if start < cls.end && end > cls.start
      if (startMin < cls.endMin && endMin > cls.startMin) return true;
    }
    const dayOffice = officeHours.filter(oh => normalizeDay(oh.day) === day);
    for (const oh of dayOffice) {
      const ohStart = parseHMToMinutes(oh.start_time);
      const ohEnd = parseHMToMinutes(oh.end_time);
      if (startMin < ohEnd && endMin > ohStart) return true;
    }
    return false;
  }

  async function addOfficeHours() {
    if (!ohStart || !ohEnd || ohDays.length === 0) {
      alert("Please select days and both start/end times.");
      return;
    }
    const startMinCheck = parseHMToMinutes(ohStart);
    const endMinCheck = parseHMToMinutes(ohEnd);
    if (endMinCheck <= startMinCheck) {
      alert("End time must be later than start time.");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) return;
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (!userData?.id) return;

      // validate clashes per day
      for (const d of ohDays) {
        if (hasClash(d, ohStart, ohEnd)) {
          alert(`Clash detected on ${d} between ${ohStart}-${ohEnd}. Adjust times.`);
          return;
        }
      }

      const rows = ohDays.map(d => ({
        faculty_id: userData.id,
        day: d,
        start_time: ohStart,
        end_time: ohEnd,
      }));
      const { error } = await supabase.from("office_hours").insert(rows);
      if (error) {
        console.error("Insert office hours error:", error);
        alert("Failed to add office hours");
        return;
      }
      setShowOfficeModal(false);
      setOhDays([]);
      setOhStart("");
      setOhEnd("");
      fetchOfficeHours();
    } catch (err) {
      console.error("Add office hours exception:", err);
      alert("Unexpected error adding office hours");
    }
  }

  async function deleteOfficeHour(id) {
    if (!window.confirm("Delete this office hour?")) return;
    const { error } = await supabase.from("office_hours").delete().eq("id", id);
    if (error) {
      alert("Failed to delete office hour");
      return;
    }
    fetchOfficeHours();
  }

  if (loading) return <div className="p-6">Loading...</div>;

  const dayRows = classes.length > 0 || officeHours.length > 0 ? buildTable(classes, officeHours) : [];

  return (
    <>
      <style>{`
/* ===============================
   SCREEN (DEFAULT)
   =============================== */
.print-header {
  display: none;
}

/* ===============================
   PRINT (ONLY THIS ONE)
   =============================== */
@media print {

  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  html, body {
    margin: 0;
    padding: 0;
    height: auto;
    background: white;
  }

  /* Hide EVERYTHING by default */
  body * {
    visibility: hidden !important;
  }

  /* Show ONLY printable content */
  .print-schedule,
  .print-schedule * {
    visibility: visible !important;
  }

  /* Remove layout impact of hidden content */
  body {
    overflow: hidden;
  }

  /* Printable container */
  .print-schedule {
    position: absolute;
    top: 0;
    left: 0;
      zoom: 0.9;


    width: 100%;
    max-width: none;

    margin: 0;
    padding: 0;

    background: white;
    box-shadow: none;
    border-radius: 0;
  }

  /* ===============================
   SCALE TABLE TO FIT ONE PAGE
   =============================== */
.print-schedule table {
  transform: scale(0.9);
  transform-origin: top center;
}


  /* ===============================
     HEADER (THIS WAS MISSING)
     =============================== */
  .print-header {
    display: block !important;
    text-align: center;
    margin-bottom: 6px;
    line-height: 1.2;
  }

  .print-header div:nth-child(1) {
    font-size: 18px;
    font-weight: 800;
  }

  .print-header div {
    font-size: 11px;
  }

  /* ===============================
     TABLE
     =============================== */
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    page-break-inside: avoid;
  }

  thead {
    display: table-header-group;
  }

  th, td {
    border: 1.2px solid #999;
    padding: 6px;
    font-size: 10.5px;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
  }

  th {
    background: #8B3A3A !important;
    color: white !important;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Day column */
  th:first-child,
  td:first-child {
    width: 80px;
    font-weight: bold;
  }

  /* Slot columns */
  th:not(:first-child),
  td:not(:first-child) {
    width: calc((100% - 80px) / 7);
  }

  /* Office hour highlight */
  .office-hour-cell {
    background: #f0e5e5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  tr {
    page-break-inside: avoid;
  }
}
`}</style>

      <div className="p-8 bg-gray-50 min-h-screen print\:p-0 print\:bg-white print\:min-h-0">
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Class Schedule</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 flex items-center gap-2">
            <i className="bx bx-printer"></i>
            <span>Print</span>
          </button>
          <button onClick={() => setShowOfficeModal(true)} className="px-4 py-2 bg-[#8B3A3A] text-white rounded-lg font-semibold hover:bg-[#6B2A2A]">Add Office Hours</button>
        </div>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm print-schedule print\:bg-white print\:shadow-none print\:rounded-none print\:m-0 print\:p-0">
        <div className="print-header grid grid-cols-1 gap-1 mb-3 text-center">
          <div className="font-extrabold text-xl">Class Schedule and Office Hours</div>
          <div className="text-sm">{facultyInfo.full_name || 'Faculty Name'}</div>
          <div className="text-xs">{facultyInfo.position || 'Position'}</div>
          <div className="text-xs">{facultyInfo.email || 'email@example.com'}</div>
          <div className="text-xs">{facultyInfo.department_name ? `Department of ${facultyInfo.department_name}` : 'Department of _______'}</div>
          <div className="text-xs">East West University</div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#8B3A3A]">
              <th className="px-6 py-4 text-left font-semibold text-white border-b-2 border-[#8B3A3A]">Day</th>
              {slots.map((slot) => (
                <th key={slot.label} className="px-4 py-3 text-center font-semibold text-white border-b-2 border-[#8B3A3A]">
                  {slot.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayRows.map((row, rowIndex) => (
              <tr
                key={row.day}
                className={`${rowIndex % 2 === 0 ? "bg-white" : "bg-rose-50"} transition-colors duration-150`}
              >
                <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap align-top border-b border-gray-200">
                  {row.day}
                </td>
                {row.cells.map((cell, idx) => {
                  const isOffice = cell.type === "class" && cell.content?.isOfficeHour;
                  return (
                    <td
                      key={`${row.day}-${idx}`}
                      colSpan={cell.colSpan}
                      className={`px-4 py-3 text-center align-middle border-b border-l border-gray-200 transition-all duration-150 ${isOffice ? "bg-[#8B3A3A]/30 office-hour-cell" : ""} ${cell.type === "class" ? "cursor-pointer group" : ""}`}
                      onMouseEnter={() => cell.type === "class" && setHoveredCourse(cell.content.course)}
                      onMouseLeave={() => setHoveredCourse(null)}
                    >
                      {cell.type === "class" ? (
                        <div
                          className="flex flex-col items-center justify-center py-2 h-full relative"
                          onMouseEnter={() => isOffice && setHoveredOfficeHourId(cell.content.id)}
                          onMouseLeave={() => isOffice && setHoveredOfficeHourId(null)}
                        >
                          <div className={`font-bold ${isOffice ? "text-[#8B3A3A]" : "text-[#8B3A3A]"} text-base mb-1`}>
                            {isOffice ? "Office Hour" : `${cell.content.course}${cell.content.section ? ` (${cell.content.section})` : ""}`}
                          </div>
                          {!isOffice && (
                            <>
                              <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded group-hover:bg-white transition-colors mb-1">
                                {cell.content.room}
                              </div>
                              <div className="text-xs font-bold text-gray-500 mt-1">{cell.content.timeSlot || (cell.content.startMin !== undefined && cell.content.endMin !== undefined ? `${formatHM(cell.content.startMin)} - ${formatHM(cell.content.endMin)}` : "")}</div>
                            </>
                          )}
                          {isOffice && (
                            <>
                              <div className="text-xs font-bold text-gray-700 bg-white/60 px-2 py-1 rounded">
                                {formatHM(cell.content.startMin)} - {formatHM(cell.content.endMin)}
                              </div>
                              {hoveredOfficeHourId === cell.content.id && (
                                <button
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 transition"
                                  title="Delete office hour"
                                  onClick={() => deleteOfficeHour(cell.content.id.replace('oh-', ''))}
                                >
                                  ×
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showOfficeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Add Office Hours</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                  <input type="time" value={ohStart} onChange={e => setOhStart(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Time *</label>
                  <input type="time" value={ohEnd} onChange={e => setOhEnd(e.target.value)} className="w-full p-2 border rounded" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Days *</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri'].map(d => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={ohDays.includes(d)} onChange={() => setOhDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d])} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowOfficeModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={addOfficeHours} className="px-4 py-2 bg-[#8B3A3A] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
