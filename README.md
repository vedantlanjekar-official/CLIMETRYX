# CLIMETRYX

*Climate signals. Clearer decisions. Stronger businesses.*

Next.js application for explainable climate-disruption vulnerability assessments of MSMEs, built for the FIN-05 brief.

The homepage sections are in `components/marketing/home/`. Homepage photographs are credited in their captions and in `public/images/editorial/credits.json`; satellite scene metadata is in `public/images/satellite/scenes.json`.

The original research note is `FIN-05_Research_Learning_Document.md`. It was not rewritten.

Start with `docs/DEPLOYMENT.md` and `docs/USER_GUIDE.md`. Current verification, gaps, and test results are in `IMPLEMENTATION_STATUS.md`.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` before connecting Supabase or Open-Meteo. The app runs without those values and shows which integrations are not configured.
