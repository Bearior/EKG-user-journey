# Computer Center workspace

Direction: clean operating workspace, with a separate readable examination report. Based on the user's explicit request to simplify the earlier multi-role prototype.

- White surface #FFFFFF, page #F4F7F9, ink #18334B, secondary #526779, teal action #087E83, line #DCE5EC; warm status colors reserved for failure/pending, not decoration.
- Local Thai text fonts Leelawadee UI / Tahoma; system sans fallback. Body 14–16px, readable field labels, strong report title; left aligned.
- Slim horizontal app header. Two destinations: upload and history. No numbered role journey, sidebar, physician form, network toggle or scenario picker in the main flow.
- Upload is the primary action; image and WFDB are two clearly labelled input options. Show selected source before submission. Patient/job code and notes are optional.
- Desktop: upload form with quiet recent-history rail. Mobile: one column, no page overflow.
- Report: clear mock label, source/reference/time, structured AI model results, source preview, and Copy Link/Print actions. Avoid uncalibrated percentages.
- History is a compact searchable list of saved reports, not a wall of status cards. Empty, loading, failure and retry states must work.
- Shared route hides upload/navigation/history controls. No edit or doctor-reply controls on a report link.
- Preserve native keyboard and file-input behavior; visible focus; report printable without app chrome.
