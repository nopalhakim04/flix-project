# FLIX Frontend

Frontend FLIX dibuat dengan React dan Vite. Struktur file sudah dipisah berdasarkan fitur agar lebih mudah dirawat.

## Menjalankan Frontend

```bash
npm install
npm run dev
```

Default URL:

```text
http://localhost:5173
```

## Environment

Buat file `.env` di folder `frontend`:

```env
VITE_API_URL=http://localhost:5000
VITE_GIPHY_API_KEY=api_key_giphy
```

## Struktur Folder

```text
src/
  app/              # Entry app dan routing utama
  assets/           # Logo, icon, font, emoticon, dan asset visual
  components/
    community/      # Komponen reusable untuk post/community
    editor/         # Rich text editor, GIF picker, renderer content
    layout/         # Navbar dan layout umum
    routing/        # Protected route
    ui/             # Modal, filter, search, confirm dialog
  features/
    admin/
    auth/
    community/
    genre/
    home/
    movies/
    profile/
    tv-series/
    watchlist/
  utils/
```

## Alias Import

Project memakai alias:

```js
@/ = src/
```

Contoh:

```js
import SiteNavbar from "@/components/layout/SiteNavbar";
import MoviesPage from "@/features/movies/MoviesPage";
```

Konfigurasi alias ada di `vite.config.js` dan `jsconfig.json`.

## Script

```bash
npm run dev      # menjalankan development server
npm run build    # build production
npm run preview  # preview hasil build
npm run lint     # menjalankan ESLint
```
