# The BOX Studio 10.1.0

## Upgrade an existing v10 installation

1. Stop the running Node server (Ctrl+C in its terminal).
2. Back up the old installation, especially `.env` and the complete `data` folder. If you changed DATA_DIR, back up that location instead. Keep your existing fonts and their licenses if you installed custom fonts.
3. Extract this release into a new folder. Copy your existing `.env` and `data` into it. Do not overwrite the database with an empty one. No database reset or new administrator setup is needed.
4. Open a terminal in the folder containing package.json. Use Node.js 24. Run `npm ci`, then `npm run browser:install`, then `npm run build`.
5. If using local AI, run `npm run ai:setup` in the new folder, or set AI_PYTHON to your existing virtual environment's absolute Python path. Keep the model cache accessible to the service account. Read AI-SETUP.md.
6. Run `npm start`. Sign in using your existing administrator account. Confirm the user list and credit balances.
7. Hard-refresh the browser (Ctrl+Shift+R). Test a free PNG download before putting the new version behind your existing HTTPS domain.

For a fresh installation, follow SETUP.md instead. Keep one server process using the SQLite database. Credits and subscription behavior are unchanged: 20 credits for a new premium project's first download, 4 for subsequent new exports; recovery of the same paid export within 48 hours has no extra charge.

## What changed

- One website logo and one integrated sidebar containing navigation and templates. Minimize/expand persists in the browser; on phones it becomes a top bar with a template drawer, closed by default. Select a template to close the phone drawer.
- Light/dark mode stays available in both sidebar sizes and on phones.
- Signature side design is disabled in preview and exports, including old projects. Its old values are retained in project files for compatibility but no longer affect the artwork.
- Lipighor promotional option removed. The existing open-license Bangla and English fonts remain available.
- Preview watermark removed. The separate optional artwork watermark remains off by default and can be toggled in Design.
- Images → Background studio supports all templates: canvas background plus one custom background region. Use Header, Footer, Left, Right or Whole design as starting areas, then adjust position, dimensions, crop, opacity and corner radius. Foreground content/photo areas can cover a background, as expected for layers; change the content image separately.
- Both images remain in project JSON and premium saves and render in PNG/JPEG exports. Browser draft storage still omits uploaded image data; use Save project before leaving.
- AI removal includes provider explanation, setup help and a safe configuration checker. Credentials are server-only. No new live API credential is included.

No live website deployment is included in the downloadable release.
