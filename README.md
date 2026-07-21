# FLIX - Website Rekomendasi Film

FLIX adalah website rekomendasi film dan TV series berbasis React, Node.js, Express, dan PostgreSQL. Website ini menggabungkan data TMDB, fitur komunitas, review, watchlist, subscription premium, chatbot FLIX, customer service, dan dashboard admin/moderator.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Role dan Akses Langganan](#role-dan-akses-langganan)
- [User Flow](#user-flow)
- [Admin dan Moderator Flow](#admin-dan-moderator-flow)
- [Teknologi](#teknologi)
- [Struktur Folder](#struktur-folder)
- [Dokumentasi Pendukung](#dokumentasi-pendukung)
- [Deployment yang Digunakan](#deployment-yang-digunakan)
- [Environment Variable](#environment-variable)
- [Database](#database)
- [API Eksternal](#api-eksternal)
- [Endpoint Internal](#endpoint-internal)
- [Catatan Pengembangan](#catatan-pengembangan)

## Fitur Utama

### Film, TV Series, dan Genre

- Homepage dengan hero carousel film hits dan rekomendasi berdasarkan mood.
- Halaman Movies untuk trending, watchlist user, dan daftar film.
- Halaman TV Series dengan section jelajahi series dan series populer.
- Halaman Genre dengan card genre, filter film/TV series, kategori umur, dan tahun.
- Detail film dan TV series berisi poster, backdrop, sinopsis, genre, cast, rating, trailer, watch provider, dan review penonton.
- TV series memiliki pilihan season, daftar episode, dan progres episode yang sudah ditonton.
- Genre pada detail film/series dapat diklik untuk membuka halaman genre sesuai pilihan.
- Search modal untuk mencari film dan TV series dari navbar.
- Card film/series mendukung hover detail singkat, genre, dan aksi simpan watchlist.

### Watchlist

- Watchlist tersedia per user dengan endpoint backend, sementara sebagian state UI/progress tontonan masih memakai browser storage.
- User dapat menyimpan film dan TV series.
- User dapat menandai status sudah ditonton atau belum ditonton.
- Untuk TV series, progres dapat ditandai per season dan episode.
- Jika episode 3 ditandai, episode sebelumnya ikut ditandai otomatis.
- User Free dibatasi maksimal 10 item watchlist.
- User Premium dan Eksklusif mendapat watchlist unlimited.

### Review

- User login dapat membuat review film dan TV series.
- Review memakai rating bintang, teks review, dan mood saat menonton.
- Form review ditampilkan sebagai modal.
- User dapat mengedit dan menghapus review dari halaman profile.
- Review dapat dilaporkan.
- Admin/moderator dapat melihat detail review, alasan laporan, blokir review, tolak laporan, dan mengembalikan review yang diblokir.

### Community

- Community post menggunakan rich text editor.
- Mendukung hashtag, gambar, GIF, emoji, polling, like, reaction, share, comment, dan reply.
- Insight post menghitung total interaksi, termasuk view, like, reply, share, reaction, dan polling.
- Detail post mencatat view user login satu kali per post.
- Hashtag dapat diklik untuk menampilkan post terkait.
- Post, comment, reply, dan user dapat dilaporkan.
- Admin/moderator dapat memoderasi post community seperti sistem moderasi review.

### Profile, Friendlist, dan Chat

- Halaman Profile menampilkan banner, avatar, statistik, review saya, postingan saya, friendlist, dan riwayat mood.
- User dapat mengubah profile, foto profile, dan banner dengan crop image.
- Avatar Premium/Eksklusif menampilkan badge diamond.
- Friendlist tersedia untuk user Premium dan Eksklusif.
- User dapat add friend, accept/decline request, remove friend, dan message friend.
- Private chat antar user tersimpan di database.
- Chat mendukung emoji dan tampilan bubble pengirim/penerima.

### Subscription dan Payment

- Plan user: Free, Premium, dan Eksklusif.
- Premium dan Eksklusif dibeli melalui halaman Premium/Payment.
- Admin mengatur metode pembayaran, harga paket, dan logo/QR metode pembayaran.
- Payment user mendukung pilihan QR Code, E-Wallet, dan Bank.
- User upload bukti pembayaran.
- Jika transaksi masih pending, tombol upgrade diarahkan ke page payment sampai transaksi disetujui admin.
- Admin dapat menyetujui atau menolak transaksi.
- Setelah disetujui, subscription_plan user berubah sesuai paket.

### Chatbot FLIX

- Chatbot FLIX memakai Gemini API.
- Chatbot berperan sebagai asisten general dan spesialis FLIX.
- Chatbot dapat memberi rekomendasi film, menjawab pertanyaan umum, menjelaskan fitur website, dan memberi tautan ke halaman terkait.
- Chatbot hanya tersedia untuk user Eksklusif.

### Contact Us dan Customer Service

- Contact Us memiliki form laporan/kritik/saran.
- Pesan Contact Us masuk ke menu Report pada dashboard admin/moderator.
- Customer Service memiliki chat flow:
  - Bot meminta kategori masalah.
  - User menjelaskan masalah.
  - User dapat mengirim lampiran.
  - Sistem membuat tiket.
  - Admin/moderator mengambil tiket dan membalas.
  - Tiket dapat diselesaikan dan riwayat tetap tersimpan.

### Admin dan Moderator

- Admin dashboard menampilkan statistik, chart aktivitas, aktivitas terbaru, dan film paling banyak disimpan di watchlist.
- Kelola Film: list film manual, tambah film, edit film.
- Kelola User: list user, detail user, nonaktifkan/aktifkan user.
- Moderasi Review: review masuk, report review, review terblokir.
- Moderasi Community: semua post, post dilaporkan, post terblokir.
- Transaksi: list transaksi, filter paket/metode/status, detail transaksi, setuju/tolak.
- Report: Contact Us dan Customer Service ticket.
- Settings: pengaturan profile dan password admin/user.

## Role dan Akses Langganan

### Role Sistem

| Role | Akses |
| --- | --- |
| registered_user | Menggunakan fitur user sesuai subscription_plan |
| moderator | Kelola film, review, community, transaksi, dan report |
| admin | Semua akses user, moderator, kelola user, dashboard penuh, dan settings admin |

### Akses Subscription

| Fitur | Free | Premium | Eksklusif |
| --- | --- | --- | --- |
| Lihat film dan TV series | Ya | Ya | Ya |
| Search film dan TV series | Ya | Ya | Ya |
| Watchlist | Maksimal 10 | Unlimited | Unlimited |
| Review film/series | Ya | Ya | Ya |
| Community post | Tidak | Ya | Ya |
| Comment/reply community | Tidak | Ya | Ya |
| Like/reaction/share community | Tidak | Ya | Ya |
| Friendlist dan add friend | Tidak | Ya | Ya |
| Private chat antar user | Tidak | Ya | Ya |
| Badge profile | Tidak | Premium | Eksklusif |
| Bebas iklan | Tidak | Ya | Ya |
| Chatbot FLIX | Tidak | Tidak | Ya |

Pesan pembatasan fitur:

```text
Fitur ini hanya tersedia untuk pengguna Premium atau Eksklusif.
Chatbot FLIX hanya tersedia untuk pengguna Eksklusif.
```

Pembatasan fitur diterapkan di backend melalui middleware, sehingga route tetap aman walaupun diakses langsung dari Postman.

## User Flow

Versi ringkas user flow juga tersedia di file:

```text
USER_FLOW.md
```

### 1. Flow Pengunjung Baru

```mermaid
flowchart TD
  A["Buka FLIX"] --> B["Lihat Home, Movies, TV Series, Genre"]
  B --> C["Search film atau series"]
  C --> D["Buka detail film/series"]
  D --> E{"Ingin simpan, review, community, chat?"}
  E -- "Ya" --> F["Popup login/daftar"]
  E -- "Tidak" --> B
  F --> G["Register atau Login"]
```

### 2. Flow Register dan Login

```mermaid
flowchart TD
  A["User daftar akun"] --> B["Backend membuat user subscription_plan free"]
  B --> C["Email verifikasi dikirim"]
  C --> D["User klik tombol verifikasi email"]
  D --> E["Login"]
  E --> F["Masuk homepage dengan navbar user"]
```

### 3. Flow Menonton dan Watchlist

```mermaid
flowchart TD
  A["User login"] --> B["Cari film/series"]
  B --> C["Buka detail"]
  C --> D["Tonton trailer atau simpan watchlist"]
  D --> E{"Plan user"}
  E -- "Free dan watchlist < 10" --> F["Item tersimpan"]
  E -- "Free dan watchlist sudah 10" --> G["Popup upgrade Premium/Eksklusif"]
  E -- "Premium/Eksklusif" --> F
  F --> H["Kelola status sudah/belum ditonton di Watchlist"]
```

### 4. Flow Review

```mermaid
flowchart TD
  A["Buka detail film/series"] --> B["Klik tab Review"]
  B --> C["Klik Berikan Review"]
  C --> D["Isi rating, review, mood"]
  D --> E["Submit review"]
  E --> F["Review tampil di detail dan Profile"]
  F --> G["User dapat edit/hapus review miliknya"]
```

### 5. Flow Community

```mermaid
flowchart TD
  A["User buka Community"] --> B{"Plan user Premium/Eksklusif?"}
  B -- "Tidak" --> C["Tombol fitur terkunci dan diarahkan upgrade"]
  B -- "Ya" --> D["Buat post / comment / reply / reaction / share"]
  D --> E["Notifikasi dikirim ke pemilik konten"]
  E --> F["Post dapat dilihat di Community dan Detail Post"]
```

### 6. Flow Premium dan Eksklusif

```mermaid
flowchart TD
  A["User klik Upgrade Premium"] --> B{"Ada transaksi pending?"}
  B -- "Ya" --> C["Diarahkan ke Payment pending"]
  B -- "Tidak" --> D["Pilih paket dan durasi"]
  D --> E["Pilih metode pembayaran"]
  E --> F["Upload bukti pembayaran"]
  F --> G["Status transaksi pending"]
  G --> H["Admin setujui atau tolak"]
  H -- "Disetujui" --> I["subscription_plan aktif"]
  H -- "Ditolak" --> J["User dapat upload ulang / transaksi baru"]
```

### 7. Flow Customer Service

```mermaid
flowchart TD
  A["User buka Customer Service"] --> B["Bot meminta kategori"]
  B --> C["User memilih kategori dan menulis masalah"]
  C --> D["User menambahkan data/lampiran jika perlu"]
  D --> E["Sistem membuat tiket"]
  E --> F["Admin/moderator mengambil tiket"]
  F --> G["Admin/moderator membalas chat"]
  G --> H["Tiket selesai dan riwayat read-only"]
```

## Admin dan Moderator Flow

### Moderasi Review dan Community

```mermaid
flowchart TD
  A["User report konten"] --> B["Laporan masuk admin/moderator"]
  B --> C["Admin buka detail laporan"]
  C --> D{"Keputusan"}
  D -- "Blokir" --> E["Konten masuk tab terblokir"]
  D -- "Tolak" --> F["Laporan ditolak dan konten tetap tampil"]
  E --> G["Admin dapat mengembalikan konten"]
```

### Kelola Transaksi

```mermaid
flowchart TD
  A["User upload bukti pembayaran"] --> B["Transaksi pending"]
  B --> C["Admin buka detail transaksi"]
  C --> D{"Valid?"}
  D -- "Ya" --> E["Setujui transaksi"]
  E --> F["Plan user diperbarui"]
  D -- "Tidak" --> G["Tolak transaksi"]
```

### Customer Service Admin

```mermaid
flowchart TD
  A["Tiket baru"] --> B["Admin/moderator melihat daftar tiket"]
  B --> C["Ambil tiket"]
  C --> D["Status sedang ditangani"]
  D --> E["Balas chat dan cek lampiran"]
  E --> F["Selesaikan tiket"]
```

## Teknologi

### Frontend

- React 19
- Vite
- React Router DOM
- Axios
- Tiptap Rich Text Editor
- Emoji Picker React
- React Icons
- CSS modular per feature

### Backend

- Node.js
- Express 5
- PostgreSQL
- JSON Web Token
- Bcrypt
- Multer
- Nodemailer
- Dotenv
- CORS

### Integrasi Eksternal

- TMDB API untuk data film, TV series, genre, trailer, cast, dan watch provider.
- GIPHY API untuk GIF pada editor community.
- Gemini API untuk Chatbot FLIX.
- SMTP provider untuk email verifikasi, reset password, dan notifikasi auth.

## Struktur Folder

```text
flix/
  backend/
    src/
      config/
      controllers/
      middleware/
      routes/
      utils/
    sql/
    uploads/
  frontend/
    public/
    src/
      app/
      assets/
      components/
        community/
        editor/
        layout/
        routing/
        ui/
      features/
        admin/
        auth/
        community/
        contact/
        genre/
        home/
        movies/
        payment/
        premium/
        profile/
        settings/
        tv-series/
        watchlist/
      utils/
  flix_db.sql
  API_DOCUMENTATION.md
  DEPLOYMENT.md
  ADMIN_GUIDE.md
  KNOWN_LIMITATIONS.md
  USER_FLOW.md
  README.md
```

Frontend memakai alias import `@/` untuk `frontend/src`.

## Dokumentasi Pendukung

| Dokumen | Isi |
| --- | --- |
| `API_DOCUMENTATION.md` | Endpoint internal lengkap, akses, contoh body, dan response umum |
| `DEPLOYMENT.md` | Detail deployment Vercel, Supabase PostgreSQL, env production, dan troubleshooting |
| `ADMIN_GUIDE.md` | Panduan workflow admin/moderator untuk transaksi, user, moderasi, dan customer service |
| `KNOWN_LIMITATIONS.md` | Batasan teknis, tradeoff, dan rekomendasi pengembangan lanjutan |
| `USER_FLOW.md` | Alur user, subscription, payment, admin, dan customer service |

## Deployment yang Digunakan

Project FLIX dideploy menggunakan layanan berikut:

| Bagian | Layanan | URL |
| --- | --- | --- |
| Frontend | Vercel | `https://flixprojectgroup5celerates-zfkn.vercel.app` |
| Backend API | Vercel Serverless Functions | `https://flixprojectgroup5celerates.vercel.app` |
| Database | Supabase PostgreSQL | Schema `flix` |
| Email SMTP | SMTP provider production | Dipakai oleh backend melalui environment variable |

Frontend React/Vite dibuild oleh Vercel dari folder `frontend`. Backend Express berjalan sebagai deployment Node.js/serverless di Vercel dari folder `backend`.

Database production memakai Supabase PostgreSQL dengan connection string `DATABASE_URL`. Karena environment production bersifat stateless, upload gambar disimpan sebagai data URL di database agar tetap tersedia setelah redeploy.

## Environment Variable

### Backend Production

Backend production memakai environment variable di Vercel.

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
DB_SSL=true
JWT_SECRET=secret_production
FRONTEND_URL=https://flixprojectgroup5celerates-zfkn.vercel.app

TMDB_API_KEY=tmdb_api_key
GEMINI_API_KEY=gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

MAIL_HOST=smtp_provider_host
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=smtp_user
MAIL_PASS=smtp_password
MAIL_FROM="FLIX <no-reply@domain-terverifikasi>"

REQUIRE_EMAIL_VERIFICATION=false
SKIP_DATABASE_INIT=true
ENABLE_ADMIN_BOOTSTRAP=false
```

### Frontend Production

```env
VITE_API_URL=https://flixprojectgroup5celerates.vercel.app
VITE_GIPHY_API_KEY=giphy_api_key
```

## Database

Project memakai schema PostgreSQL `flix`.

Database production berada di Supabase PostgreSQL dan memakai connection string Supabase pada environment variable backend `DATABASE_URL`.

Schema awal tersedia di file `flix_db.sql`. Import schema dilakukan ke database Supabase sebelum backend production dijalankan.

Beberapa tabel/kolom dibuat atau dipastikan otomatis saat backend berjalan, termasuk:

- User status dan subscription: `is_active`, `is_premium`, `subscription_plan`.
- Password reset token.
- Post views dan post insights.
- Movie reviews dan TV series reviews.
- Notifications.
- Friends dan private chat.
- Watchlist.
- Payment packages, methods, dan transactions.
- Contact Us messages.
- Customer service tickets, messages, dan attachments.
- Report untuk review, community post, comment, reply, dan user.

Upload gambar user/admin dan bukti pembayaran pada production disimpan sebagai data URL di database. Ini dipilih karena deployment Vercel bersifat stateless dan tidak menyimpan file runtime secara permanen.

## API Eksternal

| API | Fungsi |
| --- | --- |
| TMDB API | Film, TV series, genre, trending, discover, detail, trailer, cast, watch provider |
| TMDB Image API | Poster dan backdrop |
| GIPHY API | GIF picker pada community post |
| Gemini API | Chatbot FLIX |
| SMTP provider | Email verifikasi akun, reset password, dan notifikasi auth |

## Endpoint Internal

Base URL production:

```text
https://flixprojectgroup5celerates.vercel.app
```

Header untuk endpoint login:

```text
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/auth/register` | Registrasi user Free |
| POST | `/api/auth/login` | Login dan mendapatkan JWT |
| GET/POST | `/api/auth/verify-email` | Verifikasi akun |
| POST | `/api/auth/forgot-password` | Kirim link reset password |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/bootstrap-admin` | Bootstrap akun admin production jika diaktifkan |

### Profile dan Settings

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/profile/me` | Profile user login |
| PUT | `/api/profile/me` | Update data profile |
| PUT | `/api/profile/password` | Update password |
| PUT | `/api/profile/media` | Update avatar/banner |
| GET | `/api/profile/activity` | Statistik aktivitas profile |
| DELETE | `/api/profile/me` | Hapus akun user |

### Movies dan TV Series

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/movies/search` | Search movie |
| GET | `/api/movies/popular` | Popular movies |
| GET | `/api/movies/top-rated` | Top rated movies |
| GET | `/api/movies/now-playing` | Now playing movies |
| GET | `/api/movies/upcoming` | Upcoming movies |
| GET | `/api/movies/trending` | Trending movies |
| GET | `/api/movies/genres` | Genre movie |
| GET | `/api/movies/discover` | Discover/filter movies |
| GET | `/api/movies/:id/recommendations` | Rekomendasi movie terkait |
| GET | `/api/movies/:id` | Detail movie |
| GET | `/api/movies/:id/videos` | Trailer movie |
| GET | `/api/movies/:id/credits` | Cast movie |
| GET | `/api/movies/:id/watch-providers` | Provider streaming movie |
| GET | `/api/tv-series/search` | Search TV series |
| GET | `/api/tv-series/popular` | Popular TV series |
| GET | `/api/tv-series/top-rated` | Top rated TV series |
| GET | `/api/tv-series/on-the-air` | TV series on the air |
| GET | `/api/tv-series/trending` | Trending TV series |
| GET | `/api/tv-series/genres` | Genre TV series |
| GET | `/api/tv-series/discover` | Discover/filter TV series |
| GET | `/api/tv-series/:id` | Detail TV series |
| GET | `/api/tv-series/:id/seasons/:seasonNumber` | Episode per season |
| GET | `/api/tv-series/:id/videos` | Trailer TV series |
| GET | `/api/tv-series/:id/watch-providers` | Provider streaming TV series |

Alias route:

- `/api/tmdb/*` memakai route yang sama dengan `/api/movies/*`.
- `/api/tv/*` memakai route yang sama dengan `/api/tv-series/*`.

### Watchlist dan Reviews

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/watchlist` | Watchlist user login |
| POST | `/api/watchlist` | Simpan film/series |
| DELETE | `/api/watchlist/:mediaType/:tmdbId` | Hapus watchlist |
| GET | `/api/movie-reviews/:movieId` | List review movie |
| POST | `/api/movie-reviews/:movieId` | Buat review movie |
| PUT | `/api/movie-reviews/:reviewId` | Edit review movie |
| DELETE | `/api/movie-reviews/:reviewId` | Hapus review movie |
| POST | `/api/movie-reviews/likes/:reviewId` | Like review movie |
| GET | `/api/tv-series-reviews/:seriesId` | List review TV series |
| POST | `/api/tv-series-reviews/:seriesId` | Buat review TV series |
| PUT | `/api/tv-series-reviews/:reviewId` | Edit review TV series |
| DELETE | `/api/tv-series-reviews/:reviewId` | Hapus review TV series |
| POST | `/api/tv-series-reviews/likes/:reviewId` | Like review TV series |

### Community

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/posts` | List post |
| POST | `/api/posts` | Buat post |
| GET | `/api/posts/:id` | Detail post |
| DELETE | `/api/posts/:id` | Hapus post |
| GET | `/api/comments/:postId` | List comment/reply |
| POST | `/api/comments/:postId` | Buat comment/reply |
| POST | `/api/post-likes/:postId` | Like/unlike post |
| POST | `/api/post-reactions/:postId` | Reaction post |
| POST | `/api/post-shares/:postId` | Share post |
| POST | `/api/post-views/:postId` | Record view post |
| GET | `/api/post-insights/:postId` | Insight post |
| GET | `/api/polls/post/:postId` | Polling post |
| POST | `/api/polls/:pollId/vote` | Vote polling |
| POST | `/api/reports` | Buat report konten/user |
| GET | `/api/reports/categories` | Kategori report |

### Friend, Chat, Notification, Chatbot

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/friends` | Friendlist |
| GET | `/api/friends/ids` | ID friendlist user login |
| GET | `/api/friends/search` | Cari user untuk add friend |
| GET | `/api/friends/requests` | Request pertemanan |
| POST | `/api/friends/:userId` | Add friend |
| DELETE | `/api/friends/:userId` | Remove friend |
| PUT | `/api/friends/requests/:friendId/accept` | Accept request |
| DELETE | `/api/friends/requests/:friendId/decline` | Decline request |
| GET | `/api/chats/conversations` | Inbox chat |
| POST | `/api/chats/conversations/:userId` | Mulai chat |
| GET | `/api/chats/conversations/:conversationId/messages` | List pesan chat |
| POST | `/api/chats/conversations/:conversationId/messages` | Kirim pesan chat |
| GET | `/api/notifications` | Notifikasi user |
| PUT | `/api/notifications/read-all` | Tandai semua dibaca |
| PUT | `/api/notifications/:id/read` | Tandai satu notifikasi dibaca |
| POST | `/api/chatbot` | Chatbot FLIX Eksklusif |

### Payment, Contact, dan Customer Service

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/payment/settings` | Setting harga dan metode pembayaran |
| GET | `/api/payment/current` | Transaksi aktif/pending user |
| POST | `/api/payment/checkout` | Kirim bukti pembayaran |
| POST | `/api/contact-us` | Kirim laporan/kritik/saran |
| GET | `/api/customer-service/tickets` | List tiket CS user |
| POST | `/api/customer-service/tickets` | Buat tiket CS |
| GET | `/api/customer-service/tickets/:id` | Detail tiket CS |
| POST | `/api/customer-service/tickets/:id/messages` | Kirim pesan tiket CS |
| POST | `/api/uploads/editor-image` | Upload gambar rich text editor |

### Admin dan Moderator

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/admin/dashboard` | Statistik dashboard admin |
| GET | `/api/admin/movies` | List film manual |
| POST | `/api/admin/movies` | Tambah film manual |
| PUT | `/api/admin/movies/:id` | Edit film manual |
| GET | `/api/admin/users` | List user |
| GET | `/api/admin/users/:id` | Detail user |
| PUT | `/api/admin/users/:id` | Update data user |
| POST | `/api/admin/users/:id/reset-password` | Reset password user |
| DELETE | `/api/admin/users/:id` | Hapus user non-admin |
| PATCH | `/api/admin/users/:id/status` | Aktif/nonaktif user |
| GET | `/api/admin/reviews` | Moderasi review |
| PATCH | `/api/admin/reviews/reports/:reportId/status` | Update status report review |
| GET | `/api/admin/community` | Moderasi community |
| PATCH | `/api/admin/community/reports/:reportId/status` | Update status report community |
| GET | `/api/admin/transactions` | List transaksi |
| PATCH | `/api/admin/transactions/:id/status` | Setujui/tolak transaksi |
| GET | `/api/admin/payment-settings` | Lihat payment settings |
| PUT | `/api/admin/payment-settings` | Update payment settings |
| GET | `/api/admin/contact-us` | Pesan Contact Us |
| PATCH | `/api/admin/contact-us/:id/status` | Update status Contact Us |
| GET | `/api/admin/customer-service/tickets` | List tiket CS |
| GET | `/api/admin/customer-service/tickets/:id` | Detail tiket CS |
| PATCH | `/api/admin/customer-service/tickets/:id/claim` | Ambil tiket CS |
| POST | `/api/admin/customer-service/tickets/:id/messages` | Balas tiket CS |
| PATCH | `/api/admin/customer-service/tickets/:id/close` | Selesaikan tiket CS |
| GET | `/api/moderator/dashboard` | Dashboard moderator |

## Catatan Pengembangan

- Jangan simpan API key asli di Git.
- Fitur Premium/Eksklusif harus divalidasi di backend dan frontend.
- Admin memiliki semua hak akses.
- Moderator dapat mengelola film, review, community, transaksi, dan report.
- User Free tetap boleh melihat/search konten dan membuat review, tetapi fitur community, friendlist, chat, dan watchlist unlimited membutuhkan upgrade.
- Chatbot FLIX hanya untuk plan Eksklusif.
- Jika menambah fitur baru yang berhubungan dengan akses user, tambahkan pengecekan di middleware backend dan util frontend.
