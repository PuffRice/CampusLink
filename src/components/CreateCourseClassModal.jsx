import { useState, useEffect } from "react";
import { supabase } from "../supabase";

function generateClassTimeSlots() {
  const slots = [];
  const startHour = 8;
  const startMin = 30;
  const duration = 90;
  const gap = 10;
  const endHour = 18;

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour) {
    const startTime = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
    
    let endMinutes = currentMin + duration;
    let endHourVal = currentHour;
    while (endMinutes >= 60) {
      endMinutes -= 60;
      endHourVal++;
    }
    const endTime = `${String(endHourVal).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

    slots.push(`${startTime} - ${endTime}`);

    currentMin += duration + gap;
    while (currentMin >= 60) {
      currentMin -= 60;
      currentHour++;
    }
  }

  return slots;
}

function generateLabTimeSlots(credits) {
  const slots = [];
  const durationMin = credits === 1 ? 120 : credits === 1.5 ? 180 : 120;
  const startHour = 8;
  const startMin = 30;
  const gap = 10;
  const endHour = 18;

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour) {
    const startTime = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
    
    let endMinutes = currentMin + durationMin;
    let endHourCalc = currentHour;
    while (endMinutes >= 60) {
      endMinutes -= 60;
      endHourCalc++;
    }
    
    if (endHourCalc < endHour) {
      const endTime = `${String(endHourCalc).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
      slots.push(`${startTime} - ${endTime}`);
    }

    currentMin += durationMin + gap;
    while (currentMin >= 60) {
      currentMin -= 60;
      currentHour++;
    }
  }

  return slots;
}

function generateRoomNumbers() {
  const rooms = [];
  const buildings = ["A", "B", "C", "D"];
  const floors = [1, 2, 3, 4];
  
  for (const building of buildings) {
    for (const floor of floors) {
      for (let room = 1; room <= 5; room++) {
        rooms.push(`${building}-${floor}0${room}`);
      }
    }
  }
  return rooms;
}

export default function CreateCourseClassModal({ onClose, onSuccess }) {
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [searchCourse, setSearchCourse] = useState("");
  const [daySlot, setDaySlot] = useState("");
  const [classType, setClassType] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [room, setRoom] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [seats, setSeats] = useState(30);
  const [courseCredits, setCourseCredits] = useState(0);

  const [filteredCourses, setFilteredCourses] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [filteredFaculty, setFilteredFaculty] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  const daySlotOptions = ["ST", "TR", "SR", "MW"];

  async function fetchInitialData() {
    const { data: deptData } = await supabase.from("departments").select("*");
    setDepartments(deptData || []);

    const { data: courseData } = await supabase.from("courses").select("*");
    setCourses(courseData || []);

    const { data: facultyData } = await supabase
      .from("faculty")
      .select("user_id, faculty_code, dept_id, users!user_id(full_name)");
    console.log('Modal Faculty:', facultyData);
    setFacultyList(facultyData || []);

    setAvailableRooms(generateRoomNumbers());
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedDept) {
      const deptIdNum = parseInt(selectedDept);
      const filtered = courses.filter((c) => parseInt(c.dept_id) === deptIdNum);
      setFilteredCourses(filtered);
      setSelectedCourse("");
      setSearchCourse("");
    } else {
      setFilteredCourses([]);
    }
  }, [selectedDept, courses]);

  useEffect(() => {
    if (selectedDept) {
      const deptIdNum = parseInt(selectedDept);
      const filtered = facultyList.filter((f) => parseInt(f.dept_id) === deptIdNum);
      setFilteredFaculty(filtered);
    } else {
      setFilteredFaculty([]);
    }
  }, [selectedDept, facultyList]);

  useEffect(() => {
    if (classType === "Class") {
      setAvailableTimeSlots(generateClassTimeSlots());
    } else if (classType === "Lab") {
      setAvailableTimeSlots(generateLabTimeSlots(courseCredits));
    }
    setTimeSlot("");
  }, [classType, courseCredits]);

  const searchFilteredCourses = filteredCourses.filter((c) =>
    c.course_code.toLowerCase().includes(searchCourse.toLowerCase()) ||
    c.name.toLowerCase().includes(searchCourse.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);

    const selectedCourseObj = courses.find((c) => c.id === selectedCourse);
    const sectionLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const section = `${selectedCourseObj.course_code}-${sectionLetter}`;

    const { error } = await supabase.from("course_classes").insert({
      course_id: selectedCourse,
      faculty_id: facultyId,
      section: section,
      day_slot: daySlot,
      room_no: room,
      class_type: classType,
      time_slot: timeSlot,
      seats: seats,
    });

    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
      return;
    }

    alert("Course class created successfully!");
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Create Course Class</h2>
            <p className="text-sm text-slate-600">Set up a new class</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 p-8">
          {/* Department */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.dept_id} value={d.dept_id}>
                  {d.name} ({d.tag})
                </option>
              ))}
            </select>
          </div>

          {/* Course */}
          {selectedDept && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Course</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search course..."
                  value={searchCourse}
                  onChange={(e) => {
                    setSearchCourse(e.target.value);
                    setShowCourseDropdown(true);
                  }}
                  onFocus={() => setShowCourseDropdown(true)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                
                {showCourseDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                    {searchFilteredCourses.length > 0 ? (
                      searchFilteredCourses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCourse(c.id);
                            setCourseCredits(c.credit || 0);
                            setSearchCourse(`${c.course_code} — ${c.name}`);
                            setShowCourseDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-b-0 text-sm"
                        >
                          <span className="font-semibold text-slate-900">{c.course_code}</span>
                          <span className="text-slate-500 ml-2 text-xs">{c.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-slate-500 text-xs">
                        {filteredCourses.length === 0 ? "No courses found" : "Type to search"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Day Slot */}
          {selectedCourse && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Day Slot</label>
              <div className="grid grid-cols-4 gap-2">
                {daySlotOptions.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setDaySlot(slot)}
                    className={`py-2 px-2 rounded-lg font-semibold transition text-sm ${
                      daySlot === slot
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Class Type */}
          {daySlot && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {["Class", "Lab"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setClassType(type)}
                    className={`py-2 px-4 rounded-lg font-semibold transition text-sm ${
                      classType === type
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Slot */}
          {classType && availableTimeSlots.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Time Slot</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              >
                <option value="">Select Time Slot</option>
                {availableTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Room */}
          {timeSlot && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Room</label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              >
                <option value="">Select Room</option>
                {availableRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Faculty */}
          {room && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Assign Faculty</label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              >
                <option value="">Select Faculty</option>
                {filteredFaculty.length > 0 ? (
                  filteredFaculty.map((f) => (
                    <option key={f.user_id} value={f.user_id}>
                      {f.users?.full_name} ({f.faculty_code})
                    </option>
                  ))
                ) : (
                  <option disabled>No faculty found</option>
                )}
              </select>
            </div>
          )}

          {/* Seats */}
          {facultyId && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Seat Count</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSeats(Math.max(1, seats - 1))}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-blue-600 w-12 text-center">{seats}</span>
                <button
                  type="button"
                  onClick={() => setSeats(seats + 1)}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          {facultyId && (
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 rounded-lg border border-slate-300 text-slate-900 font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Creating..." : "Create Class"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
