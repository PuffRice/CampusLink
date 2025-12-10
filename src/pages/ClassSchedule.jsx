import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ClassSchedule() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClassSchedule();
  }, []);

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

  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")}${period}`;
  }

  const baseDayNames = { S: "Sun", M: "Mon", T: "Tue", W: "Wed", R: "Thu" };
  const comboDayNames = {
    ST: ["Sun", "Tue"], SR: ["Sun", "Thu"], SM: ["Sun", "Mon"],
    MT: ["Mon", "Tue"], MW: ["Mon", "Wed"], MR: ["Mon", "Thu"],
    TW: ["Tue", "Wed"], TR: ["Tue", "Thu"], WR: ["Wed", "Thu"],
  };

  function getDaysForSlot(daySlot) {
    if (!daySlot) return [];
    if (comboDayNames[daySlot]) return comboDayNames[daySlot];
    const days = [];
    for (const ch of daySlot.split("")) {
      const name = baseDayNames[ch];
      if (name && !days.includes(name)) days.push(name);
    }
    return days;
  }

  function generateRoutineTable(classesArray) {
    const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu"];
    const days = dayOrder;

    let allTimes = [];
    classesArray.forEach((c) => {
      allTimes.push(c.startMin);
      allTimes.push(c.endMin);
    });
    allTimes = [...new Set(allTimes)].sort((a, b) => a - b);

    const rows = [];
    const occupied = {};

    for (let i = 0; i < allTimes.length - 1; i++) {
      const start = allTimes[i];
      let row = {
        timeSlot: `${formatTime(start)} - ${formatTime(allTimes[i + 1])}`,
        cells: {},
      };

      days.forEach((d) => {
        if (occupied[`${i}-${d}`]) return;
        
        // Find class whose day mapping includes this day and this row is within its time window
        const cls = classesArray.find((c) => {
          const courseDays = getDaysForSlot(c.day);
          const isDayMatch = courseDays.includes(d);
          const isStartRow = c.startMin === start;
          return isDayMatch && isStartRow;
        });

        if (cls) {
          let span = 0;
          for (let k = i; k < allTimes.length - 1; k++) {
            if (allTimes[k] >= cls.endMin) break;
            span++;
          }
          row.cells[d] = { content: cls, rowSpan: span };
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
        .map((enrollment) => {
          const courseClass = enrollment.course_classes;
          const course = courseClass?.courses;
          if (!courseClass.time_slot || !courseClass.day_slot) return null;
          const startMin = toMinutes(courseClass.time_slot.split(" - ")[0]);
          const endMin = toMinutes(courseClass.time_slot.split(" - ")[1]);
          return {
            course: course?.course_code || "Unknown",
            room: courseClass.room || "TBA",
            day: courseClass.day_slot,
            startMin,
            endMin,
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

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

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

  const tableData = generateRoutineTable(classes);
  const rows = tableData.rows;
  const days = tableData.days;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Weekly Class Schedule</h1>
      <div className="overflow-x-auto">
        <table className="w-full bg-white border-2 border-gray-800 rounded-lg shadow-md">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-6 py-4 text-left font-semibold border-b-2 border-gray-800">Time</th>
              {days.map((day) => (
                <th key={day} className="px-6 py-4 text-center font-semibold border-b-2 border-gray-800 border-r-2 border-gray-800">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap align-top border-b-2 border-gray-800 border-r-2 border-gray-800">
                  {row.timeSlot}
                </td>
                {days.map((day) => {
                  const cell = row.cells[day];
                  return (
                    <td 
                      key={`${rowIndex}-${day}`} 
                      className="px-4 py-3 text-center align-middle border-b-2 border-gray-800 border-r-2 border-gray-800" 
                      rowSpan={cell?.rowSpan || 1}
                    >
                      {cell?.content ? (
                        <div className="text-center">
                          <div className="font-bold text-blue-600 text-base">{cell.content.course}</div>
                          <div className="text-sm text-gray-700 mt-1">{cell.content.room}</div>
                        </div>
                      ) : cell === null ? (
                        <span className="text-gray-300">—</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
