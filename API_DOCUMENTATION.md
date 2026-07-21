# API Documentation FLIX

Dokumen ini merangkum API internal FLIX yang digunakan frontend production.

## Base URL

```text
https://flixprojectgroup5celerates.vercel.app
```

## Authentication

Endpoint private memakai JWT dari login.

```http
Authorization: Bearer <token>
```

Role dan akses fitur tetap divalidasi di backend:

| Akses | Keterangan |
| --- | --- |
| Public | Bisa diakses tanpa token atau memakai optional token |
| User login | Wajib JWT valid |
| Premium | Wajib user Premium atau Eksklusif |
| Eksklusif | Wajib user Eksklusif |
| Admin | Wajib role `admin` |
| Moderator | Wajib role `moderator` atau `admin` sesuai route |

## Response Error Umum

```json
{
  "message": "Pesan error",
  "error": "Detail teknis jika tersedia"
}
```

Status umum:

| Status | Arti |
| --- | --- |
| 400 | Request tidak valid |
| 401 | Token tidak ada atau tidak valid |
| 403 | Role/plan tidak punya akses |
| 404 | Data tidak ditemukan |
| 500 | Error server atau database |

## Auth

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Registrasi user Free |
| POST | `/api/auth/login` | Public | Login dan mendapatkan JWT |
| GET | `/api/auth/verify-email` | Public | Verifikasi akun dari token query |
| POST | `/api/auth/verify-email` | Public | Verifikasi akun dari body token |
| POST | `/api/auth/forgot-password` | Public | Kirim link reset password |
| POST | `/api/auth/reset-password` | Public | Reset password |
| POST | `/api/auth/bootstrap-admin` | Protected by env/token | Bootstrap akun admin jika diaktifkan |

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "username": "userflix",
  "email": "user@example.com",
  "password": "password123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response ringkas:

```json
{
  "message": "Login berhasil",
  "token": "jwt_token",
  "user": {
    "id_user": 1,
    "username": "userflix",
    "email": "user@example.com",
    "role": "registered_user",
    "is_premium": false,
    "subscription_plan": "free"
  }
}
```

## Profile

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/profile/me` | User login | Profile user login |
| GET | `/api/profile/activity` | User login | Statistik profile |
| PUT | `/api/profile/me` | User login | Update username/email |
| PUT | `/api/profile/password` | User login | Update password |
| PUT | `/api/profile/media` | User login | Update avatar/banner |
| DELETE | `/api/profile/me` | User login | Hapus akun |

### Update Media Profile

```http
PUT /api/profile/media
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "profile_image_url": "data:image/jpeg;base64,...",
  "banner_image_url": "data:image/jpeg;base64,..."
}
```

## Movies dan TV Series

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/movies/search` | Public | Search movie |
| GET | `/api/movies/popular` | Public | Popular movies |
| GET | `/api/movies/top-rated` | Public | Top rated movies |
| GET | `/api/movies/now-playing` | Public | Now playing movies |
| GET | `/api/movies/upcoming` | Public | Upcoming movies |
| GET | `/api/movies/trending` | Public | Trending movies |
| GET | `/api/movies/genres` | Public | Genre movie |
| GET | `/api/movies/discover` | Public | Discover/filter movies |
| GET | `/api/movies/:id` | Public | Detail movie |
| GET | `/api/movies/:id/recommendations` | Public | Rekomendasi movie |
| GET | `/api/movies/:id/videos` | Public | Trailer movie |
| GET | `/api/movies/:id/credits` | Public | Cast movie |
| GET | `/api/movies/:id/watch-providers` | Public | Provider streaming movie |
| GET | `/api/tv-series/search` | Public | Search TV series |
| GET | `/api/tv-series/popular` | Public | Popular TV series |
| GET | `/api/tv-series/top-rated` | Public | Top rated TV series |
| GET | `/api/tv-series/on-the-air` | Public | TV series on the air |
| GET | `/api/tv-series/trending` | Public | Trending TV series |
| GET | `/api/tv-series/genres` | Public | Genre TV series |
| GET | `/api/tv-series/discover` | Public | Discover/filter TV series |
| GET | `/api/tv-series/:id` | Public | Detail TV series |
| GET | `/api/tv-series/:id/seasons/:seasonNumber` | Public | Episode per season |
| GET | `/api/tv-series/:id/videos` | Public | Trailer TV series |
| GET | `/api/tv-series/:id/watch-providers` | Public | Provider streaming TV series |

