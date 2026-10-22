# Luxe Nails — Nail & Spa Website (MERN)

A complete website for a nail and spa salon: customer pages, online booking with email verification, and a role-based admin dashboard.

- **Frontend:** React (Vite), Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Customer pages:** Home, Services (nail + spa categories), Gallery, Booking, About Us, Contact (with FAQ)
- **Admin area** (direct URL only, not linked from the site): `/admin/login`

> **All business details, prices, team names, testimonials and images are sample content.** The service and
> gallery pictures in `client/public/images` are generated illustrations, not photos. Replace them with real ones.

## Requirements
- Node.js 18 or newer
- MongoDB (local, or a MongoDB Atlas connection string)
- An SMTP account for sending email (customers must verify their email to book; see below)

## Quick start

```bash
# 1. Backend
cd server
cp .env.example .env        # edit it: MONGODB_URI, JWT_SECRET (32+ random chars), ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_*
npm install
npm run seed                # sample services (38) and the business owner's admin account
npm run create-developer    # your developer account (prompts for email + hidden password)
npm run dev                 # http://localhost:5000

# 2. Frontend (second terminal)
cd client
cp .env.example .env        # optional in development
npm install
npm run dev                 # http://localhost:5173  (proxies /api and /uploads to the backend)
```

Admin login: <http://localhost:5173/admin/login>.

