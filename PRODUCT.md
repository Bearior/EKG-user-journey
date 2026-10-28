# ECG Bridge

ECG upload and AI report workspace for Computer Center staff. Updated from the user's doctor-informed workflow on 28 October 2026.

## Users and job

Only Computer Center staff operate the app. They receive ECG through PEMPUS, upload an ECG image (PNG/JPEG) or WFDB pair (.hea + .dat), receive a structured report saved to history, and copy a read-only report link to send manually through LINE. No ambulance-side forms or doctor role switching.

## Scope and truth

- AI is a mock until the team's model is deployed. Image and WFDB upload acceptance does not imply trained model support or clinical validation.
- One report can contain results from multiple AI models; start with one clearly labelled demo model.
- Save reports and original uploads locally on the Node server, not only in browser memory.
- Links open reports in another tab/browser on the same server. Localhost cannot be opened on a doctor's remote device. External clinical sharing requires deployment, access control and an approved data-handling policy.
- No PEMPUS or LINE automation, real model, or actual diagnosis is claimed.

## Success criteria

Upload → visible processing → report opens automatically and is already saved → Copy Link. History survives refresh and server restart. Shared report view is read-only. Invalid files and processing/storage errors leave an actionable error rather than a fabricated success.
