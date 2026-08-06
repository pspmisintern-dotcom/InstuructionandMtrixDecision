# WI Manager Advanced Improvements — Implementation Checklist

## 1. AI Assistant — Scroll Fix + Dark Mode
- [x] Modify `frontend/app/ai/page.js` — outer height `calc(100vh - 130px)`, theme-aware colors
- [x] Replace hardcoded hex colors with theme tokens

## 2. Login Page — Premium Redesign
- [x] Modify `frontend/app/login/page.js` — theme-aware right panel colors (dark mode polish)

## 3. Decision Matrix Engine — Advanced Upgrade
- [x] Add "Cleaning" process category to `PROCESS_CONFIG`
- [x] Add verdict banner (✅ APPROVED / ⚠️ NEEDS REVIEW / 🚫 BLOCKED)
- [x] Add edit-rule dialog for admins
- [x] Backend: add `risk_score` to `/decision/evaluate` response
- [x] Backend: add PUT `/rules/{rule_id}` update endpoint
- [x] Frontend: add `decisionApi.updateRule()`

## 4. Remove Checklist Section
- [x] Remove Checklists nav item from `frontend/components/Layout.js`

## 5. Audit Page — Advanced Redesign
- [x] Add date-range filter
- [x] Add timeline view toggle
- [x] Add CSV export button

## 6. Inspection Report — Proper Problem Reporting
- [x] Backend: add `/inspection/all` endpoint
- [x] Frontend: rewrite inspection page with status tabs, expandable details, severity badges, summary dashboard
- [x] Add `inspectionApi.all()`

## 7. Dark Mode — Proper Fix
- [x] Add MUI component overrides in `frontend/components/ThemeProvider.js`
- [x] Replace hardcoded colors in dashboard, audit, inspection, ai, login pages

## 8. General WI Manager Improvements
- [x] Add activity feed + loading skeletons to dashboard
- [x] Add breadcrumb navigation to work instruction detail page
- [x] Add real-time notification badge count in `frontend/components/Layout.js`

## 9. AI Assistant — Fit Fix + Short Pointwise Answers
- [x] Fix `frontend/app/ai/page.js` — outer height `calc(100vh - 112px)` to fit layout, reduce bubble maxWidth to 72%
- [x] Update `backend/ai_assistant.py` — SYSTEM_PROMPT requires short concise pointwise answers (max 5 bullets)
- [x] Limit offline answer to 5 bullet points with line truncation

## 10. Work Instruction Page — Remove Operations Procedure Section
- [x] Remove "Operations Procedure & Instructions" section from `frontend/app/workinstructions/[id]/page.js` (Tab 0 document view)
- [x] Remove `wi.procedure` display from Step 3 "Procedure Check" in Interactive Execution Mode (Tab 1)

## 11. Reports & Pending Approvals Fixes
- [x] Fix critical `IndentationError` in `backend/routes/decision_routes.py` (caused backend to fail loading → reports "not found")
- [x] Verify all report generation functions work (operator_compliance, ppe_compliance, inspection, ai_usage, wi_usage, audit_trail, faq, revision_history, training_status)
- [x] Clean stale pending approvals (ids 1, 2) → dashboard pending count now 0

## 12. Work Instruction Page — Remove Sectional Breakdown
- [x] Remove "Sectional Breakdown" accordion block from `frontend/app/workinstructions/[id]/page.js` (Tab 0 document view)
- [x] Remove now-unused MUI imports (`Accordion`, `AccordionSummary`, `AccordionDetails`, `ExpandMore`)
- [x] Verify build — **SUCCESS** (Compiled successfully in 5.4s)

## Verification
- [x] Run `cd frontend && npm run build` — **SUCCESS** (Compiled successfully in 4.4s, all 15 pages generated)
</content>
