# Deployment FLIX

Dokumen ini menjelaskan deployment production FLIX.

## Layanan yang Digunakan

| Bagian | Layanan | URL |
| --- | --- | --- |
| Frontend | Vercel | `https://flixprojectgroup5celerates-zfkn.vercel.app` |
| Backend API | Vercel | `https://flixprojectgroup5celerates.vercel.app` |
| Database | Supabase PostgreSQL | Schema `flix` |
| SMTP | Provider SMTP production | Diatur dari env backend |

## Arsitektur Production

```mermaid
flowchart LR
  A["Browser User"] --> B["Frontend Vercel"]
  B --> C["Backend API Vercel"]
  C --> D["Supabase PostgreSQL"]
  C --> E["TMDB API"]
  C --> F["Gemini API"]
  C --> G["SMTP Provider"]
```

## Frontend Vercel

Frontend berada di folder `frontend` dan dibuild dengan Vite.

Environment production:

```env
VITE_API_URL=https://flixprojectgroup5celerates.vercel.app
VITE_GIPHY_API_KEY=giphy_api_key
```

Catatan:

- Semua request API frontend diarahkan ke `VITE_API_URL`.
- Jika backend URL berubah, update env frontend lalu redeploy frontend.
- Frontend memakai SweetAlert2 untuk modal/toast dengan tema FLIX.

## Backend Vercel

Backend berada di folder `backend` dan berjalan sebagai Node.js deployment di Vercel.

Environment production:

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

Catatan:

- `DATABASE_URL` mengarah ke Supabase PostgreSQL.
- `DB_SSL=true` dipakai untuk koneksi database cloud.
- `FRONTEND_URL` harus sama dengan domain frontend production untuk CORS dan link email.
- `SKIP_DATABASE_INIT=true` mengurangi cold start karena backend tidak melakukan init schema berat saat boot.
- `ENABLE_ADMIN_BOOTSTRAP=false` menjaga endpoint bootstrap admin tidak aktif setelah admin dibuat.

## Supabase PostgreSQL

Database memakai schema `flix`.

File schema awal:

```text
flix_db.sql
```

Tabel penting:

- `flix.users`
- `flix.roles`
- `flix.payment_methods`
- `flix.payment_packages`
- `flix.payment_transactions`
- `flix.user_watchlist`
- `flix.posts`
- `flix.comments`
- `flix.reports`
- `flix.friends`
- `flix.chat_messages`
- `flix.customer_service_tickets`

Backend memakai connection string Supabase langsung melalui `pg`, bukan Supabase client di frontend.

## Upload dan File Runtime

Vercel bersifat stateless. Karena itu upload production tidak mengandalkan folder runtime permanen.

Upload yang digunakan aplikasi:

| Upload | Penyimpanan production |
| --- | --- |
| Avatar/banner profile | Data URL di database |
| Logo/QR metode pembayaran | Data URL di database |
| Bukti pembayaran | Data URL di database |
| Gambar rich text editor | Data URL yang dikembalikan API |
| Lampiran customer service | Data URL/path yang disimpan backend sesuai controller |

Tradeoff pendekatan data URL:

- Cocok untuk demo dan deployment stateless sederhana.
- Tidak butuh object storage tambahan.
- Ukuran database bisa cepat membesar jika banyak gambar besar.
- Untuk production besar, pindahkan upload ke object storage seperti Supabase Storage, S3, atau Cloudinary.

## Email SMTP

Backend mendukung SMTP untuk:

- Verifikasi email.
- Reset password.
- Notifikasi auth/login.

Catatan provider:

- `MAIL_FROM` harus memakai sender/domain yang diizinkan provider SMTP.
- Provider seperti Resend tidak menerima free public domain sebagai sender.
- Jika `REQUIRE_EMAIL_VERIFICATION=false`, register production tidak menunggu email verifikasi.

## Checklist Deploy

1. Pastikan env backend Vercel lengkap.
2. Pastikan env frontend Vercel mengarah ke backend production.
3. Pastikan database Supabase sudah berisi schema `flix`.
4. Pastikan `JWT_SECRET` production kuat dan tidak sama dengan contoh.
5. Pastikan `ENABLE_ADMIN_BOOTSTRAP=false` setelah akun admin dibuat.
6. Redeploy backend jika env backend berubah.
7. Redeploy frontend jika env frontend berubah.
8. Uji flow utama: register/login, profile, payment, admin approve, community, upload.

## Troubleshooting Production

| Masalah | Penyebab umum | Tindakan |
| --- | --- | --- |
| Halaman lama memuat harga lama | Cold start/backend lambat | Loading overlay sudah disiapkan sampai data payment selesai |
| Register loading lama | Cold start atau email SMTP | Cek Vercel logs dan env email |
| Upload hilang setelah deploy | File disimpan di filesystem runtime | Gunakan data URL/object storage |
| Email tidak terkirim | Sender/domain belum verified | Verifikasi sender/domain SMTP |
| Database tidak masuk | `DATABASE_URL` salah atau schema belum import | Cek env backend dan Supabase SQL editor |
| CORS error | `FRONTEND_URL` salah | Sesuaikan env backend dengan domain frontend |
