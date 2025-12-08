import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import StudentDashboard from "./pages/StudentDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import AddFaculty from "./pages/AddFaculty";
import AddStudent from "./pages/AddStudent";
import CreateCourseClass from "./pages/CreateCourseClass";
import CourseClasses from "./pages/CourseClasses";


import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/add-faculty"
          element={
            <ProtectedRoute>
              <AddFaculty />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/course-classes"
          element={
            <ProtectedRoute>
              <CourseClasses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
    

        <Route
          path="/staff/create-class"
          element={
            <ProtectedRoute>
              <CreateCourseClass />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/course-classes"
          element={
            <ProtectedRoute>
              <CourseClasses />
            </ProtectedRoute>
          }
        />


        <Route
          path="/faculty"
          element={
            <ProtectedRoute>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff/add-student"
          element={
          <ProtectedRoute>
              <AddStudent />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
