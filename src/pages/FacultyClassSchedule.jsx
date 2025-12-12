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

  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")}${period}`;
  }

  function generateRoutineTable(classesArray, officeHoursArray) {
    const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu"];
    const days = dayOrder;

    // Convert office hours into same format as classes
    const officeItems = officeHoursArray.map(oh => ({
      course: "Office Hour",
      room: "",
      day: normalizeDay(oh.day),
      startMin: parseHMToMinutes(oh.start_time),
      endMin: parseHMToMinutes(oh.end_time),
      section: null,
      isOfficeHour: true,
    }));

    const allItems = [...classesArray, ...officeItems];

    let allTimes = [];
    allItems.forEach((c) => {
      allTimes.push(c.startMin);
      allTimes.push(c.endMin);
    });
    allTimes = [...new Set(allTimes)].sort((a, b) => a - b);

    const rows = [];
    const occupied = {};

    for (let i = 0; i < allTimes.length - 1; i++) {
      const start = allTimes[i];
      const row = {
        timeSlot: `${formatTime(start)} - ${formatTime(allTimes[i + 1])}`,
        cells: {},
      };

      days.forEach((d) => {
        if (occupied[`${i}-${d}`]) {
          row.cells[d] = undefined;
          return;
        }

        const item = allItems.find((c) => {
          const itemDays = c.isOfficeHour ? [c.day] : getDaysForSlot(c.day);
          const isDayMatch = itemDays.includes(d);
          const isStartRow = c.startMin === start;
          return isDayMatch && isStartRow;
        });

        if (item) {
          let span = 0;
          for (let k = i; k < allTimes.length - 1; k++) {
            if (allTimes[k] >= item.endMin) break;
            span++;
          }
          row.cells[d] = { content: item, rowSpan: span };
          for (let k = i + 1; k < i + span; k++) occupied[`${k}-${d}`] = true;
        } else {
          row.cells[d] = null;
        }
      });

      rows.push(row);
    }
    return { rows, days };
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

  if (loading) return <div className="p-6">Loading...</div>;

  if (classes.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Weekly Class Schedule</h1>
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
          <p>No classes scheduled yet.</p>
        </div>
      </div>
    );
  }

  const { rows, days } = generateRoutineTable(classes, officeHours);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          /* Hide everything by default via visibility, then re-show our section */
          body * { visibility: hidden !important; }
          .print-schedule, .print-schedule * { visibility: visible !important; }
          .print-header { display: block !important; }
          .print-schedule { position: static; width: 100%; max-width: 1000px; padding: 0; margin: 0 auto; }
          /* Remove visual styles that can cause overflow/misalignment in print */
          .print-schedule .shadow-sm, .print-schedule .rounded-lg { box-shadow: none !important; border-radius: 0 !important; }
          .print-schedule .bg-white { background: transparent !important; }
          /* Avoid table breaking and extra blank pages */
          .print-schedule table { page-break-inside: avoid; width: 100%; border-collapse: collapse; margin: 0 auto; }
          .print-schedule { page-break-after: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          /* Compact table to fit a single page */
          .print-schedule th, .print-schedule td { padding: 6px !important; font-size: 11px !important; }
        }
        /* Hide print header on screen */
        .print-header { display: none; }
        /* Optional: keep table styles consistent */
        @media print {
          .print-schedule table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-schedule th, .print-schedule td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            text-align: center;
          }
          .print-schedule th {
            background-color: #8B3A3A !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-schedule .office-hour-cell {
            background-color: #f0e5e5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="p-8 bg-gray-50 min-h-screen">
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
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm print-schedule">
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
              <th className="px-6 py-4 text-left font-semibold text-white border-b-2 border-[#8B3A3A]">Time</th>
              {days.map((day) => (
                <th key={day} className="px-6 py-4 text-center font-semibold text-white border-b-2 border-[#8B3A3A]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const hasHoveredCourse = hoveredCourse && days.some((day) => {
                const cell = row.cells[day];
                return cell?.content?.course === hoveredCourse;
              });

              return (
                <tr
                  key={rowIndex}
                  className={`${rowIndex % 2 === 0 ? "bg-white" : "bg-rose-50"} ${hasHoveredCourse ? "bg-rose-100" : ""} transition-colors duration-150`}
                >
                  <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap align-top border-b border-gray-200">
                    {row.timeSlot}
                  </td>
                  {days.map((day) => {
                    const cell = row.cells[day];
                    if (cell === undefined) return null;

                    return (
                      <td
                        key={`${rowIndex}-${day}`}
                        className={`px-4 py-3 text-center align-middle border-b border-l border-gray-200 transition-all duration-150 ${cell?.content?.isOfficeHour ? "bg-[#8B3A3A]/30 office-hour-cell" : ""} ${cell?.content ? "cursor-pointer group" : ""}`}
                        rowSpan={cell?.rowSpan || 1}
                        onMouseEnter={() => cell?.content && setHoveredCourse(cell.content.course)}
                        onMouseLeave={() => setHoveredCourse(null)}
                      >
                        {cell?.content ? (
                          cell.content.isOfficeHour ? (
                            <div className="flex flex-col items-center justify-center py-2 h-full">
                              <div className="font-bold text-[#8B3A3A] text-base">Office Hour</div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 h-full">
                              <div className="font-bold text-[#8B3A3A] text-base mb-1">{cell.content.course}</div>
                              <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded group-hover:bg-white transition-colors mb-1">
                                {cell.content.room}
                              </div>
                              {cell.content.section && (
                                <span className="text-[11px] font-semibold text-gray-700 bg-rose-100 px-2 py-1 rounded-full">
                                  Sec {cell.content.section}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
