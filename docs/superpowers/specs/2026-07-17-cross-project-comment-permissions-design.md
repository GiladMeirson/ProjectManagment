# Cross-project comment permissions — design

## Problem

Today, a non-admin user (user A) cannot add a comment to a project assigned to another non-admin user (user B). This is too restrictive: user A should be able to respond to comments on projects that aren't theirs. The risk is confusion — user A might not realize they're commenting on someone else's project — so the change must ship with clear visual indications that they're outside their own project.

Ownership of individual comments is unaffected: a user may only edit/delete their own comments, never another user's, regardless of whose project the comment lives on. Admins are unaffected — they could always do all of this.

## Current behavior (as implemented)

In `js/app.js`:

- `openCommentsModal` (line ~1478) gates the "+ הוסף הערה" (add comment) button via:
  ```js
  const canAdd = Auth.isAdmin() || this._currentCommentsProjectAssignedTo === this.currentUser.username;
  ```
  Non-admins only see the add-comment button on projects assigned to them.

- `canModifyComment` (line ~1457) gates the per-comment edit/delete icons via:
  ```js
  canModifyComment(comment) {
    if (Auth.isAdmin()) return true;
    const isMyProject = this._currentCommentsProjectAssignedTo === this.currentUser.username;
    if (!isMyProject) return false;
    return Number(comment.UserId) === Number(this.currentUser.userId);
  }
  ```
  This ties edit/delete rights to *both* project ownership and comment ownership. Once user A can add comments to user B's project, this check would incorrectly block user A from editing/deleting their own newly-added comment there (because `isMyProject` is false).

- `AssignedTo` on a project already holds the assignee's display name (`username: u.UserName` in `auth.js`), and is passed into `openCommentsModal(projectId, projectName, assignedTo)` as `_currentCommentsProjectAssignedTo`. No extra lookup is needed to display the owner's name.

- Price Offer comments modal (`poCommentsModal*`) is a separate, admin-only feature and is **out of scope** for this change — it keeps its current behavior untouched.

## Proposed behavior

### 1. Permission changes

- `canAdd` becomes unconditional for any authenticated non-admin user (in addition to admins) — the assigned-user check is removed. Any user may add a comment to any project's Comments modal.
- `canModifyComment` drops the `isMyProject` gate. New logic: `Auth.isAdmin() || Number(comment.UserId) === Number(this.currentUser.userId)`. A user may edit/delete a comment if and only if they authored it (or they're an admin) — regardless of which project it lives on.

### 2. Indication 1 — ownership badge in the modal header (ambient / always visible)

When `openCommentsModal` renders and the viewer is not the project's assigned user, show a pill badge next to the modal title reading:

> פרויקט של {שם עובד}

Implementation:
- New badge variant in `css/badges.css`, e.g. `.badge-foreign-project`, using the existing `.badge` base class with amber/caution tones (soft amber background, amber border, dark amber text) — visually distinct from the existing status/priority badge palettes so it isn't mistaken for a project status.
- Rendered into a new element in the `#commentsModal` header (next to `#commentsModalTitle`), populated/toggled in `openCommentsModal` based on `assignedTo !== this.currentUser.username`.
- Shown regardless of admin status (harmless/informative for admins too), since the check is simply "is this project not assigned to the viewer."

### 3. Indication 2 — inline notice above the comment composer (contextual / just-in-time)

When the add-comment form (`#addCommentForm`) is opened via `toggleAddCommentBtn` on a project not assigned to the current user, show a one-line notice directly above `#newCommentText`:

> הערה זו תתווסף לפרויקט של {שם עובד}

This fires at the exact moment the new capability is exercised (about to write a comment on someone else's project) — the highest-value moment to prevent an honest mix-up, since it's the point where the actual action happens, not just where the user is browsing.

The notice is only injected/shown when `assignedTo !== this.currentUser.username`; it's absent entirely on the user's own projects, so no behavior changes for the common case.

### Why this combination

One ambient cue (badge, seen immediately on modal open, no interaction required) plus one contextual cue (composer notice, seen exactly when composing) covers both ways confusion could happen: skimming comments without registering whose project it is, and typing a comment on autopilot. Both reuse the existing badge/notice visual language already present in the app rather than introducing new UI patterns, and neither relies on hover (so they work identically on touch devices).

Rejected alternatives:
- Whole-modal color tint + owner name appended to the title text — relies on color alone (weak for scannability/accessibility) and conflates title with metadata.
- Icon + tooltip badge, plus a submit-time confirmation step — tooltips require hover (unreliable on mobile), and a confirmation on every submit adds friction beyond what was asked (an indication, not a gate).

## Out of scope

- Price Offer comments modal (stays admin-only, unchanged).
- Any change to who can *view* comments (unchanged — visibility rules are untouched).
- Notifications/mentions behavior (unchanged).

## Testing considerations

- Non-admin user A can now see and use the add-comment button on a project assigned to user B, and the two indications appear.
- Non-admin user A does **not** see the badge/notice on their own projects.
- Non-admin user A can edit/delete their own comment on user B's project.
- Non-admin user A cannot edit/delete a comment authored by user B (or anyone else) on any project, including their own.
- Admin behavior is unchanged (sees all comments, can modify any comment, badge may appear informatively but doesn't gate anything).