Alias:

- `/api/tmdb/*` sama dengan `/api/movies/*`.
- `/api/tv/*` sama dengan `/api/tv-series/*`.

## Watchlist

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/watchlist` | User login | Watchlist user |
| POST | `/api/watchlist` | User login | Simpan film/series |
| DELETE | `/api/watchlist/:mediaType/:tmdbId` | User login | Hapus watchlist |

```json
{
  "media_type": "movie",
  "tmdb_id": 550,
  "title": "Fight Club",
  "poster_url": "https://...",
  "release_year": "1999",
  "rating": "8.4",
  "metadata": {}
}
```

Free dibatasi 10 item. Premium dan Eksklusif unlimited.

## Reviews

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/movie-reviews/:movieId` | Public | List review movie |
| POST | `/api/movie-reviews/:movieId` | User login | Buat review movie |
| PUT | `/api/movie-reviews/:reviewId` | Owner | Edit review movie |
| DELETE | `/api/movie-reviews/:reviewId` | Owner | Hapus review movie |
| POST | `/api/movie-reviews/likes/:reviewId` | User login | Like review movie |
| GET | `/api/tv-series-reviews/:seriesId` | Public | List review TV series |
| POST | `/api/tv-series-reviews/:seriesId` | User login | Buat review TV series |
| PUT | `/api/tv-series-reviews/:reviewId` | Owner | Edit review TV series |
| DELETE | `/api/tv-series-reviews/:reviewId` | Owner | Hapus review TV series |
| POST | `/api/tv-series-reviews/likes/:reviewId` | User login | Like review TV series |

```json
{
  "content": "Review film",
  "rating": 5
}
```

## Community

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/posts` | Public/optional token | List post |
| POST | `/api/posts` | Premium | Buat post |
| GET | `/api/posts/:id` | Public/optional token | Detail post |
| DELETE | `/api/posts/:id` | Owner/Admin | Hapus post |
| GET | `/api/comments/:postId` | Public/optional token | List comment/reply |
| POST | `/api/comments/:postId` | Premium | Buat comment/reply |
| POST | `/api/post-likes/:postId` | Premium | Like/unlike post |
| POST | `/api/post-reactions/:postId` | Premium | Reaction post |
| POST | `/api/post-shares/:postId` | Premium | Catat share post |
| POST | `/api/post-views/:postId` | User login | Catat view post |
| GET | `/api/post-insights/:postId` | User login | Insight post |
| GET | `/api/polls/post/:postId` | Public | Polling post |
| POST | `/api/polls/:pollId/vote` | Premium | Vote polling |
| GET | `/api/reports/categories` | Public | Kategori report |
| POST | `/api/reports` | User login | Buat report konten/user |

`POST /api/posts` memakai `multipart/form-data` jika ada gambar.

```text
title: string
content: string
post_type: post | poll
tags: JSON string
poll_options: JSON string
image: file optional
```

## Friend, Chat, Notification, Chatbot

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/friends` | Premium | Friendlist |
| GET | `/api/friends/ids` | Premium | ID friendlist |
| GET | `/api/friends/search` | Premium | Cari user |
| GET | `/api/friends/requests` | Premium | Request pertemanan |
| POST | `/api/friends/:userId` | Premium | Add friend |
| DELETE | `/api/friends/:userId` | Premium | Remove/decline friend |
| PUT | `/api/friends/requests/:friendId/accept` | Premium | Accept request |
| DELETE | `/api/friends/requests/:friendId/decline` | Premium | Decline request |
| GET | `/api/chats/conversations` | Premium | Inbox chat |
| POST | `/api/chats/conversations/:userId` | Premium | Mulai chat |
| GET | `/api/chats/conversations/:conversationId/messages` | Premium | List pesan |
| POST | `/api/chats/conversations/:conversationId/messages` | Premium | Kirim pesan |
| GET | `/api/notifications` | User login | Notifikasi |
| PUT | `/api/notifications/read-all` | User login | Tandai semua dibaca |
| PUT | `/api/notifications/:id/read` | User login | Tandai satu dibaca |
| POST | `/api/chatbot` | Eksklusif | Chatbot FLIX |

