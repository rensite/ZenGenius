# ZenGenius / LyricLens

Vue 3 + Pinia + Tailwind 3 single-page app for lyrics analysis: a Library of tracks, and a per-track Zen view with annotations, rhyme grouping, dictionary, references, and inline editing.

## Stack

- Vue 3 (`<script setup>`, Composition API) + TypeScript
- Vue Router 4 (history mode), Pinia 2
- Vite 6, vue-tsc (type-check on build)
- Tailwind 3 + PostCSS + Autoprefixer
- Path alias: `@` → `src/`

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # vue-tsc --noEmit && vite build
npm run preview
```

No test runner, no linter, no formatter configured.

## Routes

Defined in [src/router/index.ts](src/router/index.ts):

- `/` → redirects to `/library`
- `/library` → [LibraryView.vue](src/views/LibraryView.vue)
- `/track/:id` → [TrackView.vue](src/views/TrackView.vue) (the Zen view; all per-track UI lives here)
- `/track/:id/investigate`, `/track/:id/edit`, `/track/:id/rhymes` → all redirect to `/track/:id` (legacy paths; modes are now panels inside TrackView, not separate routes)

## Project layout

```
src/
  App.vue, main.ts
  api/
    index.ts          # picks driver: HttpDriver if VITE_API_URL set, else LocalDriver
    dataIO.ts         # import/export helpers
    drivers/          # local.driver.ts, http.driver.ts (DataDriver interface)
  components/         # TopBar, LyricLine, AnnotationPanel/Composer, TrackComposer, etc.
  router/index.ts
  seed/
    tracks.ts         # 3 seeded original songs
    extras.ts, index.ts
    parseLyrics.ts, serializeLyrics.ts   # plaintext ↔ Section[]/Line[]
  stores/             # Pinia: tracks, annotations, rhymes, dictionary, ui
  styles/main.css
  types/domain.ts     # Track, Section, Line, Annotation, RhymeGroup, DictionaryEntry
  views/              # LibraryView, TrackView
```

## Domain model

See [src/types/domain.ts](src/types/domain.ts):

- `Track` → `Section[]` (kind: intro/verse/chorus/bridge/…) → `Line[]`
- `Annotation` anchors to `(lineId, charStart, charEnd)`, tagged `translation` | `reference` | `dictionary`
- `RhymeGroup` has a `RhymeColor` (blue/purple/mint/gold/rose) and a list of `RhymeMark`s
- `DictionaryEntry` is per-track

IDs are strings. Stores are the source of truth; views/components read via Pinia.

## Storage / backend seam

Storage is abstracted behind `DataDriver` ([src/api/drivers](src/api/drivers/)):

- **Default:** `LocalDriver` over `localStorage`. Seeded on first load from [src/seed/tracks.ts](src/seed/tracks.ts).
- **REST:** set `VITE_API_URL=https://api.example.com` and [src/api/index.ts](src/api/index.ts) switches to `HttpDriver`. Endpoint shape (PUT/DELETE `/tracks/:id`, `/annotations/:id`, …) is documented in `http.driver.ts`.

Stores never touch storage directly — they call the driver, so swapping is a one-line change.

The "refresh" icon in the TopBar resets localStorage and re-seeds.

## Conventions

- Vue SFCs use `<script setup lang="ts">`.
- Imports use the `@/` alias (configured in [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)).
- Tailwind utility classes only; no scoped component CSS unless necessary. Global styles in [src/styles/main.css](src/styles/main.css).
- All persistence goes through stores → `DataDriver`. Never read/write `localStorage` from components.
