import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import customerServiceRoutes from "./routes/customerServiceRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import moderatorRoutes from "./routes/moderatorRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import transporter from "./config/mail.js";
import profileRoutes from "./routes/profileRoutes.js";
import postReactionRoutes from "./routes/postReactionRoutes.js";
import postLikeRoutes from "./routes/postLikeRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import pollRoutes from "./routes/pollRoutes.js";
import postInsightRoutes from "./routes/postInsightRoutes.js";
import postShareRoutes from "./routes/postShareRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import postViewRoutes from "./routes/postViewRoutes.js";
import movieRoutes from "./routes/movieRoutes.js";
import tvRoutes from "./routes/tvRoutes.js";
import movieReviewRoutes from "./routes/movieReviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import tvSeriesReviewRoutes from "./routes/tvSeriesReviewRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import { initializeChatsTable } from "./config/initChats.js";
import { initializeFriendsTable } from "./config/initFriends.js";
import { initializeNotificationsTable } from "./config/initNotifications.js";
import { initializeEmailVerificationTable } from "./config/initEmailVerification.js";
import { initializePostViewsTable } from "./config/initPostViews.js";
import { initializePasswordResetTable } from "./config/initPasswordReset.js";
import { initializeMovieReviewsTable } from "./config/initMovieReviews.js";
import { initializeTvSeriesReviewsTable } from "./config/initTvSeriesReviews.js";
import { initializeUserProfileMediaColumns } from "./config/initUserProfileMedia.js";
import { initializeUserStatusColumns } from "./config/initUserStatus.js";
import { initializeReportsTable } from "./config/initReports.js";
import { initializeAdminMoviesTable } from "./config/initAdminMovies.js";
import { initializeContactMessagesTable } from "./config/initContactMessages.js";
import { initializeCustomerServiceTables } from "./config/initCustomerService.js";
import { initializePaymentTransactionsTable } from "./config/initPaymentTransactions.js";
import { initializePaymentMethodsTable } from "./config/initPaymentMethods.js";
import { initializeWatchlistTable } from "./config/initWatchlist.js";

dotenv.config();

const app = express();
let databaseReadyPromise;
let mailVerifyPromise;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initializeDatabase = () => {
  if (process.env.SKIP_DATABASE_INIT === "true") {
    return Promise.resolve();
  }

  if (!databaseReadyPromise) {
    databaseReadyPromise = Promise.all([
      initializeEmailVerificationTable(),
      initializePostViewsTable(),
      initializePasswordResetTable(),
      initializeMovieReviewsTable(),
      initializeTvSeriesReviewsTable(),
      initializeUserProfileMediaColumns(),
      initializeUserStatusColumns(),
      initializeChatsTable(),
      initializeNotificationsTable(),
      initializeFriendsTable(),
      initializeAdminMoviesTable(),
      initializeContactMessagesTable(),
      initializeCustomerServiceTables(),
      initializePaymentTransactionsTable(),
      initializePaymentMethodsTable(),
      initializeWatchlistTable(),
    ]).then(() => initializeReportsTable());
  }

  return databaseReadyPromise;
};

const verifyMailer = () => {
  if (
    process.env.REQUIRE_EMAIL_VERIFICATION === "false" ||
    !process.env.MAIL_HOST?.trim() ||
    !process.env.MAIL_FROM?.trim()
  ) {
    return Promise.resolve();
  }

  if (!mailVerifyPromise) {
    mailVerifyPromise = transporter
      .verify()
      .then(() => {
        console.log("SMTP Mailtrap siap digunakan");
      })
      .catch((error) => {
        console.error("SMTP Mailtrap gagal:", error.message);
      });
  }

  return mailVerifyPromise;
};

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("Gagal menyiapkan tabel database:", error.message);
    res.status(500).json({ message: "Gagal menyiapkan database" });
  }
});
app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Flix berjalan" });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/contact-us", contactRoutes);
app.use("/api/customer-service", customerServiceRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/moderator", moderatorRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/post-reactions", postReactionRoutes);
app.use("/api/post-likes", postLikeRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/post-insights", postInsightRoutes);
app.use("/api/post-shares", postShareRoutes);
app.use("/api/post-views", postViewRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/tmdb", movieRoutes);
app.use("/api/tv-series", tvRoutes);
app.use("/api/tv", tvRoutes);
app.use("/api/movie-reviews", movieReviewRoutes);
app.use("/api/tv-series-reviews", tvSeriesReviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/payment", paymentRoutes);
app.use("/api/watchlist", watchlistRoutes);

const PORT = process.env.PORT || 5000;

verifyMailer();

if (!process.env.VERCEL) {
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Gagal menyiapkan tabel database:", error.message);
      process.exit(1);
    });
}

export default app;
