# QuarterMapper

PLSS Field Mapper for NE Oklahoma — Ottawa, Craig, and Delaware Counties.

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click "New Project" → import your repo
4. Framework preset: **Vite** (auto-detected)
5. Click "Deploy"

That's it. You'll get a URL like `quartermapper.vercel.app`.

## Supabase Setup

Already configured. If you need to reset:

- Project URL: `https://hrufrodmeqrsaxnjnira.supabase.co`
- Anon Key: in `src/supabase.js`

Make sure you've run the SQL from setup to create the `fields` table with Row Level Security.
