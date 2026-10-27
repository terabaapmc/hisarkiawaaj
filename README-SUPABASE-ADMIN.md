# HisarKiAawaj — Supabase Backend & Admin Dashboard Guide

This document explains how to configure and run the full Supabase backend, database, authentication, storage, and secure admin dashboard for **HisarKiAawaj** (हिसार की आवाज़).

---

## Architecture Overview

```
                        ┌──────────────────────────────────────────────┐
                        │              Supabase Backend                │
                        │  - PostgreSQL Database (RLS Enforced)        │
                        │  - Supabase Auth (Admin Authentication)      │
                        │  - Supabase Storage ('news-media' Bucket)    │
                        └──────────────────────┬───────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
                       ▼                                               ▼
     ┌──────────────────────────────────┐            ┌──────────────────────────────────┐
     │      Public News Website         │            │      Secure Admin Dashboard      │
     │      (/index.html, /article.html)│            │      (/admin/dashboard.html)     │
     │                                  │            │                                  │
     │  - Read published articles       │            │  - Restricted to 'admin' role    │
     │  - Category filtering & search   │            │  - Create, Edit, Delete news     │
     │  - Scheduled articles hidden     │            │  - Upload images to Storage      │
     │  - Dynamic active advertisements │            │  - Manage categories & ad slots  │
     │  - Real-time Mandi Rates & City  │            │  - Schedule future publishing    │
     └──────────────────────────────────┘            └──────────────────────────────────┘
```

---

## 1. Quick Start / Running the Website

The project is hosted and running locally:

```bash
# Run local HTTP server
python -m http.server 8080 --directory "C:\Users\ojusr\.gemini\antigravity\scratch\hisarkiaawaj-news"
```

