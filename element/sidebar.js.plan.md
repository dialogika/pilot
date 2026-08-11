# Quest Form Redesign Plan

## Overview
Replace the existing complex quest form with a new simplified modal that opens on top of the Main Quest modal. The new form will have cascading dropdowns and simplified fields.

## New Form Fields

| Field | Type | Behavior |
|-------|------|----------|
| Quest Title | Text input | Required |
| Department | Single-select dropdown | Required -dropdown | Load from Firestore `departments` |
| Position | Single-select dropdown | Filtered by selected department | Load from Firestore `positions` (filter by department) |
| Assign to | Single-select dropdown | Filtered by dept + position | Load from Firestore `users` (filter by employment.department + employment.position) |
| Notify to | Single-select dropdown | Same filter as Assign to | Same data as Assign to |
| Recurring | Complex UI (keep existing) | Keep current `questRecurState` logic | Remove due date field |
| Points | Single-select dropdown | Options: 1 Point (Easy), 2 Points (Medium), 3 Points (Hard) | Required |
| Priority/Urgent | Single-select dropdown | Options: Red (Urgent), Yellow (Medium), Green (Normal) | Required |

## Removed Fields
- Description (rich editor)
- Due Date (separate field)
- Reminder calendar
- Tags
- Multi-select for department/position/assign/notify

## Architecture Changes

### HTML Structure
1. Keep existing `questCreateForm` container but completely replace inner HTML
2. Add new modal wrapper that can be toggled separately
3. Use native `<select>` elements for simpler dropdowns (or keep custom dropdown if needed)

### JS Functions to Modify/Create

1. **`toggleQuestForm()`** - Opens the new form
2. **`loadQuestDepartments()`** - Load departments into department dropdown
3. **`loadQuestPositions(deptId)`** - Load positions filtered by department
4. **`loadQuestUsers(deptId, positionId)`** - Load users filtered by dept + position
5. **`saveQuest()`** - Completely rewrite to use new field values
6. **Form reset/clear** - Reset all dropdowns when opening/closing

### Data Structure for Firestore
```javascript
{
  title: string,
  department: { id, name },
  position: { id, name },
  assign_to: string (single uid),
  notify_to: string (single uid),
  points: number (1, 2, or 3),
  priority: 'urgent' | 'medium' | 'normal',
  recur: { ... existing recur object ... },
  status: 'Initiate',
  created_by: uid,
  created_by_name: string,
  created_at: serverTimestamp
}
```

### CSS Classes for New Form
- Use existing Tailwind classes
- Modal overlay z-index higher than main quest modal
- Form width: max-w-lg or max-w-2xl

## Implementation Steps

### Phase 1: New HTML Form (in sidebar.js template string)
- Replace `questCreateForm` inner HTML
- Add new modal structure

### Phase 2: Dropdown Loading Functions
- `loadQuestDepartments()` - populate department select
- `onDepartmentChange()` - clear position, load positions
- `onPositionChange()` - clear assign/notify, load users
- `loadQuestUsers(deptId, positionId)` - populate assign + notify

### Phase 3: Save Logic
- Rewrite `saveQuest()` to read from new form fields
- Validate required fields
- Build payload matching new structure

### Phase 4: Form Toggle/Reset
- `toggleQuestForm()` - open/close with proper reset
- `resetQuestForm()` - clear all selections

## Verification
1. Open Main Quest modal → click "+" → new form opens
2. Select department → positions filter correctly
3. Select position → users filter correctly
4. Select assign/notify users
5. Choose recurring pattern
6. Select points and priority
7. Save → quest appears in Today/Upcoming lists
8. Close form → Main Quest modal still open