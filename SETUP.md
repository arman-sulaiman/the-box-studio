# The BOX Studio 10.0.0 — setup and upgrade

## 1. Requirements

- Node.js 24.x (SQLite is included; no separate database server).
- Windows, macOS or Linux, a persistent disk, and enough memory for Chromium image exports.
- Internet for initial npm/browser installation. Bundled fonts work without external font services.
- Optional local AI: Python 3.11 or 3.12, additional disk space and CPU/RAM. See AI-SETUP.md.

## 2. New installation

On Windows, extract the ZIP, run SETUP-WINDOWS.bat and then START-WINDOWS.bat. Setup prints a unique temporary admin password once. Save it securely and change it on first login.

Manual setup from the project folder:

```sh
npm ci
npm run browser:install
```

Copy `.env.example` to `.env`: Windows Command Prompt `copy .env.example .env`, or macOS/Linux `cp .env.example .env`.

```sh
npm run setup
npm start
```

Open **http://localhost:4173**, exactly matching APP_ORIGIN. Keep the server terminal running. There is no shared default password. Linux may need Chromium dependencies: `npx playwright install --with-deps chromium`.

The compiled `dist` and private render bundles are included. Rebuild only after changing source or installing custom fonts.

### Browser installation fallback

If the Chromium download fails, install Chrome/Edge normally and set CHROMIUM_PATH to its executable in `.env`. Common Chrome/Edge paths are also detected when the Playwright browser is missing. For example:

```dotenv
CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
```

On macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. On Linux, `/usr/bin/chromium` or `/usr/bin/google-chrome`. Keep the Chromium sandbox enabled. CHROMIUM_NO_SANDBOX is only an explicit option for constrained, isolated environments.

## 3. Upgrade an existing v9 installation

1. In v9, run `npm run backup`. Keep the resulting backup outside the application folder.
2. Stop the v9 server. Extract v10 into a separate folder.
3. Copy your existing `.env` and the entire `data` folder into v10. If DATA_DIR is an absolute path, keep that path and do not copy over its live data.
4. Run `npm ci` and `npm run browser:install` in v10. Do not run initial admin setup again.
5. Start v10 with `npm start`. Its additive SQLite migration preserves users, password hashes, credit balances, subscriptions, projects and history.
6. Sign in with your existing credentials. Verify balances and test a small export before replacing your public deployment.

V9 projects previously charged for design retain their included first download if unused. New v10 projects are free to create; their first download costs 20 credits. Later exports cost 4 credits. V9 historical entries are not rewritten or retroactively refunded. Pending v9 export reservations are refunded during startup recovery, as in v9.

For rollback, stop v10 and restore the saved v9 database with the v9 application. Do not run both versions against the same database.

## 4. Admin workflow

Members can register or an admin can create them. Admin-created/reset passwords require a change after login.

- Open Admin, search/filter a member and choose Manage.
- Manage subscription: enter plan label, access-through date and a reason.
- Recharge / adjust credits: positive adds, negative deducts; provide a payment reference/reason. Credits reserved by unfinished exports cannot be removed.
- Suspend / reactivate invalidates current sessions. Admin accounts cannot be suspended from this panel.
- Reset password generates a user-chosen temporary credential; communicate it privately.
- Refresh dashboard, inspect export history/AI configuration, and export the current member page as CSV (50 records per page).

Cash payments are verified externally. This release has no payment gateway, automatic invoices, email reset or recurring payment collection. Subscription dates use the administrator browser's local timezone. The activity chart uses UTC and says so.

## 5. Downloads and credit reservations

New premium projects cost zero to create/edit. Before a new export, the application shows 20 credits for its first download or 4 for later exports. The server reserves the amount without deducting the wallet while rendering. A successful ready-file download request atomically commits the charge. First-download status changes only then. Failed rendering costs nothing.

