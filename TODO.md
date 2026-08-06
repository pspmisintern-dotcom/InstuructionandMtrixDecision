# Task Steps

## 1. Backend: Serve actual DOCX file from data folder
- [x] Add `GET /workinstructions/{id}/file` endpoint in `backend/routes/workinstruction_routes.py` that serves the original `.docx` via `FileResponse` (resolving stored `file_path`, fallback to project `data/` folder).
- [x] Add `file_path` to the WI API response dict (`wi_to_dict`).

## 2. Frontend: Remove Checklist step from detail workflow
- [x] In `frontend/app/workinstructions/[id]/page.js`: remove Step 0 "Checklist" review, its state (`checklistItems`, `defaultPhaseChecklist`), and `handleCompleteChecklist` handler.
- [x] Make the flow start at "Pre-start Inspection" (set PPE/pre-start flags so decision matrix still works).

## 3. Frontend: Open real DOCX from data folder
- [x] Update `openDocument()` in detail page to open the new backend file endpoint in a new tab.

## 4. Frontend: Make UI more attractive & professional
- [x] Polish `frontend/app/workinstructions/page.js` (cards, gradients, spacing, hover).
- [x] Polish `frontend/app/checklists/page.js` (cards, gradients, spacing, hover).
- [x] Polish `frontend/app/workinstructions/[id]/page.js` (header, buttons, cards).

## 5. Frontend: Shorten checklist names
- [x] Add `shortenTitle()` helper to `frontend/app/checklists/page.js` and apply to card titles.

## 6. Verify
- [x] Backend route file parses & imports correctly; `_resolve_document_path` resolves WI -> DOCX successfully.
- [x] Frontend `npm run build` succeeds with no errors.
