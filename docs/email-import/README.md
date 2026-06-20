# Email transaction import

Forwarded bank-alert emails → parsed → land in an in-app **review queue** where
you confirm the amount and pick a bucket before they become real expenses.

## Architecture

```
Bank → (source Gmail, filtered) → forward → jazlynlim99@gmail.com
        └─ Gmail filter labels them `buckets-import`
              └─ Apps Script (every 15 min) reads labelled mail
                    └─ POST /import-email  (X-Import-Secret header)
                          └─ Convex HTTP action → parse → pendingTransactions
                                └─ Review queue screen → confirm → expenses.create
```

No mailbox token is ever stored on a server. The Apps Script runs as you, on
your own Gmail, and only ever touches `buckets-import`-labelled mail.

## Backend pieces (already in the repo)

| File | Purpose |
|------|---------|
| `convex/schema.ts` → `pendingTransactions` | review-queue table |
| `convex/lib/emailParsers.ts` | per-bank parsers (DBS/OCBC/HSBC/Amex) |
| `convex/http.ts` → `POST /import-email` | secret-guarded ingest endpoint |
| `convex/pendingTransactions.ts` | `ingest` / `listPending` / `pendingCount` / `confirm` / `dismiss` |
| `src/screens/ReviewQueue.web.tsx` | review UI |
| `Settings.tsx` "Review queue" row | entry point + pending-count badge |

## One-time setup

### 1. Pick a shared secret and set it on Convex

```sh
# generate a random secret
openssl rand -hex 24

# set it on whichever deployment serves the endpoint (dev shown):
npx convex env set BUCKETS_IMPORT_SECRET <that-secret>

# optional: pin imports to your account by email (else the first user is used)
npx convex env set BUCKETS_IMPORT_EMAIL jaz@bluejay.finance
```

### 2. Your endpoint URL

HTTP actions are served from the `.convex.site` domain (NOT `.convex.cloud`):

- dev `polite-gull-255` → `https://polite-gull-255.convex.site/import-email`
- dev `rightful-goldfinch-115` → `https://rightful-goldfinch-115.convex.site/import-email`

Use the deployment you actually run. Deploy the new functions first:
`npx convex dev` (dev) or `npx convex deploy` (prod).

### 3. Gmail (dedicated account `jazlynlim99@gmail.com`)

Create a filter that **labels** incoming bank alerts `buckets-import`:
- ⚙️ → Filters → Create a new filter
- From: `from:(dbs.com.sg OR posb.com.sg OR ocbc.com OR hsbc.com.sg OR hsbc.com OR americanexpress.com OR aexp.com)`
- Create filter → tick **Apply label** → new label `buckets-import`

### 4. Apps Script

Follow the header comment in `AppsScript.gs`: paste it into a new
script.google.com project bound to the dedicated Gmail, set the `IMPORT_URL`
and `IMPORT_SECRET` script properties, run once to grant permission, then add a
15-minute time trigger.

## Direction: spends vs received money

Real SG alerts are mostly PayNow / transfer notifications, and they have a
**direction**:

- **Money out** (HSBC card spend, OCBC "was sent to …") → becomes a pending
  **expense** in the review queue. You confirm amount + bucket. ✅
- **Money in** (DBS "You have received … via PayNow") → auto-captured as
  **income** (a confirmed `monthlyIncome` row for the month it arrived, noted
  "Received from {payer}"). It does *not* go through the review queue, and never
  becomes a phantom expense. (status `income`)

Both paths de-dup on the email Message-ID, so re-forwards don't double-count.

## Testing without waiting for a real alert

This OCBC outgoing transfer parses as a SGD 4.20 spend to "Hainanese curry rice":

```sh
curl -X POST https://<YOUR-DEPLOYMENT>.convex.site/import-email \
  -H 'Content-Type: application/json' \
  -H 'X-Import-Secret: <your-secret>' \
  -d '{
    "from": "Notifications@ocbc.com",
    "subject": "Your funds transfer via Google Pay is successful",
    "body": "Dear Valued Customer SGD4.20 was sent to Hainanese curry rice using his/her mobile number (+XXXXXX0314). Date of transfer: 26-May-2026",
    "messageId": "test-ocbc-001"
  }'
```

Then open the app → Settings → **Review queue** — it should be waiting, parsed
as OCBC / SGD 4.20 / "Hainanese curry rice". (A DBS *received* alert posted the
same way returns `income` and adds a confirmed `monthlyIncome` row instead of a
review-queue item — that's correct.)

## Tuning the parsers

The regexes in `convex/lib/emailParsers.ts` are starting points. Once you have a
**real alert from each bank**, paste its plain-text body and adjust only that
bank's parser. The router cross-tries every parser and falls back to an
`unknown` row (amount 0) rather than dropping anything, so a bad parse always
surfaces for manual fixing rather than vanishing.
```
