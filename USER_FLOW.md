# User Flow FLIX

Dokumen ini merangkum alur utama pengguna, subscription, admin, moderator, dan customer service di website FLIX.

## 1. Pengunjung Baru

```mermaid
flowchart TD
  A["Buka FLIX"] --> B["Lihat Home"]
  B --> C["Jelajahi Movies, TV Series, atau Genre"]
  C --> D["Search film/series"]
  D --> E["Buka detail film/series"]
  E --> F{"Butuh fitur login?"}
  F -- "Simpan watchlist / review / community / chat" --> G["Muncul popup login atau daftar"]
  F -- "Hanya melihat konten" --> C
  G --> H["Register atau Login"]
```

## 2. Register, Verifikasi, dan Login

```mermaid
flowchart TD
  A["User daftar"] --> B["Backend membuat akun Free"]
  B --> C{"REQUIRE_EMAIL_VERIFICATION aktif?"}
  C -- "Ya" --> D["Email verifikasi dikirim"]
  D --> E["User klik tombol verifikasi"]
  C -- "Tidak" --> F["Akun langsung bisa login"]
  E --> G["Login"]
  F --> G
  G --> H["Navbar berubah ke mode user login"]
```

Catatan production saat ini: `REQUIRE_EMAIL_VERIFICATION=false`, sehingga register tidak menunggu email verifikasi.

## 3. Film, TV Series, dan Watchlist

```mermaid
flowchart TD
  A["User cari film/series"] --> B["Buka detail"]
  B --> C["Lihat sinopsis, cast, genre, trailer, provider"]
  C --> D["Klik simpan watchlist"]
  D --> E{"Plan user"}
  E -- "Free kurang dari 10 item" --> F["Masuk watchlist"]
  E -- "Free sudah 10 item" --> G["Diminta upgrade Premium/Eksklusif"]
  E -- "Premium/Eksklusif" --> F
  F --> H["Kelola status sudah/belum ditonton"]
  H --> I["Untuk TV series, pilih season dan episode"]
```

Catatan teknis: watchlist backend tersedia di `flix.user_watchlist`, sedangkan beberapa progress tontonan seperti episode/status watched masih disimpan di browser storage.

## 4. Review Film dan TV Series

```mermaid
flowchart TD
  A["Buka detail film/series"] --> B["Klik Review"]
  B --> C["Klik Berikan Review"]
  C --> D["Isi rating, review, dan mood"]
  D --> E["Submit"]
  E --> F["Review tampil di detail dan Profile"]
  F --> G["User dapat edit atau hapus review miliknya"]
```

## 5. Community

```mermaid
flowchart TD
  A["Buka Community"] --> B{"Premium/Eksklusif?"}
  B -- "Tidak" --> C["Fitur terkunci dan diarahkan upgrade"]
  B -- "Ya" --> D["Buat post, comment, reply, reaction, share, polling"]
  D --> E["Notifikasi dikirim ke pemilik konten"]
  E --> F["Post tampil di Community dan Detail Post"]
  F --> G["Konten dapat dilaporkan"]
```

## 6. Friendlist dan Chat

```mermaid
flowchart TD
  A["User Premium/Eksklusif"] --> B["Klik nama user di post/reply/profile"]
  B --> C["Add Friend atau Message"]
  C --> D["User lain menerima request"]
  D --> E["Accept atau Decline"]
  E --> F["Jika diterima, masuk Friendlist"]
  F --> G["Mulai private chat"]
```

## 7. Upgrade Premium/Eksklusif

```mermaid
flowchart TD
  A["Klik Upgrade Premium"] --> B{"Ada transaksi pending?"}
  B -- "Ya" --> C["Diarahkan ke Payment pending"]
  B -- "Tidak" --> D["Pilih paket Premium atau Eksklusif"]
  D --> E["Pilih durasi 1, 3, 6, atau 12 bulan"]
  E --> F["Harga dihitung dari harga bulanan paket terpilih"]
  F --> G["Pilih QR Code, E-Wallet, atau Bank"]
  G --> H["Upload bukti pembayaran"]
  H --> I["Status pending"]
  I --> J["Admin cek transaksi"]
  J -- "Setuju" --> K["Plan user aktif"]
  J -- "Tolak" --> L["Transaksi ditolak"]
```

Catatan paket: Eksklusif memakai kode `premium_yearly` di API/database, tetapi UI memperlakukannya sebagai harga bulanan Eksklusif. Durasi 12 bulan berarti 12 kali harga bulanan Eksklusif.

Catatan upload: bukti pembayaran disimpan sebagai data URL di database agar tetap tersedia di deployment Vercel yang stateless.

## 8. Chatbot FLIX

```mermaid
flowchart TD
  A["User klik Chatbot FLIX"] --> B{"Plan Eksklusif?"}
  B -- "Tidak" --> C["Muncul pesan chatbot hanya untuk Eksklusif"]
  B -- "Ya" --> D["User bertanya film, fitur FLIX, atau pertanyaan umum"]
  D --> E["Gemini menjawab sebagai asisten FLIX"]
  E --> F["Jika ada judul/page, chatbot memberi tautan terkait"]
```

## 9. Contact Us dan Customer Service

```mermaid
flowchart TD
  A["User buka Contact Us"] --> B{"Pilih mode"}
  B -- "Form laporan/kritik/saran" --> C["Submit pesan"]
  C --> D["Masuk Report admin"]
  B -- "Customer Service" --> E["Bot meminta kategori"]
  E --> F["User menjelaskan masalah dan upload lampiran"]
  F --> G["Sistem membuat tiket"]
  G --> H["Admin/moderator mengambil tiket"]
  H --> I["Chat lanjut dengan admin/moderator"]
  I --> J["Tiket selesai dan read-only"]
```

Lampiran customer service mengikuti mekanisme upload backend dan tidak mengandalkan folder runtime permanen untuk production.

## 10. Admin dan Moderator

```mermaid
flowchart TD
  A["Admin/moderator login"] --> B["Buka dashboard"]
  B --> C["Kelola Film"]
  B --> D["Moderasi Review"]
  B --> E["Moderasi Community"]
  B --> F["Transaksi"]
  B --> G["Report dan Customer Service"]
  B --> H{"Role admin?"}
  H -- "Ya" --> I["Kelola User dan nonaktifkan/aktifkan user"]
  H -- "Tidak" --> J["Akses kelola user ditutup"]
```

## 11. Moderasi Report

```mermaid
flowchart TD
  A["User melaporkan review/post/comment/reply/user"] --> B["Laporan masuk admin/moderator"]
  B --> C["Admin buka detail"]
  C --> D{"Keputusan"}
  D -- "Blokir" --> E["Konten masuk tab terblokir"]
  D -- "Tolak" --> F["Laporan ditolak"]
  E --> G["Admin dapat mengembalikan konten"]
```

## Ringkasan Hak Akses

| Plan | Fokus Akses |
| --- | --- |
| Free | Lihat/search film dan series, review, watchlist maksimal 10 |
| Premium | Semua fitur Free, community, chat, friendlist, watchlist unlimited, badge premium |
| Eksklusif | Semua fitur Premium ditambah Chatbot FLIX dan badge Eksklusif |

| Role | Fokus Akses |
| --- | --- |
| registered_user | Akses berdasarkan plan |
| moderator | Kelola film, review, community, transaksi, dan report |
| admin | Semua akses termasuk kelola user |
