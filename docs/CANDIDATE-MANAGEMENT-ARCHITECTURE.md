# Candidate Management Feature Architecture

## 1. Executive Summary
- **Module:** `pages/hr/candidate-management/`
- **Canonical Routes:** `/candidate-management`, `/hr/candidate-management`
- **Legacy Sources:** `data/candidate-management.html` & `element/candidate-management.js` (preserved as archive reference)
- **Architecture Pattern:** Pure Vanilla JS ES Modules (4-Layer: Repository, UI, Orchestrator, Scoped Styles)

---

## 2. File Directory Breakdown

```
pilot/pages/hr/candidate-management/
├── index.html                          # Semantic layout, topbar/sidebar mounts, 4 tabs (Team, Mentor, Internship, Positions), stat cards, card grid & list table, modals
├── candidate-management.js             # Orchestrator (Auth guard, shell mounting, event wiring, tab state, filter & sort, realtime listeners, actions)
├── candidate-management.repository.js  # Firestore queries/mutations for candidate collections, positions, users, trash, sync
├── candidate-management.ui.js          # DOM manipulation, candidate cards & list table rendering, stat cards, interview schedule table, template editor, positions cards
└── candidate-management.css            # Scoped styles (tab pills, stat cards with color tops, modern candidate cards, interviewer pills, positions themes)
```

---

## 3. Layer Separation of Concerns

### A. Repository (`candidate-management.repository.js`)
- **Zero DOM Operations.**
- Manages Firestore collection reads & writes for candidates, recruitment positions, and user lookup tables:
  - `fetchUsersMap()`, `subscribeUsers()`: Reads and monitors `users` collection for interviewer photo, name, specialization, and availability.
  - `fetchCandidates(collectionName)`, `subscribeCandidates(collectionName)`: Queries and listens to candidates across `teams_screening`, `mentors_screening`, `interns_screening`.
  - `updateCandidateStatus(collectionName, talentId, newStatus, actorName)`: Updates recruitment progress status and audit logs.
  - `cancelCandidateStatus(collectionName, talentId, notes, actorName)`: Marks candidate as canceled / withdrawn with optional reason.
  - `moveCandidateToTrash(config, talentId, payload)`: Soft deletes candidate into corresponding trash collection (`teams_screening_trash`, `mentors_screening_trash`, `interns_screening_trash`).
  - `syncTeamMember(...)`, `syncAcceptedMentor(...)`: Syncs accepted candidates to `team_management` and `mentor` collections.
  - `deleteSyncedCandidateData(config, talentId)`: Cleans up synchronized records if canceled or deleted.
  - `fetchPositions()`, `addPosition()`, `updatePosition()`, `togglePositionActive()`, `deletePosition()`: CRUD operations for `recruitment_positions`.
  - `saveCategoryTemplates()`: Persists WhatsApp chat templates for `team`, `mentor`, `intern`.
  - `uploadFileToStorage()`: Uploads attachments to Firebase Storage.

### B. UI Module (`candidate-management.ui.js`)
- **Zero Firestore Imports.**
- Implements:
  - `renderPipelineSummary(category, config, counts, total)`: Renders 7 stat cards with colored accents (Total, Screening, Interview, MT/Accepted, Onboarding, Rejected, Canceled).
  - `buildCandidateCardHtml(category, config, item, usersMap)`: Renders modern candidate cards with avatar, role, status badge, interviewer details, interview schedule, email, location, work mode, and rejection notes.
  - `buildCandidateRowHtml(category, config, item, usersMap)`: Renders table rows for list view.
  - `renderInterviewScheduleTable(entries, state, config)`: Renders searchable, filterable, and paginated interview schedule table inside modal.
  - `renderTemplateEditor(category, defs, values)`: Renders template editor with placeholders inside modal.
  - `renderPositionsCards(positionsData, categoryFilter)`: Renders active positions card grid with vibrant color palettes and inactive positions section with counter and restore/toggle actions.
  - `refreshTooltips()`: Initializes Bootstrap 5 tooltips across dynamic elements.

### C. Orchestrator (`candidate-management.js`)
- **Central Event & State Coordinator.**
- Integrates `requireAuth()` from `/assets/js/auth-guard.js`.
- Mounts shared `renderTopbar` and `renderSidebar` components as well as `renderRightbarRecruit`.
- Coordinates tab switching between `Team`, `Mentor`, `Internship`, and `Positions`.
- Manages filter state (live text search, status filter, sort presets).
- Manages view switching between Grid and List view.
- Controls modals (`#interviewScheduleModal`, `#templateBaseModal`, `#positionFormModal`).
- Manages candidate actions (Cancel prompt with SweetAlert, Move to Trash, Status transitions, Accepted sync workflows).

---

## 4. Firestore Schema Parity

### Collection `teams_screening` / `mentors_screening` / `interns_screening`
| Field | Type | Description |
|---|---|---|
| `basic_info.full_name` | `string` | Nama lengkap kandidat |
| `basic_info.avatar_url` | `string` | URL foto profil kandidat |
| `contact_info.email` | `string` | Alamat email kandidat |
| `contact_info.address` | `string` | Alamat / domisili kandidat |
| `role_name` / `position_name` | `string` | Posisi / jabatan yang dilamar |
| `internship.mode` | `string` | Mode kerja (WFO / WFH / Hybrid) |
| `recruitment_status.current` | `string` | Status rekrutmen aktif (`screening`, `interview`, `accepted`, `onboarding`, `rejected`, `canceled`, dll.) |
| `recruitment_status.due_date` | `string` | Tanggal jatuh tempo / jadwal |
| `recruitment_status.interview_schedule` | `string` | Waktu jadwal interview kandidat |
| `interviewers` | `array<string>` | Daftar UID interviewer |
| `is_deleted` | `boolean` | Flag status soft delete |
| `record_status` | `string` | Status record (`active` atau `inactive`) |

### Collection `recruitment_positions`
| Field | Type | Description |
|---|---|---|
| `name` | `string` | Nama posisi (e.g. "Admin Kelas", "Design Specialist") |
| `category` | `string` | Kategori posisi: `team` atau `internship` |
| `active` / `is_active` | `boolean` | Status aktif posisi |
| `createdAt` | `timestamp` | Waktu pembuatan record |
| `updatedAt` | `timestamp` | Waktu pembaruan record |

### Collection `users`
| Field | Type | Description |
|---|---|---|
| `displayName` / `name` | `string` | Nama interviewer |
| `photo` / `photoURL` | `string` | Foto profil interviewer |
| `specialization` | `string` | Bidang keahlian rekrutmen |
| `availability` | `string` | Status ketersediaan (`available` / `booked`) |

---

## 5. Parity & Compatibility Matrix
- Preserves 100% of candidate management capabilities across all 3 pipelines (`Team`, `Mentor`, `Internship`) and `Positions` management.
- Zero feature additions or removals.
- Strict 4-layer architecture compliance.