## Payment, Contact, Customer Service, Upload

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/payment/settings` | Public | Harga dan metode pembayaran |
| GET | `/api/payment/current` | User login | Transaksi pending user |
| POST | `/api/payment/checkout` | User login | Kirim bukti pembayaran |
| POST | `/api/contact-us` | Optional token | Kirim Contact Us |
| GET | `/api/customer-service/tickets` | User login | List tiket user |
| POST | `/api/customer-service/tickets` | User login | Buat tiket |
| GET | `/api/customer-service/tickets/:id` | User login | Detail tiket |
| POST | `/api/customer-service/tickets/:id/messages` | User login | Kirim pesan tiket |
| POST | `/api/uploads/editor-image` | User login | Upload gambar rich text editor |

`POST /api/payment/checkout` memakai `multipart/form-data`.

```text
payment_proof: file
packageCode: premium | premium_yearly
packageName: Premium Bulanan | Eksklusif
durationMonths: 1 | 3 | 6 | 12
paymentMethod: qris | bank | ewallet
amount: number
adminFee: number
totalAmount: number
```

## Admin dan Moderator

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | Admin | Statistik dashboard |
| GET | `/api/admin/movies` | Admin/Moderator | List film manual |
| POST | `/api/admin/movies` | Admin/Moderator | Tambah film manual |
| PUT | `/api/admin/movies/:id` | Admin/Moderator | Edit film manual |
| GET | `/api/admin/reviews` | Admin/Moderator | Moderasi review |
| PATCH | `/api/admin/reviews/reports/:reportId/status` | Admin/Moderator | Update report review |
| GET | `/api/admin/community` | Admin/Moderator | Moderasi community |
| PATCH | `/api/admin/community/reports/:reportId/status` | Admin/Moderator | Update report community |
| GET | `/api/admin/contact-us` | Admin/Moderator | List Contact Us |
| PATCH | `/api/admin/contact-us/:id/status` | Admin/Moderator | Update status Contact Us |
| GET | `/api/admin/customer-service/tickets` | Admin/Moderator | List tiket CS |
| GET | `/api/admin/customer-service/tickets/:id` | Admin/Moderator | Detail tiket CS |
| PATCH | `/api/admin/customer-service/tickets/:id/claim` | Admin/Moderator | Ambil tiket CS |
| POST | `/api/admin/customer-service/tickets/:id/messages` | Admin/Moderator | Balas tiket CS |
| PATCH | `/api/admin/customer-service/tickets/:id/close` | Admin/Moderator | Selesaikan tiket CS |
| GET | `/api/admin/transactions` | Admin/Moderator | List transaksi |
| PATCH | `/api/admin/transactions/:id/status` | Admin/Moderator | Approve/reject transaksi |
| GET | `/api/admin/payment-settings` | Admin/Moderator | Lihat payment settings |
| PUT | `/api/admin/payment-settings` | Admin/Moderator | Update payment settings |
| GET | `/api/admin/users` | Admin | List user |
| GET | `/api/admin/users/:id` | Admin | Detail user |
| PUT | `/api/admin/users/:id` | Admin | Update user |
| POST | `/api/admin/users/:id/reset-password` | Admin | Reset password user |
| DELETE | `/api/admin/users/:id` | Admin | Hapus user non-admin |
| PATCH | `/api/admin/users/:id/status` | Admin | Aktif/nonaktif user |
| GET | `/api/moderator/dashboard` | Admin/Moderator | Dashboard moderator |

Status report/transaksi umumnya dikirim sebagai:

```json
{
  "status": "approved",
  "admin_note": "Catatan optional"
}
```
