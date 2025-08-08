# LVIL Intake Portal (Next.js + Supabase + Zapier)

Production-ready starter for **Lehigh Valley Immigration Law LLC**.

## What you get
- Next.js frontend with 5-step intake wizard
- API route `/api/submit` accepts JSON + files (multipart/form-data)
- Supabase Postgres tables (`intakes`, `intake_files`) + private storage bucket `intake-uploads`
- Optional **Zapier** webhook to create Contact + Matter in **Clio** automatically
- Privacy defaults: PDFs/images only, max 25 MB each, 60-day retention (enforce via cron later)

## Setup (15–20 min)

1. **Create Supabase project**
   - Note the `Project URL` and `anon` and **service role** keys.

2. **Run SQL** (in Supabase → SQL Editor):
   ```sql
   -- see supabase.sql
   ```
   - Create a **Storage** bucket named `intake-uploads` (private).

3. **Create Zapier Catch Hook** (optional but recommended)
   - App: **Webhooks by Zapier** → Catch Hook
   - Use that URL as `INTAKE_WEBHOOK_URL`
   - Next steps in Zap: Clio → Create Contact, Create Matter; attach file URLs if you later expose signed URLs.

4. **Local dev**
   ```bash
   cp .env.example .env.local
   # Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INTAKE_WEBHOOK_URL
   npm i
   npm run dev
   ```

5. **Deploy**
   - **Vercel** → Import this repo → add the same env vars in Project Settings → Deploy.
   - **Supabase** already live; verify `intake-uploads` bucket exists.

## Notes
- The API route uploads binary files with the **service role** key; do **not** expose it to the browser.
- To add email verification on submit, connect Resend/Sendgrid in the API route after DB write.
- To enforce **automatic deletion after 60 days**, set a Supabase Scheduled Cron to delete old rows and their storage objects:
  ```sql
  delete from public.intake_files where submission_id in (
    select submission_id from public.intakes where created_at < now() - interval '60 days'
  );
  delete from public.intakes where created_at < now() - interval '60 days';
  ```
- To generate **signed download links** for files when pinging Zapier, add:
  ```ts
  const { data: signed } = await svc.storage.from('intake-uploads').createSignedUrl(path, 60*60);
  ```

## Branding
- Header tagline: “Where Immigration Law Meets Humanity”
- CTA: **Book Free Consultation** → https://lehighvalleyimmigrationlawyers.cliogrow.com

_Generated on 2025-08-08._