Access URLs:
- **Public Website**: [http://localhost:8080](http://localhost:8080)
- **Admin Login**: [http://localhost:8080/admin/login.html](http://localhost:8080/admin/login.html)
- **Admin Dashboard**: [http://localhost:8080/admin/dashboard.html](http://localhost:8080/admin/dashboard.html)

---

## 2. Supabase Setup in 5 Steps

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New Project**, choose an organization, give your project a name (e.g. `hisarkiaawaj`), set a secure database password, and choose your preferred region (e.g. `ap-south-1` Mumbai).

### Step 2: Run Database Migrations (`schema.sql`)
1. In your Supabase dashboard, open the **SQL Editor** from the left navigation.
2. Click **New Query**.
3. Open the file [`schema.sql`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/schema.sql) in this repository, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run** (Ctrl + Enter).
5. This script creates:
   - `profiles` table (links authenticated users to their role)
   - `categories` table (seeded with initial Hisar/Haryana categories)
   - `articles` table (with slug, excerpt, content, SEO fields, status, and published_at)
   - `advertisements` table (with placement slots matching all 6 ad zones)
   - Indexes for fast querying
   - Row Level Security (RLS) policies on all tables
   - Supabase Storage bucket `news-media` with public read and admin-only upload policies
   - Helper function `public.promote_to_admin(email)`

### Step 3: Create Your Administrator Account (Secure)
To strictly prevent unauthorized administrative access:
1. In the Supabase Dashboard, go to **Authentication &rarr; Users**.
2. Click **Add User &rarr; Create User**.
3. Enter your email (e.g. `admin@hisarkiaawaj.com`) and choose a strong password. Click **Create User**.
4. Now, go back to the **SQL Editor** and run:
   ```sql
   SELECT public.promote_to_admin('admin@hisarkiaawaj.com');
   ```
   *(Replace `'admin@hisarkiaawaj.com'` with the email you just created).*
5. The function confirms: `Success: admin@hisarkiaawaj.com has been granted administrator privileges.`

> [!IMPORTANT]
> Non-admin users who register through standard Supabase methods are automatically given the role `viewer` and CANNOT access the admin dashboard or modify data. Only users explicitly promoted using `promote_to_admin()` have admin rights.

### Step 4: Configure Project Credentials
1. In the Supabase Dashboard, go to **Project Settings &rarr; API**.
2. Copy your **Project URL** (e.g. `https://your-id.supabase.co`).
3. Copy your **Project API anon/public key** (`eyJhbGciOi...`).
4. Update [`supabase-config.js`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/supabase-config.js):
   ```javascript
   window.SUPABASE_CONFIG = {
     url: 'https://your-id.supabase.co',
     anonKey: 'your-anon-public-key'
   };
   ```
   *(Alternatively, you can click "Edit Supabase Connection" on the Admin Login page or in the Dashboard Settings to paste your keys directly).*

### Step 5: Log In to the Admin Dashboard
1. Open [http://localhost:8080/admin/login.html](http://localhost:8080/admin/login.html).
2. Enter your administrator email and password.
3. You will be securely authenticated and redirected to `/admin/dashboard.html`.

---

## 3. Row Level Security (RLS) Verification

| Table | Public Visitors (Anonymous) | Authenticated Administrators |
| :--- | :--- | :--- |
| `articles` | Read ONLY when `status = 'published'` AND `published_at <= NOW()` | Read all (drafts, scheduled), Create, Update, Delete |
| `advertisements` | Read ONLY when `is_active = true` within date range | Read all, Create, Toggle Active, Delete |
| `categories` | Read all | Create, Update, Delete |
| `profiles` | None | Read all, Update |
| `news-media` (Storage) | Read / Download all media publicly | Upload, Update, Delete files |

### Scheduled Publishing
When you create an article with status `Scheduled` and set a future publication date/time:
- The article stays in Supabase PostgreSQL, but is **completely invisible to public queries** because of the RLS policy:
  ```sql
  status = 'published' AND published_at <= timezone('utc'::text, now())
  ```
- As soon as the server's clock reaches your chosen publication time, the article immediately and automatically appears on the public website without needing your browser to remain open!

---

## 4. Managing News Articles & In-Between Ads

### Adding a News Article
1. In the Admin Dashboard, click **Add New Article**.
2. Fill in the Headline, Category, Short Summary, and write the story in the Rich-Text Editor.
3. Click **Click to Upload from Computer** under Featured Image — the image is uploaded directly to Supabase Storage `news-media` bucket and linked to the article.
4. Select `Published` to go live immediately, or `Scheduled` to set a future time.
5. Click **Save & Publish Article**.
6. The article appears instantly on the public website and at its dedicated page `/article.html?slug=your-slug`.

### Managing In-Between Advertisements
1. In the Admin Dashboard, click **Advertisements**.
2. You can manage all 6 placements:
   - `top_leaderboard` (Top 970x90 header banner)
   - `infeed_between_hero` (Between Hero spotlight and News Grid)
   - `infeed_card` (Native card inside the 2-column news grid)
   - `infeed_between_rows` (Separator banner between news batches)
   - `sidebar_carousel` (Right panel 3/6 carousel)
   - `our_clients` (Local sponsor showcase)
3. Upload any custom banner image, set the advertiser's destination link or WhatsApp number, and activate/deactivate with a single click.

---

## 5. File Inventory

- [`index.html`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/index.html) — Public homepage with live Supabase article and ad rendering.
- [`article.html`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/article.html) — Dedicated individual article reader page with full content, SEO metadata, and in-article ad.
- [`styles.css`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/styles.css) — Public news portal stylesheet with hybrid Indian Express + Aaj Tak header.
- [`app.js`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/app.js) — Public frontend controller connected to Supabase.
- [`supabase-config.js`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/supabase-config.js) — Supabase credentials configuration.
- [`supabase-client.js`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/supabase-client.js) — Centralized Supabase client, Auth role verifier, Storage uploader, and CRUD methods.
- [`schema.sql`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/schema.sql) — Production PostgreSQL schema, RLS policies, indexes, and storage rules.
- [`admin/login.html`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/admin/login.html) — Dedicated secure Admin login page.
- [`admin/dashboard.html`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/admin/dashboard.html) — Full CMS Admin Dashboard.
- [`admin/admin.css`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/admin/admin.css) — CMS Dashboard styling.
- [`admin/admin.js`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/admin/admin.js) — CMS Dashboard controller logic.
- [`.env.example`](file:///C:/Users/ojusr/.gemini/antigravity/scratch/hisarkiaawaj-news/.env.example) — Environment variables template.
