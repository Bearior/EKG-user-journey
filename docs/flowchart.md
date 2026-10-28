# User journey — Computer Center

Current design from the user's 28 October 2026 update. Only Computer Center staff operate the app; doctors receive a read-only report link manually through LINE.

```mermaid
flowchart TD
    A[Computer Center receives ECG through PEMPUS] --> B[Upload PNG/JPEG image or WFDB .hea + .dat]
    B --> C{Files accepted?}
    C -->|No| D[Show error and retain selected files for retry]
    D --> B
    C -->|Yes| E[Call AI - currently a mock]
    E --> F[Collect separate result for each AI model]
    F --> G{Save report and original sources}
    G -->|Storage failure| D
    G -->|Saved| H[Open structured report and add to history automatically]
    H --> I[Copy report link]
    I --> J[Operator pastes link into LINE]
    J --> K[Doctor opens read-only report]
    H --> L[Open report later from searchable history]
    E -. AI error .-> M[Record failed AI result - never Normal]
    M --> G
```

The currently running local demo supports opening report links on the same machine only. Opening from a doctor's remote device requires deployment and access control. There is no automatic PEMPUS ingestion, LINE sending, doctor reply form or trained AI model.

Original EMS/center/doctor context is retained in [user-journey.md](user-journey.md). The former multi-role app and its flow are superseded.
