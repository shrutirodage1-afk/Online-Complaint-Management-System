# OCMC Frontend

Static HTML/CSS/JS frontend for the Online Complaint Management System, now wired
to the Node/Express + MongoDB backend (see the `backend` package) instead of
`localStorage`.

## How it connects to the backend

All pages load `js/api.js`. Deployed pages use the production API at:

```js
https://online-complaint-management-system-5527.onrender.com/api
```

When previewed on `localhost` or `127.0.0.1`, the helper automatically uses
`http://localhost:5000/api`. Uploaded images use the matching backend host.
For another production backend, update `API_ORIGIN` in `js/api.js`.

- Login/Register pages call `/api/auth/...` and store the returned JWT in
  `localStorage` under `ocms_token` (only the token + basic profile is cached
  client-side; all real data lives in MongoDB).
- Authenticated pages (`dashboard.html`, `submitcomplaint.html`, `my-complaint.html`,
  `profile.html`, `notification.html`) call `OCMC.requireAuth()` on load and
  redirect to `login.html` if there's no valid session.
- Admin pages (`admin-dash.html`, `admin-complaint.html`, `admin-user.html`,
  `admin-notification.html`) call `OCMC.requireAdmin()` and redirect to
  `admin-login.html` if not an authenticated admin.
- Complaint photos and profile avatars are uploaded as real files (`multipart/form-data`)
  to the backend, stored on disk, and served from `/uploads/<file>`.

## Running locally

1. Start the backend first (`cd backend && npm install && npm run dev`).
2. Serve this folder with any static server, e.g.:
   ```bash
   npx serve .
   # or
   python3 -m http.server 5500
   ```
3. Open `welcome.html` (or `login.html`) in the browser.

Make sure the backend's `CLIENT_ORIGIN` in `.env` matches the deployed frontend
origin, so CORS allows the requests. The Render URL above is the backend API;
deploy this `frontend` folder separately as a static site and use its public URL
to open the website.
