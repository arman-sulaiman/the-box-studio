# AI integration — step-by-step for 10.1.0

The built-in AI feature removes backgrounds from person photographs and returns a transparent PNG. It is not an image generator or chatbot. Pick **one** provider below; both are optional. The manual cutout editor works without an AI provider.

## A. Local AI — no per-image API fee

1. Install Node.js 24 and Python 3.11 or 3.12 on the machine running The BOX Studio. This needs a Node-capable machine/VPS, not static-only hosting. Allow enough CPU/RAM for image processing; two jobs can run concurrently.
2. Open a terminal in the extracted project folder containing `package.json`. Finish the normal application setup from SETUP.md first.
3. Check Python. Windows: `python --version`. Linux/macOS: `python3 --version`. If missing, install Python and reopen the terminal. On Windows, enable “Add Python to PATH”.
4. Run `npm run ai:setup`. Allow the virtual environment, pinned Python packages and U2NetP model to finish downloading. An error means setup is incomplete; do not continue as though AI is ready.
5. Run `npm run ai:check`. It checks the executable, Python package availability and model cache without running inference or sending an image. If your environment lives elsewhere, set `AI_PYTHON` in your server `.env` to its absolute Python executable path. On Windows `.env` paths can use forward slashes. For a persistent model directory set `U2NET_HOME` to that directory and rerun setup from the same environment.
6. Restart the app with `npm start`. If running as a service, restart that service and ensure it uses the same environment, project working directory and model cache. Setup performed as a different OS user may leave the model under a different home directory.
7. Sign in to the studio. Open Images, upload a Content image (free templates) or Person cutout (premium templates), and click Remove background / edit cutout. Choose Local AI → Remove with AI.
8. Check the result on the checkerboard. Use Erase/Restore for hair and edge cleanup. Click Apply transparent PNG, then export.
9. Optional actual inference check using one of your own photos: `npm run ai:check -- --provider=local --image="C:/Photos/person.jpg"` (replace with your real path). This processes that image on the server and reports PNG dimensions/alpha; it does not save a result. Use the UI to judge image quality.

The model and Python environment are not shipped in the ZIP. Initial downloads require internet; subsequent local processing uses the server. Hosting/CPU costs still apply. U2NetP is a compact foreground model; complex hair or busy backgrounds may need manual refinement.

## B. Gemini — server API integration

1. Open https://aistudio.google.com/ and create a key in your own project. Rotate the key previously posted in chat. Check your project's current model access, quota and billing before use; free or unlimited access is not guaranteed.
2. Stop the application. Edit the `.env` beside package.json (copy `.env.example` only if you do not already have `.env`). Add:

```dotenv
GEMINI_API_KEY=replace_with_your_new_private_key
GEMINI_MODEL=gemini-2.5-flash
```

3. Do not put the key in React files, public assets, screenshots, project JSON or the browser. Do not add a VITE_ prefix. On hosting, use the provider's private server environment settings instead of a public frontend variable.
4. Run `npm run ai:check`. “Configured” means the key exists, not that permissions/quota have been verified. The checker does not print the key.
5. Run `npm start` or restart your Node service. Sign in. Upload your photo, open the cutout editor, choose Gemini and click Remove with AI. This explicitly sends that image to Google.
6. Inspect the returned cutout, refine if needed and click Apply transparent PNG. The backend validates a PNG probability mask and applies it to the original image pixels.
7. Optional explicit provider check: `npm run ai:check -- --provider=gemini --image="C:/Photos/person.jpg"`. This sends the specified image to Google and may consume quota. It reports success/failure without printing the image or key.

The configurable default model uses the documented segmentation-mask format. Do not substitute a text-only model or assume every latest-model alias returns masks. If the model is unavailable in your project, check Google's segmentation documentation for a compatible model before changing GEMINI_MODEL. A basic curl request asking for text only does not test background removal.

## Troubleshooting

| Message / symptom | What to do |
| --- | --- |
| Sign in required | Log into the studio before invoking AI. |
| Setup needed | Install local AI or configure a server Gemini key, then restart. |
| Python packages/model missing | Run ai:setup under the same service account and environment; check U2NET_HOME. |
| Local AI timed out | Use a smaller photo, check model cache, available RAM and service logs. |
| Gemini request failed | Verify private key, enabled API/project access, supported model and outbound HTTPS. |
| Quota reached | Wait for quota recovery or use local AI. Check provider billing; the app does not enable paid billing for you. |
| No usable mask / invalid mask | Try a clear single-person photograph or use local/manual editing. Unsupported provider output is rejected. |
| Image too large | Resize the original before upload; uploads have an 8 MB limit and AI decoding a 12 megapixel limit. |
| Works in terminal, fails as service | Check service working directory, AI_PYTHON, U2NET_HOME, ownership and private environment variables. |

## Validation and privacy

This release tests mask parsing, transparency, original pixel preservation and provider error handling with controlled mock responses. Live Gemini has not been tested with your account. During earlier local inference testing, automatic approval review rejected a Microsoft telemetry connection from the Python runtime even with telemetry disabled. That live test was not completed or retried here. Complete step A7 or B5 on your own server before advertising AI as available.

No provider fallback silently sends a local photo to Google. Local processing runs in a subprocess with a timeout; Gemini is server-side with a timeout. Requests require sign-in and are rate limited. Output can still need manual cleanup.

Official references: https://github.com/danielgatis/rembg and https://ai.google.dev/gemini-api/docs/image-understanding . Review model/license terms and current provider terms before operating commercially.
