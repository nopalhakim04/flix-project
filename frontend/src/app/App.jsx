import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import FlixChatbot from "@/components/ui/FlixChatbot";
import LoginRequiredModal from "@/components/ui/LoginRequiredModal";
import PageLoadingOverlay from "@/components/ui/PageLoadingOverlay";
import Login from "@/features/auth/Login";
import ForgotPassword from "@/features/auth/ForgotPassword";
import Register from "@/features/auth/Register";
import ResetPassword from "@/features/auth/ResetPassword";
import VerifyEmail from "@/features/auth/VerifyEmail";
import Homepage from "@/features/home/Homepage";
import MovieDetail from "@/features/movies/MovieDetail";
import MoviesPage from "@/features/movies/MoviesPage";
import GenrePage from "@/features/genre/GenrePage";
import TVSeriesPage from "@/features/tv-series/TVSeriesPage";
import TVSeriesDetail from "@/features/tv-series/TVSeriesDetail";
import Community from "@/features/community/Community";
import AdminPage from "@/features/admin/AdminPage";
import ModeratorPage from "@/features/admin/ModeratorPage";
import ProfilePage from "@/features/profile/ProfilePage";
import PostDetail from "@/features/community/PostDetail";
import CreatePostPage from "@/features/community/CreatePostPage";
import WatchlistPage from "@/features/watchlist/WatchlistPage";
import ContactUsPage from "@/features/contact/ContactUsPage";
import PaymentPage from "@/features/payment/PaymentPage";
import UpgradePremium from "@/features/premium/UpgradePremium";
import SettingsPage from "@/features/settings/SettingsPage";

function App() {
  const location = useLocation();
  const [isPageLoading, setIsPageLoading] = useState(true);
  const authAndHomePaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/movies",
    "/genre",
    "/tv-series",
    "/community",
    "/contact-us",
    "/create-post",
    "/watchlist",
    "/profile",
    "/settings",
    "/admin",
    "/payment",
    "/premium",
    "/",
  ];
  const hideNavbar =
    authAndHomePaths.includes(location.pathname) ||
    location.pathname.startsWith("/movie/") ||
    location.pathname.startsWith("/tv-series/") ||
    location.pathname.startsWith("/post/");
  const hideChatbot =
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/admin",
      "/moderator",
    ].includes(location.pathname) ||
    location.pathname.startsWith("/reset-password/");

  useEffect(() => {
    setIsPageLoading(true);

    const loadingTimer = window.setTimeout(() => {
      setIsPageLoading(false);
    }, 520);

    return () => {
      window.clearTimeout(loadingTimer);
    };
  }, [location.pathname, location.search]);

  return (
    <>
      <PageLoadingOverlay visible={isPageLoading} />
      {!hideNavbar && <Navbar />}
      <LoginRequiredModal />
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/genre" element={<GenrePage />} />
        <Route path="/tv-series" element={<TVSeriesPage />} />
        <Route path="/movie/:id" element={<MovieDetail />} />
        <Route path="/tv-series/:id" element={<TVSeriesDetail />} />
        <Route path="/community" element={<Community />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/create-post" element={<CreatePostPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/payment"
          element={
            <ProtectedRoute
              allowedRoles={["registered_user"]}
              redirectTo="/profile"
            >
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/premium"
          element={
            <ProtectedRoute
              allowedRoles={["registered_user"]}
              redirectTo="/profile"
            >
              <UpgradePremium />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute
              allowedRoles={["registered_user", "moderator", "admin"]}
            >
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute
              allowedRoles={["registered_user", "moderator", "admin"]}
            >
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "moderator"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/moderator"
          element={
            <ProtectedRoute allowedRoles={["moderator", "admin"]}>
              <ModeratorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      {!hideChatbot && <FlixChatbot />}
    </>
  );
}

export default App;
