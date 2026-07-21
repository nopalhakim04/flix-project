# Known Limitations FLIX

Dokumen ini mencatat batasan teknis dan keputusan implementasi yang penting diketahui saat demo, deployment, atau pengembangan lanjutan.

## 1. Upload Disimpan sebagai Data URL

Production berjalan di Vercel yang bersifat stateless. File yang ditulis ke filesystem runtime tidak dijamin bertahan setelah redeploy/cold start.

Karena itu beberapa upload disimpan sebagai data URL di database:

- Avatar user.
- Banner profile.
- Logo/QR metode pembayaran.
- Bukti pembayaran.
- Gambar rich text editor.

Dampak:

- Upload tetap muncul setelah redeploy.
- Tidak perlu object storage tambahan.
- Database bisa membesar jika banyak gambar besar.
- Query tertentu bisa lebih berat jika data URL sangat panjang.

Rekomendasi lanjutan:

- Pindahkan upload ke Supabase Storage, Cloudinary, S3, atau object storage lain.
- Simpan hanya URL file di database.

## 2. Watchlist dan Progress Tontonan

Backend memiliki endpoint dan tabel `flix.user_watchlist`, tetapi beberapa progress UI seperti status sudah ditonton dan episode TV series masih mengandalkan `localStorage`.

Dampak:

- Status tontonan dapat berbeda antar browser/device.
- Jika browser storage dibersihkan, progress lokal hilang.
- Aplikasi sudah melakukan migrasi key localStorage lama agar watchlist tidak tampak hilang setelah status akun berubah.

Rekomendasi lanjutan:

- Simpan watch status dan episode progress ke database.
- Buat endpoint khusus progress watchlist.

## 3. Vercel Cold Start

Backend production di Vercel dapat mengalami cold start.

Dampak:

- Request pertama bisa lebih lambat.
- Harga paket/metode pembayaran bisa terlambat muncul jika tidak ditunggu.

Mitigasi yang sudah ada:

- Loading overlay pada halaman Premium dan Payment sampai setting pembayaran selesai dimuat.
- `SKIP_DATABASE_INIT=true` untuk mengurangi pekerjaan backend saat boot.

## 4. Email SMTP Membutuhkan Sender Valid

Provider SMTP production biasanya mensyaratkan sender/domain yang valid dan verified.

Dampak:

- Sender domain publik gratis sering ditolak.
- Email verifikasi/reset password tidak terkirim jika `MAIL_FROM` tidak valid.

Mitigasi:

- Gunakan sender/domain yang sudah verified.
- Production saat ini dapat memakai `REQUIRE_EMAIL_VERIFICATION=false` agar register tidak tertahan email.

## 5. Bootstrap Admin Harus Dimatikan

Endpoint bootstrap admin hanya untuk membuat admin awal.

Risiko:

- Jika `ENABLE_ADMIN_BOOTSTRAP=true` dibiarkan aktif, endpoint bisa menjadi risiko keamanan.

Mitigasi:

- Setelah admin dibuat, set `ENABLE_ADMIN_BOOTSTRAP=false`.
- Set `ADMIN_BOOTSTRAP_TOKEN=disabled` atau token kuat jika masih diperlukan sementara.

## 6. Paket Eksklusif Menggunakan Kode Legacy

Di database dan API, paket Eksklusif masih memakai kode `premium_yearly`.

Konteks:

- Awalnya paket tersebut dipakai sebagai paket tahunan.
- Saat ini UI memperlakukan Eksklusif sebagai harga bulanan Eksklusif.
- Durasi 1, 3, 6, dan 12 bulan dihitung dari harga bulanan paket yang dipilih.

Dampak:

- Nama kode `premium_yearly` tidak sepenuhnya menggambarkan perilaku terbaru.

Rekomendasi lanjutan:

- Migrasi kode paket ke `exclusive` di database dan backend.
- Sediakan compatibility mapping dari `premium_yearly` ke `exclusive`.

## 7. Dependency dan Bundle Size

Frontend memiliki bundle besar karena banyak fitur berada dalam satu aplikasi SPA.

Dampak:

- Vite memberi warning chunk di atas 500 KB.
- Initial load dapat lebih berat.

Rekomendasi lanjutan:

- Terapkan route-level code splitting.
- Lazy load admin dashboard, chatbot, editor, dan halaman detail.

## 8. Integrasi API Eksternal

FLIX bergantung pada beberapa API eksternal:

- TMDB untuk film/series.
- GIPHY untuk GIF.
- Gemini untuk chatbot.
- SMTP provider untuk email.

Dampak:

- Jika API key tidak valid atau limit habis, fitur terkait gagal.
- Beberapa halaman menampilkan fallback data jika TMDB gagal.

Rekomendasi lanjutan:

- Tambahkan monitoring error API.
- Tambahkan cache untuk request TMDB yang sering dipakai.

## 9. Data Demo dan Data Production

Beberapa data fallback masih disediakan di frontend agar UI tetap tampil saat API gagal.

Dampak:

- Saat API gagal, user bisa melihat data contoh/fallback.
- Perlu dibedakan saat demo apakah data berasal dari API atau fallback.

Rekomendasi lanjutan:

- Tambahkan state/error UI yang lebih eksplisit.
- Simpan cache data populer di database jika perlu.
