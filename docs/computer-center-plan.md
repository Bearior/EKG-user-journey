# EMS Center redesign plan

The user supersedes the old multi-role prototype: only center staff use the app, uploading PNG/JPEG or a WFDB .hea/.dat pair. AI remains a demo. Reports are saved automatically and have a read-only URL for manual sharing through LINE.

1. Add validated local report storage and report/history HTTP endpoints with Node standard library; test malformed files, mismatched WFDB pairs, persistence and read-only report retrieval.
2. Replace the old app shell with upload/history/report screens. Keep one primary submit action, preserve selected files on errors, open the saved report on success. Show model outputs as a list so another AI output does not require redesigning the report.
3. Supply a synthetic WFDB pair, source preview, Copy Link with fallback, and browser print layout.
4. Update current flowchart and README. Test server lifecycle plus desktop/mobile upload, history after refresh, report link and validation errors in a real browser when available.
5. Review, commit and push as previously requested.

No external hosting, actual model, Tempus API, LINE API, authentication rollout or additional packages are included. The local-only share limitation must be visible at copy time and documented.
