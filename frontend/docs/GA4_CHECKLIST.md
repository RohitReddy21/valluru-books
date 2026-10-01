# GA4 setup and checks

Measurement ID: `G-HYV3VRYR06`. The tag loads from `frontend/app/(public)/layout.tsx` and is
left off on a sandbox (`NEXT_PUBLIC_SANDBOX=1`).

## What the site sends

| Event | When | Parameters |
| --- | --- | --- |
| `page_view` | First page of a visit (`config` in the layout) and every client-side page change (`GaPageView`) | `page_path`, `page_location`, `page_title` |
| `sign_up` | An email is accepted | `method=email_subscription`, `signup_source`, `booklet_slug` (booklet surfaces only) |

`signup_source` is one of `popup`, `newsletter`, `chapter_gate`, `booklet_reader`, `ads_page`.
Meta Pixel gets the matching `Lead` event. Code: `frontend/lib/analytics.ts`.

## One-time setup in GA4

1. **Custom dimensions** (Admin → Data display → Custom definitions → Create custom
   dimension), scope **Event**:
   - `Signup source` ← parameter `signup_source`
   - `Booklet slug` ← parameter `booklet_slug`

   They only collect from the day they are created.
2. **Key event**: Admin → Data display → Events → `sign_up` → **Mark as key event**.
3. **Google Ads** (only if running ads): Goals → Conversions → New conversion action →
   Import → Google Analytics 4 properties → `sign_up`.
4. **Search Console**: copy the verification token and set it in Vercel as
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, then verify the property.

## Check after a deploy

- **Page views**: Reports → Realtime. Click Home → Movements → About → a booklet in another
  tab; each page title should appear. One page only means the new build is not live.
- **Sign-up**: Admin → DebugView (use the "Google Analytics Debugger" Chrome extension), submit
  an email, and look for `sign_up` with `signup_source`.
- **Business metric**: Explore → table with `Signup source` and `Booklet slug` as rows and
  key events as the value.

## Do not

- Turn on "Page changes based on browser history events" (Admin → Data streams → stream →
  Enhanced measurement). `GaPageView` already sends these, so it would double every view.
- Test against the live property from a local dev server: the tag fires real hits. Filter
  `localhost` in reports, or run with `NEXT_PUBLIC_SANDBOX=1`.