**Email is required for booking.** Customers prove they own their email address with a one-time code before a booking can be saved. Until `SMTP_HOST` and `MAIL_FROM` are set, the booking page reports that verification is unavailable. For local testing use [Mailpit](https://github.com/axllent/mailpit) (`SMTP_HOST=localhost`, `SMTP_PORT=1025`) or an Ethereal account.

## Accounts and roles

Two kinds of dashboard accounts exist. The role is stored in the database and re-read on **every** request; nothing the browser sends (request body, headers, token contents, browser storage) can change it.

| | Business admin (`admin`) | Developer (`developer`) |
|---|---|---|
| View services (details and images) | yes | yes |
| Add / edit / delete services, prices, descriptions, images | **no** (403) | yes |
| Appointments (view, confirm, cancel, resend email) | yes | no (403) |
| Messages (view, mark read) | yes | no (403) |

- The permission table is one file: `server/src/config/permissions.js`. The developer deliberately has no access to customer data; add permissions there if you want that.
- Every `/api/admin/*` route declares a permission. A test fails if a route is added without one.
- **Business owner:** created by `npm run seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Accounts created before roles existed have no role field and behave as business admins.
- **Developer:** can only be created from the command line with `npm run create-developer` (hidden password prompt, 12+ characters). Run it again to reset the password (this also signs out existing developer sessions). It refuses the owner's email. There is no registration page and no API that creates or changes roles. Never put developer credentials in `.env` or frontend files.
- **Sign out** revokes the token on the server, so a copied token stops working immediately.

## Features

### Booking with email verification
1. The customer picks a category and service, a date and an available time, and enters their details. No account is needed.
2. **Verify Email** sends a 6-digit code (valid 10 minutes, usable once, stored only as a hash, never returned by the API or logged).
3. Limits per email address: 60-second resend cooldown, 5 codes per hour, 5 wrong guesses per code. There are also per-IP rate limits.
4. A correct code returns a one-time authorization token (valid 30 minutes). The booking API requires it, checks it belongs to the exact email, and lets it back only one booking (unique database index). The browser's own "verified" state is never trusted.
5. Bookings are saved as `pending`. The customer gets a "request received" email; when an admin confirms, a "confirmed" email follows. An admin cannot confirm a booking whose email was never verified (bookings made before this feature existed can only be cancelled).
6. Slots are 30 minutes; a unique index per technician and slot prevents double booking, even for simultaneous requests. Repeating the same request (double click, network retry) returns the same booking. Settings: `server/src/config/verification.js`, `server/src/config/business.js`.
7. If an email cannot be sent the booking is still kept; the dashboard shows **Email failed** with a **Resend** button.

### Services
Six categories: Nail Services, Massage Therapy, Facial Treatments, Body Treatments, Waxing, Hand and Foot Spa. The demo catalogue is in `server/src/utils/serviceCatalog.js`. `npm run seed` is safe to run again: it adds only what is missing and never overwrites prices or text you edited. Prices and durations always come from the server when booking.

### Service images
The developer account can upload a JPG, PNG or WebP (max 5 MB) from a computer or phone when adding or editing a service, or still type an image path. Files are checked by their real content, stored under random names in `server/uploads/services/`, and served from `/uploads/services/`. A replaced image is deleted only after the database update succeeds and only if no other service uses it. See the deployment notes below: **uploads must live on a persistent disk.**

## Configuration

### Server (`server/.env`)
| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Server port and mode |
| `CLIENT_ORIGIN` | Allowed frontend address(es), comma separated (CORS) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs admin sessions; 32+ random characters (required) |
| `JWT_EXPIRES_IN` | Admin session length (default `8h`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Business owner account, used only by `npm run seed` (password 10+ chars) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email sending (required for booking) |
| `OTP_SECRET` | Optional separate key (32+ chars) for hashing codes; defaults to `JWT_SECRET` |
| `OWNER_EMAIL` | Where contact-form messages are emailed (optional; they are always saved) |
| `UPLOAD_DIR` | Where uploaded images are stored (default `server/uploads`) |

### Client (`client/.env`)
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API address in production, e.g. `https://api.example.com/api` (leave empty in development) |
| `VITE_UPLOADS_URL` | Only if uploaded images are served from somewhere other than the API's address |
| `VITE_WHATSAPP_NUMBER`, `VITE_MAPS_URL`, `VITE_FACEBOOK_URL`, `VITE_INSTAGRAM_URL`, `VITE_TWITTER_URL` | Contact links |

Business details shown on the site live in `client/src/config/site.js` (address, phone, hours, FAQ) and `server/src/config/business.js` (opening hours, technicians, timezone, contact details used in emails).

## API summary
Responses look like `{ success, data?, message?, code?, errors? }`.

**Public**
- `GET /api/health`, `GET /api/business`
- `GET /api/services[?category=]`, `GET /api/services/:id`
- `GET /api/appointments/availability?serviceId=&date=YYYY-MM-DD&technicianId=`
- `POST /api/verification/email/request` `{email}` and `POST /api/verification/email/verify` `{email, code}`
- `POST /api/appointments` (needs `verificationToken`), `POST /api/contact`

**Admin** (Bearer token; the permission needed is in brackets)
- `POST /api/admin/login`, `GET /api/admin/me`, `POST /api/admin/logout`
- `GET /api/admin/appointments?date=&status=&category=` [appointments:read]
- `PATCH /api/admin/appointments/:id/status`, `POST /api/admin/appointments/:id/resend-email` [appointments:manage]
- `GET /api/admin/messages` [messages:read], `PATCH /api/admin/messages/:id/read` [messages:manage]
- `GET /api/admin/services` [services:read]
- `POST /api/admin/services`, `PUT /api/admin/services/:id`, `DELETE /api/admin/services/:id` [services:write] (create/edit accept `multipart/form-data` with an `imageFile`)

## Tests
```bash
cd server && npm test        # unit and API tests
cd client && npm test        # frontend tests (Vitest + jsdom)
cd client && npm run build   # production build
```
The server's database-backed tests (booking, verification, roles, uploads, admin login, concurrency) run only when `MONGODB_TEST_URI` points to a **throw-away** MongoDB database; otherwise they are skipped:
```bash
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/luxe-nails-test npm test
```
(On Windows PowerShell: `$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/luxe-nails-test"; npm test`.)

## Deployment
- **Database:** MongoDB Atlas. Create a user, allow your server's IP, put the connection string in `MONGODB_URI`. The server creates its unique indexes at startup, so the database user needs permission to create indexes.
- **Backend:** run `npm start` with `NODE_ENV=production` and all variables above. Run `npm run seed` and `npm run create-developer` once from the server's shell.
- **Frontend:** `npm run build`, publish `client/dist`, set `VITE_API_URL`. The host must serve `index.html` for every path (single-page app), including `/admin` and `/admin/login`. A Netlify-style `client/public/_redirects` file is included.
- **Uploaded images need a persistent disk.** Hosts with ephemeral filesystems (e.g. Render/Railway/Heroku without a volume, serverless platforms) erase `server/uploads` on every redeploy or restart, leaving broken images. Use a VPS or a host with a persistent volume, set `UPLOAD_DIR` to that volume, run a single server instance (or a shared disk), and back it up.
- **Reverse proxy:** allow request bodies of at least 6 MB (nginx: `client_max_body_size 6m;`), or uploads fail with 413.
- **Email:** use a real SMTP provider and set up SPF/DKIM for your sending domain so verification codes are not marked as spam.
- Serve everything over HTTPS, keep `JWT_SECRET` and SMTP credentials private, and set `CLIENT_ORIGIN` to your real site address.
