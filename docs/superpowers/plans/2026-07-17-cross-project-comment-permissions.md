# Cross-Project Comment Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any non-admin user add a comment to any project's Comments modal (not just projects assigned to them), while showing two clear visual indications when they're doing so on a project that isn't theirs, and keeping edit/delete rights limited to the comment's own author.

**Architecture:** This is a static HTML/CSS/vanilla-JS + jQuery app (no build step, no bundler) driven by `js/app.js`'s `App` object, talking to a remote REST backend. All changes are confined to `js/app.js` (permission logic + wiring), `pages/index.html` (two new markup elements in the Comments modal), and three CSS files (`css/badges.css`, `css/modals.css`, `css/darkmode.css`) for a new badge variant and a new notice component. No new files, no new dependencies.

**Tech Stack:** Vanilla JS, jQuery, DataTables, plain CSS (no preprocessor). Backend is a separate Node/Express service at `https://projectmanagmentserver.onrender.com` (CORS enabled for all origins per `README.md`), unaffected by this plan — this is purely a frontend permission + UI change.

## Global Constraints

- Price Offer comments modal (`#priceOfferCommentsModal` / `poComments*` code) is out of scope and must not change.
- Comment *visibility* rules are unchanged — only who may *add* a comment, and who may *edit/delete* a given comment, change.
- Notifications/mentions behavior is unchanged.
- All new UI copy is in Hebrew (RTL), matching the existing tone in `pages/index.html` / `js/app.js`.
- Reuse the existing `.badge` base class (`css/badges.css`) and the existing `--warning-color`/amber palette family already used elsewhere in the app (e.g. `.badge-status-waiting`) — no new visual language, no new libraries.
- Indications must not depend on hover (must work identically on touch/mobile) — no tooltip-only affordances.
- **No automated test framework exists in this repo** (no `package.json`, no test runner — it's a static HTML/CSS/JS app opened directly in a browser). Every task's verification step is a manual check performed in a real browser against the live backend. Because that backend is a shared, real service (not a local mock), any verification step that adds a real comment should use a project you can identify and clean up afterward (edit the test comment to something recognizable like "TEST — ignore", or delete it once verified) rather than leaving stray data behind.

---

### Task 1: Fix comment permission logic

**Files:**
- Modify: `js/app.js` (`canModifyComment`, currently lines 1454-1462)
- Modify: `js/app.js` (`openCommentsModal`, currently lines 1475-1492)

**Interfaces:**
- Consumes: `Auth.isAdmin()` (existing, `js/auth.js`), `this.currentUser.username` / `this.currentUser.userId` (existing, set at login).
- Produces: `canModifyComment(comment)` now returns `true` iff admin or `comment.UserId === currentUser.userId`, regardless of project ownership — later tasks and existing callers (`renderComments`, line ~1530) keep using it unchanged. `openCommentsModal` no longer hides `#toggleAddCommentBtn` for non-owners — Task 2 builds on this exact version of the function.

- [ ] **Step 1: Read the current `canModifyComment` to confirm the exact text to replace**

Open `js/app.js` and confirm this block exists (around line 1454):

```js
  /**
   * Check if current user can edit or delete a comment
   */
  canModifyComment(comment) {
    if (Auth.isAdmin()) return true;
    const isMyProject = this._currentCommentsProjectAssignedTo === this.currentUser.username;
    if (!isMyProject) return false;
    return Number(comment.UserId) === Number(this.currentUser.userId);
  },
```

- [ ] **Step 2: Remove the project-ownership gate, keep only comment-ownership**

Replace it with:

```js
  /**
   * Check if current user can edit or delete a comment
   */
  canModifyComment(comment) {
    if (Auth.isAdmin()) return true;
    return Number(comment.UserId) === Number(this.currentUser.userId);
  },
```

- [ ] **Step 3: Find and update `openCommentsModal`'s add-comment button gating**

Confirm this block exists (around line 1475):

```js
  /**
   * Open the comments modal for a given project
   */
  openCommentsModal(projectId, projectName, assignedTo) {
    this._currentCommentsProjectId = projectId;
    this._currentCommentsProjectAssignedTo = assignedTo || "";
    $("#commentsModalTitle").text(projectName || "הערות פרויקט");
    $("#commentsModalSubtitle").text("");
    // Reset add form
    $("#addCommentForm").addClass("hidden");
    $("#newCommentText").val("");
    $("#toggleAddCommentBtn").text("+ הוסף הערה");
    // Show "add comment" button only if admin or project is assigned to current user
    const canAdd = Auth.isAdmin() || this._currentCommentsProjectAssignedTo === this.currentUser.username;
    $("#toggleAddCommentBtn").toggleClass("hidden", !canAdd);
    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },
```

Replace it with:

```js
  /**
   * Open the comments modal for a given project
   */
  openCommentsModal(projectId, projectName, assignedTo) {
    this._currentCommentsProjectId = projectId;
    this._currentCommentsProjectAssignedTo = assignedTo || "";
    $("#commentsModalTitle").text(projectName || "הערות פרויקט");
    $("#commentsModalSubtitle").text("");
    // Reset add form
    $("#addCommentForm").addClass("hidden");
    $("#newCommentText").val("");
    $("#toggleAddCommentBtn").text("+ הוסף הערה");
    // Any authenticated user (admin or not) may add a comment to any project
    $("#toggleAddCommentBtn").removeClass("hidden");
    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },
```

- [ ] **Step 4: Manual verification — permission logic**

You need two non-admin user accounts, each assigned at least one different project (use `pages/users.html` / the admin "AssignedTo" inline select in the projects table to arrange this if needed).

1. Open `pages/login.html` in a browser and sign in as non-admin **User A**.
2. Open the Comments modal on a project assigned to **User B** (not A). Confirm the "+ הוסף הערה" button is now visible (previously it would have been hidden).
3. Click it, type a test comment (e.g. "TEST — ignore"), submit. Confirm it saves and appears in the list.
4. Confirm the edit (✎) and delete (🗑) icons appear on *that* comment (the one User A just added) — this is the fix from Step 2, since previously `isMyProject` would have blocked this even though it's A's own comment.
5. Confirm edit/delete icons do **not** appear on any comment authored by User B or anyone else in that same modal.
6. Sign out, sign in as **User B**, open the same project's Comments modal, and confirm B still cannot edit/delete A's test comment, but can edit/delete their own.
7. Clean up: delete the "TEST — ignore" comment (as User A or an admin) so it doesn't linger as real project data.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "fix: allow commenting on any project, restrict edit/delete to comment owner"
```

---

### Task 2: Ownership badge in the modal header

**Files:**
- Modify: `pages/index.html` (Comments modal header, currently lines 439-445)
- Modify: `css/badges.css` (append new badge variant, after `.badge-priority-hold`, currently lines 29-33)
- Modify: `css/darkmode.css` (append dark override, after `.badge-priority-hold` dark block, currently lines 152-156)
- Modify: `js/app.js` (`openCommentsModal`, the version produced by Task 1)

**Interfaces:**
- Consumes: `.badge` base class (existing, `css/badges.css`), `this._currentCommentsProjectAssignedTo` / `this.currentUser.username` (existing).
- Produces: new DOM id `#commentsModalOwnerBadge` and new CSS class `.badge-foreign-project`. New local variable `isForeignProject` inside `openCommentsModal` — Task 3 reuses this exact variable name, so it must be computed in this task, not recomputed differently later.

- [ ] **Step 1: Add the badge element to the Comments modal header**

In `pages/index.html`, find (this is the Comments modal — do not confuse with the visually similar Price Offer modal further down that uses `poCommentsModalTitle`):

```html
        <div class="modal-header">
          <div>
            <h3 id="commentsModalTitle">הערות פרויקט</h3>
            <span id="commentsModalSubtitle" class="modal-subtitle"></span>
          </div>
          <button class="modal-close">&times;</button>
        </div>
```

Replace it with:

```html
        <div class="modal-header">
          <div>
            <h3 id="commentsModalTitle">הערות פרויקט</h3>
            <span id="commentsModalSubtitle" class="modal-subtitle"></span>
            <span id="commentsModalOwnerBadge" class="badge badge-foreign-project hidden"></span>
          </div>
          <button class="modal-close">&times;</button>
        </div>
```

- [ ] **Step 2: Add the light-mode badge style**

In `css/badges.css`, find:

```css
.badge-priority-hold {
  background: var(--gray-100);
  color: var(--gray-600);
  border: 1px solid var(--gray-300);
}

/* ---- Status ---- */
```

Replace it with:

```css
.badge-priority-hold {
  background: var(--gray-100);
  color: var(--gray-600);
  border: 1px solid var(--gray-300);
}

/* ---- Foreign project indicator ---- */
.badge-foreign-project {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

/* ---- Status ---- */
```

- [ ] **Step 3: Add the dark-mode badge override**

In `css/darkmode.css`, find:

```css
[data-theme="dark"] .badge-priority-hold {
  background: #1e2436;
  color: #9ca3af;
  border-color: #2a3045;
}

/* Status */
```

Replace it with:

```css
[data-theme="dark"] .badge-priority-hold {
  background: #1e2436;
  color: #9ca3af;
  border-color: #2a3045;
}

[data-theme="dark"] .badge-foreign-project {
  background: #2d1f00;
  color: #fbbf24;
  border-color: #4a3300;
}

/* Status */
```

- [ ] **Step 4: Wire the badge in `openCommentsModal`**

In `js/app.js`, find the version of `openCommentsModal` produced by Task 1:

```js
  openCommentsModal(projectId, projectName, assignedTo) {
    this._currentCommentsProjectId = projectId;
    this._currentCommentsProjectAssignedTo = assignedTo || "";
    $("#commentsModalTitle").text(projectName || "הערות פרויקט");
    $("#commentsModalSubtitle").text("");
    // Reset add form
    $("#addCommentForm").addClass("hidden");
    $("#newCommentText").val("");
    $("#toggleAddCommentBtn").text("+ הוסף הערה");
    // Any authenticated user (admin or not) may add a comment to any project
    $("#toggleAddCommentBtn").removeClass("hidden");
    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },
```

Replace it with:

```js
  openCommentsModal(projectId, projectName, assignedTo) {
    this._currentCommentsProjectId = projectId;
    this._currentCommentsProjectAssignedTo = assignedTo || "";
    $("#commentsModalTitle").text(projectName || "הערות פרויקט");
    $("#commentsModalSubtitle").text("");
    // Reset add form
    $("#addCommentForm").addClass("hidden");
    $("#newCommentText").val("");
    $("#toggleAddCommentBtn").text("+ הוסף הערה");
    // Any authenticated user (admin or not) may add a comment to any project
    $("#toggleAddCommentBtn").removeClass("hidden");

    // Indication 1: badge showing the project owner when it's not the viewer's project
    const isForeignProject = !!this._currentCommentsProjectAssignedTo
      && this._currentCommentsProjectAssignedTo !== this.currentUser.username;
    $("#commentsModalOwnerBadge")
      .text(isForeignProject ? `פרויקט של ${this._currentCommentsProjectAssignedTo}` : "")
      .toggleClass("hidden", !isForeignProject);

    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },
```

- [ ] **Step 5: Manual verification — badge**

1. Sign in as non-admin User A. Open the Comments modal on a project assigned to User B. Confirm an amber pill reading `פרויקט של {B's name}` appears next to the modal title.
2. Open the Comments modal on a project assigned to A themselves. Confirm the badge does **not** appear.
3. Open the Comments modal on an unassigned project (`AssignedTo` empty/null, if one exists in your data). Confirm the badge does **not** appear (it must not render "פרויקט של" with a blank name).
4. Toggle dark mode (existing theme switcher) and repeat check 1 — confirm the badge is legible (amber-on-dark, not amber-on-amber or invisible).

- [ ] **Step 6: Commit**

```bash
git add pages/index.html css/badges.css css/darkmode.css js/app.js
git commit -m "feat: show project-owner badge in comments modal for non-owned projects"
```

---

### Task 3: Composer notice above the add-comment textarea

**Files:**
- Modify: `pages/index.html` (`#addCommentForm`, currently lines 450-459)
- Modify: `css/modals.css` (append new notice style, before `.add-comment-form textarea`, currently around line 293)
- Modify: `css/darkmode.css` (append dark override, after `.comment-delete-confirm span` dark block, currently lines 306-308)
- Modify: `js/app.js` (`openCommentsModal`, the version produced by Task 2)

**Interfaces:**
- Consumes: `isForeignProject` (computed in Task 2's edit to `openCommentsModal` — must not be recomputed with different logic).
- Produces: new DOM id `#commentsModalForeignNotice` and new CSS class `.foreign-project-notice`. Nothing later depends on these.

- [ ] **Step 1: Add the notice element inside the add-comment form**

In `pages/index.html`, find:

```html
          <div id="addCommentForm" class="add-comment-form hidden">
            <textarea id="newCommentText" rows="3"
              placeholder="כתוב הערה..."></textarea>
            <div class="add-comment-actions">
              <button id="submitCommentBtn" class="btn btn-subtle-success">שמור
                הערה</button>
              <button id="cancelCommentBtn"
                class="btn btn-subtle-danger">ביטול</button>
            </div>
          </div>
```

Replace it with:

```html
          <div id="addCommentForm" class="add-comment-form hidden">
            <p id="commentsModalForeignNotice" class="foreign-project-notice hidden"></p>
            <textarea id="newCommentText" rows="3"
              placeholder="כתוב הערה..."></textarea>
            <div class="add-comment-actions">
              <button id="submitCommentBtn" class="btn btn-subtle-success">שמור
                הערה</button>
              <button id="cancelCommentBtn"
                class="btn btn-subtle-danger">ביטול</button>
            </div>
          </div>
```

- [ ] **Step 2: Add the light-mode notice style**

In `css/modals.css`, find:

```css
.comment-delete-confirm span {
  font-size: 0.88rem;
  color: #6b7280;
}

/* Add comment form in footer */
.add-comment-form textarea {
```

Replace it with:

```css
.comment-delete-confirm span {
  font-size: 0.88rem;
  color: #6b7280;
}

/* Add comment form in footer */
.foreign-project-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.add-comment-form textarea {
```

- [ ] **Step 3: Add the dark-mode notice override**

In `css/darkmode.css`, find:

```css
[data-theme="dark"] .comment-delete-confirm span {
  color: #9ca3af;
}

[data-theme="dark"] .comments-empty {
```

Replace it with:

```css
[data-theme="dark"] .comment-delete-confirm span {
  color: #9ca3af;
}

[data-theme="dark"] .foreign-project-notice {
  background: #2d1f00;
  color: #fbbf24;
  border-color: #4a3300;
}

[data-theme="dark"] .comments-empty {
```

- [ ] **Step 4: Wire the notice in `openCommentsModal`**

In `js/app.js`, find the version of `openCommentsModal` produced by Task 2 (shown in full in Task 2 Step 4's "after" block) and insert the notice block right after the badge block, before `$("#commentsModal").addClass("show");`:

```js
    // Indication 1: badge showing the project owner when it's not the viewer's project
    const isForeignProject = !!this._currentCommentsProjectAssignedTo
      && this._currentCommentsProjectAssignedTo !== this.currentUser.username;
    $("#commentsModalOwnerBadge")
      .text(isForeignProject ? `פרויקט של ${this._currentCommentsProjectAssignedTo}` : "")
      .toggleClass("hidden", !isForeignProject);

    // Indication 2: notice above the composer, revealed whenever the add-comment form is opened
    $("#commentsModalForeignNotice")
      .text(isForeignProject ? `הערה זו תתווסף לפרויקט של ${this._currentCommentsProjectAssignedTo}` : "")
      .toggleClass("hidden", !isForeignProject);

    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },
```

(The full function body should now have both the badge block and this notice block between `$("#toggleAddCommentBtn").removeClass("hidden");` and `$("#commentsModal").addClass("show");`.)

- [ ] **Step 5: Manual verification — notice**

1. Sign in as non-admin User A. Open the Comments modal on a project assigned to User B, then click "+ הוסף הערה". Confirm the amber notice `הערה זו תתווסף לפרויקט של {B's name}` appears above the textarea.
2. Open the Comments modal on A's own project and click "+ הוסף הערה". Confirm no notice appears.
3. With the form open on User B's project (notice visible), click "✕ סגור" to close it, then reopen — confirm the notice is still correctly shown (it's re-rendered by `openCommentsModal`, not by the toggle handler, so it should persist correctly across opens of the same modal instance).
4. Toggle dark mode and repeat check 1 — confirm legibility.

- [ ] **Step 6: Commit**

```bash
git add pages/index.html css/modals.css css/darkmode.css js/app.js
git commit -m "feat: show composer notice when adding a comment to a non-owned project"
```

---

### Task 4: End-to-end verification pass

**Files:** None (verification only — no code changes).

**Interfaces:** N/A.

- [ ] **Step 1: Re-read the spec's testing considerations**

Open `docs/superpowers/specs/2026-07-17-cross-project-comment-permissions-design.md` and re-read the "Testing considerations" section.

- [ ] **Step 2: Run the full scenario as two non-admin users**

Using the same two non-admin accounts (User A assigned to Project P1, User B assigned to Project P2) from Task 1:

1. As A: open Comments on P2 (B's project) — confirm badge + notice both appear, add-comment button visible, add a comment, edit it, delete it (full round trip on A's own comment in a foreign project).
2. As A: open Comments on P1 (A's own project) — confirm neither badge nor notice appears anywhere, everything looks exactly as it did before this change.
3. As B: open Comments on P2 (B's own project) — confirm B can still edit/delete B's own older comments there, and cannot edit/delete any comment left behind by A.
4. As an admin: open Comments on both P1 and P2 — confirm admin can still see, add, edit, and delete any comment anywhere (unchanged from before), and that the badge (if it renders for admins per Task 2's design — it's not gated on admin status) does not block or alter any admin action.

- [ ] **Step 3: Confirm Price Offer comments are untouched**

As a non-admin user, confirm the Price Offer comments entry point (`.po-comment-cell`) is still hidden/inaccessible exactly as before (admin-only), proving this change didn't leak into that modal.

- [ ] **Step 4: Clean up test data**

Delete or clearly mark any test comments created during verification so the shared backend doesn't accumulate throwaway data.

- [ ] **Step 5: Final commit (if any cleanup or fixups were needed)**

Only if Steps 2-3 revealed something requiring a code fix — make the fix, then:

```bash
git add -A
git commit -m "fix: address issues found in end-to-end verification"
```

If no fixes were needed, skip this step — Task 3's commit is the last one.