The browser cannot prove completion of saving to disk. A transfer failure therefore does not automatically refund a committed download, but the exact file can be recovered free for 48 hours in My account. Repeating a download request cannot double-charge. Re-rendering an edited project is a new export and costs 4 credits after the first download.

A pending/ready undownloaded export can be cancelled in My account. Its reservation is released without charging. Download/cancel the previous job before starting another from that project. Reservations expire after 48 hours. Administrator exports cost zero.

## 6. Production hosting

Use a Node-capable VPS/server with persistent storage; uploading only dist to a static host cannot run authentication or billing. Run ONE Node process/instance for this SQLite deployment. Keep the data directory outside the public web root, on a local persistent disk, and back it up regularly.

Use HTTPS through a reverse proxy. Example production settings:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4173
APP_ORIGIN=https://studio.your-domain.example
DATA_DIR=/srv/the-box-studio/data
TRUST_PROXY=false
```

Forward requests to the Node server. Allow request bodies of at least 30 MB and export/AI requests of up to 150 seconds. Set TRUST_PROXY=true only when your own trusted proxy replaces X-Forwarded-For and clients cannot reach Node directly. Hostname, protocol and port must exactly match APP_ORIGIN for CSRF checks. Use a process manager and filesystem permissions restricted to the server account. No public deployment is performed by this ZIP.

## 7. Backup and recovery

`npm run backup` creates a consistent database snapshot in backups. It includes users, balances, history and stored project images. Temporary export files and AI model caches are not in that snapshot. Keep `.env` securely and never publish it. To restore: stop the server, replace data/box-studio.sqlite with the backup, remove stale SQLite -wal/-shm files only while stopped, then restart.

`npm run admin:reset` resets the administrator locally and invalidates existing sessions. Use only with trusted server access.

## 8. Fonts, AI and editor notes

See FONTS.md and AI-SETUP.md. AI is optional; the studio and manual cutout tools work without it. No API key is embedded. Rotate the key previously shared in chat before configuring Gemini.

The editor supports 30 extra layers, with drag positioning and arrow-key nudging. Layers are included in project files and all exports. Lock prevents dragging; Hide excludes a layer from exports. Typography can be selected per section and per extra-text layer. All project imports sanitize layer styles and text.

Advertisement size suggestions match the actual full-width, 9%-height premium ad slot and account for the side strip. Portrait at 1× without a side strip: about 1080×122 px; 2×: 2160×243 px. Square: about 1080×97 px; Story: about 1080×173 px. Keep key content within a 5% safe margin; use Fit whole banner to avoid cropping.

Copy/cut/context-menu/print blocking, optional blur are deterrents. Paste is supported. A website cannot reliably disable operating-system screenshots, cameras, developer tools or extraction of browser-visible assets. Server checks protect official premium download delivery; this is not absolute DRM.

## 9. Limits and troubleshooting

- Images: PNG/JPG/WebP/GIF up to 8 MB per upload; complete premium project up to 28 MB.
- Per user: 100 projects / approximately 150 MB of stored project content; 1 pending export at a time; 8 pending exports globally.
- AI: signed-in accounts, 12 requests/hour each, 2 simultaneous server requests, 12 megapixel input cap and a 2400 px working edge. PNG/JPG/WebP only. Quality varies; refine hair/edges with brushes.
- Free exports use the local browser; 4× images can exceed mobile memory. Use 1× or 2× if needed. Server exports also require adequate RAM.
- Low-resolution source photos cannot become detailed simply by exporting larger.
- Session expired / origin error: reopen the exact APP_ORIGIN address, refresh and sign in.
- Export failure: verify Chromium installation, server permissions and RAM. Rendering failures do not debit new v10 downloads.
- A custom font missing: rebuild and restart after installation, and confirm web-font permission and Unicode Bengali support (ANSI fonts do not accept Unicode text correctly).

Technical references: https://nodejs.org/docs/latest-v24.x/api/sqlite.html and https://playwright.dev/docs/browsers
