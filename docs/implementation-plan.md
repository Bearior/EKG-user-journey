# ECG journey prototype implementation plan

**Goal:** Build the approved four-screen Thai prototype in Application, with synthetic ECGs, mock AI, and mock physician consultation. Prepare a local Git repository; the user owns remote creation and push.

**Architecture:** Dependency-free browser ES modules. A pure state model owns per-ECG analysis, consultation, confirmation and physician review. The browser renders that state; a loopback-only Node static server serves the prototype. No patient data, inference API, authentication, external services, persistent browser storage or real notifications.

**Design:** ECG waveform is the central visual. White workspace, navy #18334B navigation, teal #087E83 actions, slate #526779 secondary text, pale blue #EEF4F8 background, amber #9B5B0A pending states. Thai uses local Leelawadee UI/Tahoma, with system sans-serif fallback. Left-aligned content, separate AI and physician panels, mobile navigation, visible focus. Color never conveys a diagnosis alone. Synthetic traces are illustrative, not diagnostic examples.

## Tasks
- [x] Write and run failing model tests: analysis does not block consultation; offline send queues; confirmation required; new ECG does not inherit results; late results stay bound to the source ECG; research mode hides AI until independent review; physician review requires delivered consultation; malformed fixtures rejected.
- [x] Implement src/model.js and rerun tests (15 model/API tests passing).
- [x] Implement index.html, src/app.js, src/ecg.js and styles.css: intake, ECG verification, AI result, doctor review; scenario controls, record history, failure handling and responsive UI.
- [x] Add synthetic JSON example, loopback static server, README and separate flowchart/review documents.
- [x] Verify syntax/model/API tests and seven HTTP assets; independent code review findings corrected. Browser walkthrough attempted but denied by browser policy; desktop/mobile appearance remains unverified.
- [x] Initialize main Git branch, review staged files and prepare verified prototype commit with local run instructions.

## Review focus
- Case or ECG mismatch: confirmation must be renewed for each ECG.
- Offline simulation: queued is never labelled sent or received.
- Stale asynchronous AI: result belongs only to its originating record.
- Research mode: AI class and result are hidden in the physician screen until review is submitted.
- Imported fixture: strictly synthetic JSON only, bounded fields, safe text rendering; no false claim of XML/photo support.

## Execution ledger
Ruling: Implement directly in this folder as explicitly requested; there is no existing repository to isolate with a worktree.
Ruling: Markdown documents with Mermaid satisfy the requested separate documentation and render in GitHub. No Word-format request was made.
Ruling: No dependencies added; modern browser and Node 24+ are the tested target. Testing targets workflow boundaries, not diagnostic performance.
Ruling: User added an inference API JSON contract. src/api.js creates versioned synthetic request/accepted/terminal response locally; no trained model or inference endpoint is implemented.
Review fixes: research mode locked after intake, AI hidden across all screens until review, no AI-comparison opinion during independent reading, and queued records labelled as failed sends in history.
Validation gap: Chrome localhost access was denied by browser policy; no visual/browser walkthrough is claimed. Model/contract tests, syntax checks and HTTP asset smoke checks are used instead.
Final evidence: 15/15 tests passing; npm run check passing; seven HTTP assets return 200; independent reviewer approves mock prototype. Future opaque backend analysis ID handling is documented in the API integration section and remains work for real transport.
