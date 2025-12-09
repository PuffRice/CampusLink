import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Advising() {
  const [student, setStudent] = useState(null);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudentData();
  }, []);

  async function fetchStudentData() {
    try {
      // Get current user from auth
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Auth user:", user);
      
      if (!user || !user.email) {
        console.error("No auth user found");
        navigate("/");
        return;
      }

      // Get user from users table using email to get the integer ID
      console.log("Querying users table with email:", user.email);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      console.log("Users query result:", { userData, userError });

      if (userError || !userData) {
        console.error("Error fetching user from users table:", userError);
        console.error("User data:", userData);
        alert(`User profile not found for email: ${user.email}. Please contact administration.`);
        setLoading(false);
        return;
      }

      // Now get student details using the users table integer ID
      console.log("Querying students table with user_id:", userData.id);
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", userData.id)
        .maybeSingle();

      console.log("Students query result:", { studentData, studentError });

      if (studentError) {
        console.error("Error fetching student data:", studentError);
        alert(`Database error: ${studentError.message}`);
        setLoading(false);
        return;
      }

      if (!studentData) {
        console.error("No student record found for user_id:", userData.id);
        alert(`Your account (${user.email}) exists but is not registered as a student. Please contact administration to complete your student registration.`);
        setLoading(false);
        return;
      }

      console.log("Student data retrieved:", studentData);
      console.log("Student user_id:", studentData.user_id);

      setStudent(studentData);

      // Fetch enrolled courses (use user_id as the student identifier)
      await fetchEnrolledCourses(studentData.user_id);

      // Fetch available courses
      await fetchAvailableCourses(studentData.user_id);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching student data:", error);
      setLoading(false);
    }
  }

  async function fetchEnrolledCourses(studentId) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        *,
        course_classes:class_id (
          *,
          courses:course_id (*)
        )
      `)
      .eq("student_id", studentId);

    if (error) {
      console.error("Error fetching enrolled courses:", error);
      return;
    }

    setEnrolledCourses(data || []);
    
    // Calculate total credits
    const credits = data?.reduce((sum, enrollment) => {
      return sum + (enrollment.course_classes?.courses?.credit || 0);
    }, 0) || 0;
    setTotalCredits(credits);
  }

  async function fetchAvailableCourses(studentId) {
    // Fetch all course classes with course details
    console.log("Fetching available courses for student:", studentId);
    const { data, error } = await supabase
      .from("course_classes")
      .select(`
        *,
        courses:course_id (*)
      `)
      .order("id", { ascending: true });

    console.log("Course classes query result:", { data, error });

    if (error) {
      console.error("Error fetching courses:", error);
      return;
    }

    // Filter out already enrolled courses
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("class_id")
      .eq("student_id", studentId);

    console.log("Student enrollments:", enrollments);

    const enrolledClassIds = enrollments?.map(e => e.class_id) || [];
    const filtered = data?.filter(course => !enrolledClassIds.includes(course.id)) || [];

    console.log("Available courses after filtering:", filtered);
    if (filtered && filtered.length > 0) {
      console.log("Sample course data:", filtered[0]);
    }
    setAvailableCourses(filtered);
  }

  function parseTime(timeStr) {
    // Expected format: "09:30 AM" or "9:30 AM"
    if (!timeStr) return null;
    
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    
    let hour24 = hours;
    if (period === "PM" && hours !== 12) hour24 += 12;
    if (period === "AM" && hours === 12) hour24 = 0;
    
    return hour24 * 60 + minutes; // Return minutes from midnight
  }

  function checkTimeClash(newCourse) {
    if (!newCourse.time_slot) return false;
    
    const newDays = newCourse.day_slot?.split("") || [];

    for (const enrollment of enrolledCourses) {
      const course = enrollment.course_classes;
      if (!course.time_slot) continue;

      // Check if both day_slot and time_slot match
      if (course.day_slot === newCourse.day_slot && course.time_slot === newCourse.time_slot) {
        return true; // Clash detected
      }
    }
    return false;
  }

  async function handleEnroll(courseClass) {
    if (!student) return;

    // Check credit limit
    const courseCredits = courseClass.courses?.credit || 0;
    if (totalCredits + courseCredits > 15) {
      alert(`Cannot enroll: Credit limit exceeded. You have ${totalCredits} credits and this course is ${courseCredits} credits. Maximum is 15.`);
      return;
    }

    // Check time clash
    if (checkTimeClash(courseClass)) {
      alert("Cannot enroll: Time clash with already enrolled courses.");
      return;
    }

    // Check seat availability
    const totalSeats = courseClass.seats || 0;
    const filledSeats = courseClass.filled_seats || 0;
    if (filledSeats >= totalSeats) {
      alert("Cannot enroll: No seats available in this course.");
      return;
    }

    setLoading(true);

    try {
      // Create enrollment
      const { error: enrollError } = await supabase
        .from("enrollments")
        .insert({
          class_id: courseClass.id,
          student_id: student.user_id,
          score: 0,
          grade: 0.0
        });

      if (enrollError) {
        alert("Enrollment Error: " + enrollError.message);
        setLoading(false);
        return;
      }

      // Update filled seats
      const currentFilledSeats = courseClass.filled_seats || 0;
      const { error: updateError } = await supabase
        .from("course_classes")
        .update({ filled_seats: currentFilledSeats + 1 })
        .eq("id", courseClass.id);

      if (updateError) {
        console.error("Error updating seats:", updateError);
      }

      alert(`Successfully enrolled in ${courseClass.courses?.name || courseClass.section}!`);
      
      // Refresh data
      await fetchStudentData();
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("An error occurred during enrollment.");
      setLoading(false);
    }
  }

  async function handleDrop(enrollment) {
    if (!confirm("Are you sure you want to drop this course?")) return;

    setLoading(true);

    try {
      // Delete enrollment
      const { error: dropError } = await supabase
        .from("enrollments")
        .delete()
        .eq("id", enrollment.id);

      if (dropError) {
        alert("Drop Error: " + dropError.message);
        setLoading(false);
        return;
      }

      // Update filled seats
      const courseClass = enrollment.course_classes;
      const currentFilledSeats = courseClass.filled_seats || 0;
      const { error: updateError } = await supabase
        .from("course_classes")
        .update({ filled_seats: Math.max(0, currentFilledSeats - 1) })
        .eq("id", courseClass.id);

      if (updateError) {
        console.error("Error updating seats:", updateError);
      }

      alert("Course dropped successfully!");
      
      // Refresh data
      await fetchStudentData();
    } catch (error) {
      console.error("Drop error:", error);
      alert("An error occurred while dropping the course.");
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Course Advising</h1>

      {/* Credit Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-2">Credit Summary</h2>
        <p className="text-lg">
          Total Credits: <span className="font-bold">{totalCredits}</span> / 15
        </p>
        <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
          <div 
            className={`h-4 rounded-full ${totalCredits > 15 ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min((totalCredits / 15) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Enrolled Courses */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Enrolled Courses</h2>
        {enrolledCourses.length === 0 ? (
          <p className="text-gray-500">No courses enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Course Code</th>
                  <th className="px-4 py-3 text-left">Course Name</th>
                  <th className="px-4 py-3 text-left">Credits</th>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Days</th>
                  <th className="px-4 py-3 text-left">Faculty</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {enrolledCourses.map((enrollment) => {
                  const courseClass = enrollment.course_classes;
                  const course = courseClass?.courses;
                  return (
                    <tr key={enrollment.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{course?.course_code}</td>
                      <td className="px-4 py-3">{course?.name}</td>
                      <td className="px-4 py-3">{course?.credit}</td>
                      <td className="px-4 py-3">{courseClass?.section}</td>
                      <td className="px-4 py-3">
                        {courseClass?.time_slot}
                      </td>
                      <td className="px-4 py-3">{courseClass?.day_slot}</td>
                      <td className="px-4 py-3">
                        {courseClass?.faculty?.users?.full_name || "TBA"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDrop(enrollment)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Drop
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Courses */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Courses</h2>
        {availableCourses.length === 0 ? (
          <p className="text-gray-500">No available courses to enroll.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Course Code</th>
                  <th className="px-4 py-3 text-left">Course Name</th>
                  <th className="px-4 py-3 text-left">Credits</th>
                  <th className="px-4 py-3 text-left">Section</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Days</th>
                  <th className="px-4 py-3 text-left">Faculty</th>
                  <th className="px-4 py-3 text-left">Seats</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {availableCourses.map((courseClass) => {
                  const course = courseClass.courses;
                  const totalSeats = courseClass.seats || 0;
                  const filledSeats = courseClass.filled_seats || 0;
                  const hasSeats = filledSeats < totalSeats;
                  const wouldExceedCredits = (totalCredits + (course?.credit || 0)) > 15;
                  const hasTimeClash = checkTimeClash(courseClass);
                  // Check if already enrolled in any section of this course
                  const alreadyEnrolledInCourse = enrolledCourses.some(
                    (enrollment) => enrollment.course_classes?.course_id === courseClass.course_id
                  );
                  return (
                    <tr key={courseClass.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{course?.course_code}</td>
                      <td className="px-4 py-3">{course?.name}</td>
                      <td className="px-4 py-3">{course?.credit}</td>
                      <td className="px-4 py-3">{courseClass.section}</td>
                      <td className="px-4 py-3">
                        {courseClass.time_slot}
                      </td>
                      <td className="px-4 py-3">{courseClass.day_slot}</td>
                      <td className="px-4 py-3">
                        {courseClass.faculty?.users?.full_name || "TBA"}
                      </td>
                      <td className="px-4 py-3">
                        {courseClass.filled_seats !== undefined && courseClass.seats !== undefined 
                          ? `${courseClass.filled_seats}/${courseClass.seats}` 
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        {alreadyEnrolledInCourse ? (
                          <button
                            disabled
                            className="px-3 py-1 rounded bg-gray-300 text-gray-500 cursor-not-allowed"
                          >
                            Enrolled
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnroll(courseClass)}
                            disabled={!hasSeats || wouldExceedCredits || hasTimeClash}
                            className={`px-3 py-1 rounded ${
                              !hasSeats || wouldExceedCredits || hasTimeClash
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-green-500 text-white hover:bg-green-600"
                            }`}
                            title={
                              !hasSeats ? "No seats available" :
                              wouldExceedCredits ? "Would exceed 15 credit limit" :
                              hasTimeClash ? "Time clash with enrolled courses" :
                              "Click to enroll"
                            }
                          >
                            {!hasSeats ? "Full" : 
                             wouldExceedCredits ? "Credits" :
                             hasTimeClash ? "Clash" : "Enroll"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
