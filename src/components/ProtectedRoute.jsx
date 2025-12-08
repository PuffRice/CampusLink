import useAuth from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import useAutoLogout from "../hooks/useAutoLogout";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  console.log("ProtectedRoute → loading:", loading);
  console.log("ProtectedRoute → user:", user);

  useAutoLogout(5)

  if (loading) return <div>Loading session...</div>;

  if (!user) {
    console.log("No user, redirecting...");
    return <Navigate to="/" replace />;
  }

  console.log("User verified, showing protected page.");
  return children;
}
