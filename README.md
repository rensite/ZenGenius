# LyricLens

Vue 3 + Pinia + Tailwind 3 app. Production-ready scaffold for a lyrics-analysis platform — Library, Analysis, Investigation (with inspector), Editor, Rhyme Mapping.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Backend seam

Storage is abstracted behind `DataDriver` (`src/api/drivers/local.driver.ts`).

- Default: `LocalDriver` over `localStorage`. Seeded on first load with 3 original songs (`src/seed/tracks.ts`).
- Switch to REST: set `VITE_API_URL=https://api.example.com` — `src/api/index.ts` will pick `HttpDriver` instead. The endpoint shape is documented in `http.driver.ts` (PUT/DELETE `/tracks/:id`, `/annotations/:id`, etc.).

Stores never touch storage directly — they call the driver, so swapping is a one-line change.

## Routes

- `/library`
- `/track/:id` — Zen analysis (control pill: References / Dictionary / Annotations / Rhymes / Misheard)
- `/track/:id/investigate` — Lyric reader + inspector sidebar
- `/track/:id/edit` — Inline editor with annotation popover
- `/track/:id/rhymes` — Pick a color, click words to group rhymes

The "refresh" icon in the top bar resets localStorage and re-seeds.
