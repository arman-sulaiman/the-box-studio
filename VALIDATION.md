# 10.1.0 validation

- Production build passed.
- Authentication, CSRF, subscription/ownership enforcement, credit reservation, first download 20 credits, later export 4 credits, recovery idempotency, v9 compatibility and PNG/JPEG server export tests passed.
- AI mask composition/error handling tests passed with mocks; no live provider inference tested. See AI-SETUP.md.
- Browser checks passed: expanded/minimized sidebar and persistence, mobile template drawer, theme toggle, removed Signature/Lipighor controls, background uploads and presets across all four free templates, 1080 × 1350 free export, background pixel verification in a premium server export, 20-credit first download, no preview watermark, mobile width, no JavaScript errors.
- Desktop/mobile screenshots and downloaded background artwork inspected.
- AI package/model setup remains required on the deployment machine. The configuration checker does not certify live provider quality.
