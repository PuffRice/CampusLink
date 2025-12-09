import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function EnrolledClassesLMS() {
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stream, setStream] = useState([]);
  const [classDetails, setClassDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  async function fetchEnrolledCourses() {
    try {
      // Get current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setLoading(false);
        return;
      }

      // Get user from users table using email to get the integer ID
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();
      if (userError || !userData) {
        setLoading(false);
        return;
      }

      // Get student record
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("user_id")
        .eq("user_id", userData.id)
        .maybeSingle();
      if (studentError || !studentData) {
        setLoading(false);
        return;
      }

      // Fetch enrollments for this student
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          *,
          course_classes:class_id (
            *,
            courses:course_id (*),
            faculty:faculty_id (
              *,
              users:user_id (*)
            )
          )
        `)
        .eq("student_id", studentData.user_id);
      if (enrollError || !enrollments) {
        setLoading(false);
        return;
      }

      // Flatten to course_classes array
      const courseClasses = enrollments
        .map(e => e.course_classes)
        .filter(Boolean);
      setCourses(courseClasses);
      setActiveCourse(courseClasses[0] || null);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeCourse) {
      fetchCourseData(activeCourse);
    }
  }, [activeCourse]);

  async function fetchCourseData(course) {
    // Set class details from the active course
    if (course) {
      setClassDetails({
        courseName: course.courses?.name,
        courseCode: course.courses?.course_code,
        section: course.section,
        credits: course.courses?.credit,
        room: course.room || "TBA",
        timeSlot: course.time_slot,
        daySlot: course.day_slot,
        faculty: course.faculty?.users?.full_name || "TBA",
        seats: course.seats,
        filledSeats: course.filled_seats,
      });
    }
    // TODO: Fetch assignments, materials, attendance, and stream for the selected course
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar for Course Switching */}
      <div className="bg-white border-b px-6 py-4 flex gap-4 items-center">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setActiveCourse(course)}
            className={`px-4 py-2 rounded-lg font-semibold ${activeCourse?.id === course.id ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {course.courses?.name || course.name}
          </button>
        ))}
      </div>
      <div className="flex flex-1">
        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Stream (Announcements) */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Stream</h2>
            {/* TODO: Render stream posts */}
            <div className="bg-gray-50 rounded-lg p-4">No announcements yet.</div>
          </section>
          {/* Assignments */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Assignments</h2>
            {/* TODO: Render assignments */}
            <div className="bg-gray-50 rounded-lg p-4">No assignments yet.</div>
          </section>
          {/* Uploaded Materials */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Materials</h2>
            {/* TODO: Render materials */}
            <div className="bg-gray-50 rounded-lg p-4">No materials uploaded yet.</div>
          </section>
          {/* Attendance */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Attendance</h2>
            {/* TODO: Render attendance */}
            <div className="bg-gray-50 rounded-lg p-4">Attendance data not available.</div>
          </section>
        </div>
        {/* Side Card with Class Details */}
        <aside className="w-80 bg-white border-l p-8 flex-shrink-0 overflow-y-auto">
          <h2 className="text-lg font-bold mb-6">Class Details</h2>
          {classDetails ? (
            <div className="space-y-5">
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Course Name</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.courseName}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Course Code</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.courseCode}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Section</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.section}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Credits</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.credits}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Room</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.room}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Time</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.timeSlot}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Days</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.daySlot}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">Faculty</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.faculty}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Seats</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{classDetails.filledSeats} / {classDetails.seats}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${(classDetails.filledSeats / classDetails.seats) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">No details available.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
