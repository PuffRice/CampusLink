import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ClassSchedule({ onCourseSelect }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [currentSemester, setCurrentSemester] = useState(null);

  useEffect(() => {
    fetchClassSchedule();
    fetchSemesters();
  }, []);

  useEffect(() => {
    if (selectedSemester) {
      fetchClassSchedule();
    }
  }, [selectedSemester]);

  function handleCourseClick(courseCode) {
    if (onCourseSelect) {
      onCourseSelect(courseCode);
    }
  }

  function toMinutes(timeStr) {
    if (!timeStr) return null;
    const trimmed = timeStr.trim();
    // Handle 12-hour format with AM/PM
    if (/AM|PM$/i.test(trimmed)) {
      const [time, rawPeriod] = trimmed.split(" ");
      const period = rawPeriod.toUpperCase();
      const [hours, minutes] = time.split(":").map(Number);
      let hour24 = hours;
      if (period === "PM" && hours !== 12) hour24 += 12;
      if (period === "AM" && hours === 12) hour24 = 0;
      return hour24 * 60 + minutes;
    }
    // Handle 24-hour format (e.g., 13:30)
    const [hours24, minutes24] = trimmed.split(":").map(Number);
    if (Number.isFinite(hours24) && Number.isFinite(minutes24)) {
      return hours24 * 60 + minutes24;
    }
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

  const baseDayNames = { S: "Sun", M: "Mon", T: "Tue", W: "Wed", R: "Thu" };

  function getDaysForSlot(daySlot) {
    if (!daySlot) return [];
    
    // Define combo mappings
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
    
    // Check if it's a known combo
    if (combos[daySlot]) {
      return combos[daySlot];
    }
    
    // Otherwise, process each character
    const days = [];
    for (const ch of daySlot.split("")) {
      const name = baseDayNames[ch];
      if (name && !days.includes(name)) days.push(name);
    }
    return days;
  }

  function buildTable(classesArray) {
    const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu"];
    return dayOrder.map((day) => {
      const dayClasses = classesArray.filter((c) => getDaysForSlot(c.day).includes(day));
      const used = new Set();
      const cells = [];
      let i = 0;

      while (i < slots.length) {
        const slot = slots[i];
        const cls = dayClasses.find((c) => {
          const key = `${c.course}-${c.startMin}-${c.endMin}-${c.day}`;
          return !used.has(key) && c.startMin < slot.end && c.endMin > slot.start;
        });

        if (cls) {
          let span = 0;
          while (
            i + span < slots.length &&
            cls.startMin < slots[i + span].end &&
            cls.endMin > slots[i + span].start
          ) {
            span++;
          }
          const key = `${cls.course}-${cls.startMin}-${cls.endMin}-${cls.day}`;
          used.add(key);
          cells.push({ type: "class", colSpan: span, content: cls });
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

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (userError || !userData) {
        setLoading(false);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("user_id")
        .eq("user_id", userData.id)
        .maybeSingle();
      if (studentError || !studentData) {
        setLoading(false);
        return;
      }

      // Get current semester
      const { data: sysConfig } = await supabase
        .from("system_config")
        .select("current_semester_id")
        .eq("id", 1)
        .maybeSingle();

      const currentSemId = sysConfig?.current_semester_id;
      setCurrentSemester(currentSemId);
      
      // Set selected semester to current semester by default
      if (!selectedSemester && currentSemId) {
        setSelectedSemester(currentSemId);
      }

      const semesterToUse = selectedSemester || currentSemId;

      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          *,
          course_classes:class_id (
            *,
            courses:course_id (*)
          )
        `)
        .eq("student_id", studentData.user_id);
      if (enrollError || !enrollments) {
        setLoading(false);
        return;
      }

      const classesArray = enrollments
        .filter(enrollment => enrollment.course_classes?.semester_id === semesterToUse)
        .map((enrollment) => {
          const courseClass = enrollment.course_classes;
          const course = courseClass?.courses;
          if (!courseClass.time_slot || !courseClass.day_slot) return null;
          const startMin = toMinutes(courseClass.time_slot.split(" - ")[0]);
          const endMin = toMinutes(courseClass.time_slot.split(" - ")[1]);
          return {
            course: course?.course_code || "Unknown",
            room: courseClass.room_no || "TBA",
            day: courseClass.day_slot,
            startMin,
            endMin,
            timeSlot: courseClass.time_slot, // Add this line
          };
        })
        .filter(Boolean);
      setClasses(classesArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching class schedule:", err);
      setLoading(false);
    }
  }

  async function fetchSemesters() {
    try {
      const { data: semesters, error } = await supabase
        .from("semesters")
        .select("id, name")
        .order("id", { ascending: false });

      if (error || !semesters) {
        console.error("Error fetching semesters:", error);
        return;
      }

      setSemesters(semesters);
    } catch (err) {
      console.error("Error fetching semesters:", err);
    }
  }

  const handleSemesterChange = (semesterId) => {
    setSelectedSemester(parseInt(semesterId));
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const dayRows = classes.length > 0 ? buildTable(classes) : [];

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-schedule, .print-schedule * {
            visibility: visible;
          }
          .print-schedule {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-schedule table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-schedule th, .print-schedule td {
            border: 1.25px solid #23336A !important;
            padding: 8px !important;
            text-align: center;
          }
          .print-schedule th {
            background-color: #23336A !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Class Schedule</h1>
        <div className="flex items-center gap-4">
          {semesters.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Semester:</label>
              <select 
                value={selectedSemester || currentSemester || ''}
                onChange={(e) => handleSemesterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 flex items-center gap-2">
            <i className="bx bx-printer"></i>
            <span>Print</span>
          </button>
        </div>
      </div>
      <div className="print-schedule">
        <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>Student Weekly Class Schedule</h2>
      </div>
      {classes.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
          <p>No classes scheduled for this semester.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm print-schedule">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#23336A]">
                <th className="px-6 py-4 text-left font-semibold text-white border-b-2 border-[#23336A]">Day</th>
                {slots.map((slot) => (
                  <th key={slot.label} className="px-4 py-3 text-center font-semibold text-white border-b-2 border-[#23336A]">
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayRows.map((row, rowIndex) => (
                <tr key={row.day} className={`${rowIndex % 2 === 0 ? "bg-white" : "bg-blue-50"} transition-colors duration-150`}>
                  <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap align-top border-b border-gray-200">
                    {row.day}
                  </td>
                  {row.cells.map((cell, idx) => (
                    <td
                      key={`${row.day}-${idx}`}
                      colSpan={cell.colSpan}
                      className={`px-4 py-3 text-center align-middle border-b border-l border-gray-200 transition-all duration-150 ${cell.type === "class" ? "cursor-pointer group" : ""}`}
                      onMouseEnter={() => cell.type === "class" && setHoveredCourse(cell.content.course)}
                      onMouseLeave={() => setHoveredCourse(null)}
                      onClick={() => cell.type === "class" && handleCourseClick(cell.content.course)}
                    >
                      {cell.type === "class" ? (
                        <div className="flex flex-col items-center justify-center py-2 h-full">
                          <div className="font-bold text-[#23336A] text-base mb-1">{cell.content.course}</div>
                          <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded group-hover:bg-white transition-colors">{cell.content.room}</div>
                          <div className="text-xs text-gray-500 mt-1 font-bold">{cell.content.timeSlot || (cell.content.startMin !== undefined && cell.content.endMin !== undefined ? `${formatTime(cell.content.startMin)} - ${formatTime(cell.content.endMin)}` : "")}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}
