import { Navigate, useLocation } from "react-router-dom";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

const getUserPlan = (user) => (user?.is_premium ? "premium" : "regular");

function ProtectedRoute({
  children,
  allowedRoles,
  allowedPlans,
  redirectTo,
}) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (allowedPlans?.length) {
    const userPlan = getUserPlan(user);

    if (!allowedPlans.includes(userPlan)) {
      return <Navigate to={redirectTo || "/"} replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
