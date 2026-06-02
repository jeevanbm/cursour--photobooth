# Event Photo Booth

Dual-device photo booth (based on [cute-photobooth](https://github.com/lovesulei/cute-photobooth)):

| Device | URL | Role |
|--------|-----|------|
| iPad / phone | `https://your-app.vercel.app/capture` | Take 4 photos, frame, stickers, send to print queue |
| Laptop | `http://localhost:5173/station` + print server | Receive strips via Supabase, print DNP 2×6 |

## Stack

- **React (Vite)** — capture UI + print station
- **Supabase** — `photobooth` project, storage bucket `strips`, Realtime on `captures`
- **Vercel** — hosts capture app (HTTPS required for mobile camera)
- **Local print server** — `print-server/` talks to macOS CUPS (`lp`) for DNP printers

## Quick start

### 1. Supabase (`photobooth` project)

1. Run SQL in [supabase/migrations/20260602000000_photobooth_schema.sql](supabase/migrations/20260602000000_photobooth_schema.sql) in the SQL editor.
2. **Storage**: create bucket `strips`, set **public** read.
3. Storage policies (SQL editor):

```sql
create policy "strips public read" on storage.objects
  for select using (bucket_id = 'strips');
create policy "strips anon upload" on storage.objects
  for insert with check (bucket_id = 'strips');
```

4. **Realtime**:

```sql
alter publication supabase_realtime add table public.captures;
```

5. Copy **Project URL** and **anon key** from Supabase → Settings → API.

### 2. Web app

```bash
cd web
cp .env.example .env.local
# Edit VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

- Capture: http://localhost:5173/capture  
- Print station: http://localhost:5173/station  

### 3. Print server (laptop with DNP)

```bash
cd print-server
npm install
lpstat -p   # find exact printer name
export PRINTER_NAME="Your_DNP_Printer"
npm start
```

Health check: http://localhost:3847/health

### 4. Vercel

```bash
# From repo root
vercel
```

Set environment variables in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_EVENT_SLUG` (default: `default`)

Deploy root uses [vercel.json](vercel.json). Open `/capture` on tablets.

On the **laptop**, run `npm run dev` in `web/` for `/station` (or build and serve locally). Set `VITE_PRINT_SERVER_URL=http://localhost:3847`.

## Change frames per event

Default heart frames are in `web/public/assets/frames/` (from the reference repo).

**Option A — Supabase** (no redeploy):

```sql
insert into public.events (slug, name, frame_paths, is_active)
values (
  'wedding-2026',
  'Sarah & James',
  array['/assets/frames/heart-frame.png', '/assets/frames/heart-frame-2.png'],
  true
);
```

Set `VITE_EVENT_SLUG=wedding-2026` on Vercel for that event.

**Option B — add PNGs** under `web/public/assets/frames/` and list paths in `events.frame_paths`.

## DNP 2×6

Strips are resized to **600×1800 px** (2×6 @ 300 DPI) before printing. Tune CUPS media with:

```bash
export PRINT_MEDIA=w288h432   # example; depends on driver
```

## Project layout

```
event-photobooth/
  web/                 # React app (capture + station)
  print-server/        # Local Express → lp
  supabase/migrations/
  vercel.json
```

## Troubleshooting

- **Camera blocked on phone** — use HTTPS (Vercel), not plain HTTP.
- **Print station offline** — start `print-server` and set `PRINTER_NAME`.
- **Upload fails** — check `strips` bucket + storage policies.
- **No realtime** — enable replication on `captures` (see above).
