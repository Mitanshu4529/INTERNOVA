# INTERNOVA — Professional Internship Platform

INTERNOVA is a production-refined internship recommendation and talent portal built with React 18, TypeScript, Tailwind CSS, Radix UI, Supabase JS, and dataset processing pipelines. Features role-based dashboards for students and employers, resume AI parsing, real-time application tracking, and custom dataset ingestion from CSV files.

---

## Features & Architecture

### 1. Dual Role Portal Architecture
* **Candidate / Student Portal:** Browse internships, search by skill/location, upload resumes (PDF/TXT) with automated skill extraction, track application status (Applied, Under Review, Accepted, Rejected), save bookmarked roles, and communicate with recruiters.
* **Employer / Company Dashboard:** Post new internship listings, view candidate applicants, review resume score matches, update application statuses, and issue direct notifications.

### 2. Dataset Pipeline & Ingestion
* **Data Import Manager (`DataImportManager.tsx`):** Ingests internship datasets (e.g. Internshala, Naukri, Prosple) directly from CSV files into local cache and Supabase backend with automatic duplicate elimination.

### 3. Skill Matching & AI Resume Parser
* **Resume Parser (`resumeParser.ts`):** Extracts text from uploaded PDF/text resumes using `pdfjs-dist` and matches candidate skill vectors against internship requirements.

* **Match percentage:** each listing is scored against the student's profile, and only factors that can actually be compared are counted. Skills and location count whenever the profile has them. Stipend and work mode count only when the student states a preference (My Profile → Preferred Work Mode, Minimum Stipend). Experience and CGPA count only for listings that state a requirement. The weights of the factors that apply are rescaled to add up to 1, so a full match is 100% and an unrelated listing is close to 0%. "Why this match?" on each card shows the factors that were compared and what was left out.
* **Skills from titles:** the imported catalogue states no skills, so likely skills are read from each listing's title (`listingSkills.ts`) and labelled "Likely skills".
* **Places:** renamed cities are treated as the same place (Bangalore/Bengaluru), and cities in one commuting area (for example Delhi, Noida and Gurugram) count as a partial match (`locations.ts`).

### 4. Accounts and Data Access
* **Real accounts:** sign-up, sign-in, session restore and sign-out use Supabase Auth. The account type (student or company) is fixed at sign-up by a database trigger and cannot be changed from the browser. Every read and write goes to the database and is authorised by row level security; if a write is rejected the user is told, it is never kept locally as a fake success.
* **Demo mode:** an explicit "Try the demo" entry on the sign-in page (no password). Everything done in the demo is stored in this browser only and is never written to the database; a banner is shown for as long as it is active.
* **Access rules:** `supabase/migrations/20261118000001_accounts_and_access_rules.sql` must be run once in the Supabase SQL editor. It grants the minimum table privileges, defines the row level security policies, removes the unused plain-text `password` column, and adds integrity constraints. Confirm-email is supported: after sign-up the user is asked to open the emailed link before signing in.

---

## Directory Structure

```text
INTERNOVA/
├── src/
│   ├── components/
│   │   ├── AuthPage.tsx             # Role-based login & registration
│   │   ├── CompanyDashboard.tsx     # Employer candidate & posting management
│   │   ├── DataImportManager.tsx    # CSV dataset ingestion UI
│   │   ├── LandingPage.tsx          # Marketing & discovery landing screen
│   │   ├── UserDashboard.tsx        # Student application tracker & resume parser
│   │   └── ui/                      # Radix UI reusable design system components
│   ├── data/
│   │   └── dataStore.ts             # DataStore layer & caching
│   ├── utils/
│   │   ├── api.ts                   # Supabase API client methods
│   │   ├── resumeParser.ts          # PDF/TXT resume text & skill extractor
│   │   └── supabaseClient.ts        # Supabase client initializer
│   ├── __tests__/
│   │   └── dataStore.test.ts        # Vitest unit test suite
│   ├── App.tsx                      # App root router
│   └── main.tsx                     # React entrypoint
├── package.json                     # Dependencies & build scripts
├── vitest.config.ts                 # Vitest test configuration
└── vite.config.ts                   # Vite build configuration
```

---

## Build & Test Instructions

### Prerequisites
* Node.js 18+
* npm

### Commands
```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Execute unit tests
npm run test

# 4. Build production bundle
npm run build
```

---

## Environment Variables (.env)

```env
VITE_SUPABASE_URL=https://your-supabase-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
