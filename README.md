# OBX Paving Co. — Website

Premium marketing website for an asphalt paving and sealcoating contractor serving the Outer Banks of North Carolina (Dare County, Currituck County, and surrounding areas).

## Stack

| Layer | Tool |
|-------|------|
| UI | React 18 + Vite 6 |
| Routing | React Router v6 |
| Styles | Tailwind CSS 3 |
| Animations | Framer Motion |
| Forms | React Hook Form |
| Deploy | Netlify |

## Pages

| URL | Page |
|-----|------|
| `/` | Home — hero, services overview, why us, process, areas, testimonials |
| `/services` | All services overview |
| `/services/sealcoating` | Sealcoating detail page |
| `/services/crack-filling` | Crack filling & sealing detail |
| `/services/asphalt-repairs` | Asphalt repair & patching detail |
| `/services/line-striping` | Line striping & marking detail |
| `/service-areas` | Full service area coverage map |
| `/about` | Company story, values, credentials |
| `/contact` | Quote request form + FAQ |

## SEO Architecture

- **Schema.org JSON-LD** on every page: `LocalBusiness`, `Organization`, `WebSite`, `WebPage`, `BreadcrumbList`, `Service`, `FAQPage`, `AggregateRating`, individual `Review` objects
- **Canonical URLs**, hreflang (`en-US`, `x-default`), Open Graph, Twitter Card, geo meta
- **XML sitemap** at `/sitemap.xml`
- **robots.txt** pointing to sitemap
- **FAQPage schema** on Home, Services, each service detail page, and Contact

## Development

```bash
npm install
cp .env.example .env.local   # configure VITE_API_BASE_URL
npm run dev                  # http://localhost:5173
```

## Build & Deploy

```bash
npm run build    # outputs to dist/
```

Connect to Netlify:
1. Push this repo to GitHub (see below)
2. New Site → Import from Git → select this repo
3. Build: `npm run build` | Publish: `dist`
4. Set env vars from `.env.example`

## Push to Your Own GitHub Repo

After this repo is created at github.com, run:

```bash
git init
git add -A
git commit -m "feat: initial OBX Paving Co. website"
git remote add origin https://github.com/jwordenaii/base44claude.git
git push -u origin main
```

## Customization

All business copy, phone numbers, colors, service descriptions, and service area data live in:

```
src/config/site.js    — business info, services, areas, testimonials
src/config/schema.js  — JSON-LD generators (update if you rename services)
index.html            — base SEO meta (also update canonical URL + phone)
public/sitemap.xml    — update lastmod dates and add/remove URLs as needed
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend API for quote form submissions |
| `VITE_GA_ID` | Google Analytics 4 measurement ID |
| `VITE_GADS_ID` | Google Ads conversion ID |
| `VITE_GADS_LABEL_QUOTE` | Google Ads — quote form conversion label |
| `VITE_GADS_LABEL_PHONE` | Google Ads — phone click conversion label |
