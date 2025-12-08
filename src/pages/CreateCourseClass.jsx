import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// Time slot generator for classes
function generateClassTimeSlots() {
  const slots = [];
  const startHour = 8;
  const startMin = 30;
  const duration = 90; // 1 hr 30 mins
  const gap = 10; // 10 mins gap
  const endHour = 18; // 6 PM

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour) {
    const startTime = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
    
    let endMinutes = currentMin + duration;
    let endHour = currentHour;
    while (endMinutes >= 60) {
      endMinutes -= 60;
      endHour++;
    }
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

    slots.push(`${startTime} - ${endTime}`);

    // Move to next slot
    currentMin += duration + gap;
    while (currentMin >= 60) {
      currentMin -= 60;
      currentHour++;
    }
  }

  return slots;
}

// Time slot generator for labs
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

    // Move to next slot
    currentMin += durationMin + gap;
    while (currentMin >= 60) {
      currentMin -= 60;
      currentHour++;
    }
  }

  return slots;
}

// Room generator
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

export default function CreateCourseClass() {
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
    // Fetch departments
    const { data: deptData } = await supabase.from("departments").select("*");
    console.log('Departments:', deptData);
    setDepartments(deptData || []);

    // Fetch all courses
    const { data: courseData } = await supabase.from("courses").select("*");
    console.log('All Courses:', courseData);
    setCourses(courseData || []);

    // Fetch all faculty
    const { data: facultyData, error: facultyError } = await supabase
      .from("faculty")
      .select("*");
    if (facultyError) {
      console.error('Faculty fetch error:', facultyError);
      setFacultyList([]);
    } else {
      console.log('Faculty:', facultyData);
      setFacultyList(facultyData || []);
    }
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filter courses when dept changes
  useEffect(() => {
    if (selectedDept) {
      // Convert both to numbers for comparison
      const deptIdNum = parseInt(selectedDept);
      const filtered = courses.filter((c) => parseInt(c.dept_id) === deptIdNum);
      console.log('Selected Dept:', selectedDept, 'Filtered Courses:', filtered);
      setFilteredCourses(filtered);
      setSelectedCourse("");
      setSearchCourse("");
    } else {
      setFilteredCourses([]);
    }
  }, [selectedDept, courses]);

  // Filter faculty when dept changes
  useEffect(() => {
    if (selectedDept) {
      const deptIdNum = parseInt(selectedDept);
      const filtered = facultyList.filter((f) => parseInt(f.dept_id) === deptIdNum);
      console.log('Faculty filtering - Dept ID:', deptIdNum, 'All Faculty:', facultyList, 'Filtered:', filtered);
      setFilteredFaculty(filtered);
    } else {
      setFilteredFaculty([]);
    }
  }, [selectedDept, facultyList]);

  // Generate time slots when type or credits change
  useEffect(() => {
    if (classType === "Class") {
      setAvailableTimeSlots(generateClassTimeSlots());
    } else if (classType === "Lab") {
      setAvailableTimeSlots(generateLabTimeSlots(courseCredits));
    }
    setTimeSlot("");
  }, [classType, courseCredits]);

  // Generate room numbers
  useEffect(() => {
    setAvailableRooms(generateRoomNumbers());
  }, []);

  // Filter course search
  const searchFilteredCourses = filteredCourses.filter((c) =>
    c.course_code.toLowerCase().includes(searchCourse.toLowerCase()) ||
    c.name.toLowerCase().includes(searchCourse.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);

    // Generate section name (e.g., "CSE-302-A")
    const selectedCourseObj = courses.find((c) => c.id === selectedCourse);
    const sectionLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random A-Z
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
    setSelectedDept("");
    setSelectedCourse("");
    setDaySlot("");
    setClassType("");
    setTimeSlot("");
    setRoom("");
    setFacultyId("");
    setSeats(30);
    setSearchCourse("");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Create Course Class</h1>
          <p className="text-slate-600">Set up a new class for CSE302 or any course</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6 bg-white rounded-3xl shadow-lg p-8 border border-slate-200">
          
          {/* Step 1: Department */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Step 2: Course with Search */}
          {selectedDept && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Course</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search course by code or name..."
                  value={searchCourse}
                  onChange={(e) => {
                    setSearchCourse(e.target.value);
                    setShowCourseDropdown(true);
                  }}
                  onFocus={() => setShowCourseDropdown(true)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {showCourseDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
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
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-b-0"
                        >
                          <span className="font-semibold text-slate-900">{c.course_code}</span>
                          <span className="text-slate-500 ml-2 text-sm">{c.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-slate-500 text-sm">
                        {filteredCourses.length === 0
                          ? "No courses found for this department"
                          : "Type to search courses"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Day Slot */}
          {selectedCourse && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Day Slot</label>
              <div className="grid grid-cols-4 gap-2">
                {daySlotOptions.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setDaySlot(slot)}
                    className={`py-2 px-3 rounded-lg font-semibold transition ${
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

          {/* Step 4: Class Type */}
          {daySlot && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-3">
                {["Class", "Lab"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setClassType(type)}
                    className={`py-3 px-4 rounded-xl font-semibold transition ${
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

          {/* Step 5: Time Slot */}
          {classType && availableTimeSlots.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Time Slot</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Step 6: Room */}
          {timeSlot && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Room</label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Step 7: Faculty */}
          {room && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Assign Faculty</label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Faculty</option>
                {filteredFaculty.length > 0 ? (
                  filteredFaculty.map((f) => (
                    <option key={f.user_id} value={f.user_id}>
                      {f.users?.full_name || `Faculty ${f.faculty_code}`} ({f.faculty_code})
                    </option>
                  ))
                ) : (
                  <option disabled>No faculty found for this department</option>
                )}
              </select>
            </div>
          )}

          {/* Step 8: Seat Count */}
          {facultyId && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Seat Count</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                    className="w-12 h-12 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="text-3xl font-bold text-blue-600 w-16 text-center">{seats}</span>
                  <button
                    type="button"
                    onClick={() => setSeats(seats + 1)}
                    className="w-12 h-12 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 transition"
              >
                {loading ? "Creating..." : "Create Class"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
