/**
 * Project Management Application
 * Main application logic with DataTable and inline editing
 */

// Admin menu actions — add new entries here to extend the menu, no HTML changes needed
const ADMIN_ACTIONS = [
  {
    label: "הוסף עובד חדש",
    action: () => {
      $("#adminMenuModal").removeClass("show");
      $("#addEmployeeModal").addClass("show");
    },
  },
  {
    label: "הוסף פרויקט חדש",
    action: () => {
      $("#adminMenuModal").removeClass("show");
      App.showAddModal();
    },
  },
];

// Application State
const App = {
  table: null,
  data: [],
  currentUser: null,
  _currentCommentsProjectId: null,

  /**
   * Initialize the application
   */
  async init() {
    // Check authentication
    if (!Auth.requireAuth()) return;

    this.currentUser = Auth.getCurrentUser();
    this.renderUserInfo();
    this.bindEvents();
    this.updateUIForRole();
    this.buildAdminMenu();
    // Enhance static selects in the employee modal on first load
    enhanceAllSelects(document.getElementById('addEmployeeModal'));

    await this.loadData();
  },

  /**
   * Fetch projects from API, transform and render table
   */
  async loadData() {
    startLoader("טוען פרויקטים...");
    try {
      const projects = await ApiClient.getAllProjects();
      this.data = this.transformProjects(projects);

      // Destroy existing table before re-initialising (e.g. after create)
      if (this.table) {
        this.table.destroy();
        this.table = null;
        $("#projectsTable").empty();
      }

      this.initDataTable();
      this.updateProjectCount();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "שגיאה",
        text: "לא ניתן לטעון פרויקטים מהשרת",
        confirmButtonText: "אישור",
      });
    } finally {
      stopLoader();
    }
  },

  /**
   * Transform raw API projects to internal format and sort
   */
  transformProjects(rawProjects) {
    const transformed = rawProjects
      .filter((p) => !p.IsDeleted)
      .map((p) => ({
        ProjectId: p.ProjectId,
        ProjectNumber: p.ProjectNumber,
        ProjectName: p.ProjectName,
        Priority: p.Priority || PRIORITY.NEW,
        AssignedTo: p.AssignedTo || "",
        Status: p.Status || STATUS.WAITING,
        Chachi: p.Chachi ? YES_NO.YES : YES_NO.NO,
        ChachiIsExecuted: !!p.ChachiIsExecuted,
        Bezeq: p.Bezeq ? YES_NO.YES : YES_NO.NO,
        BezeqIsExecuted: !!p.BezeqIsExecuted,
        Hot: p.Hot ? YES_NO.YES : YES_NO.NO,
        HotIsExecuted: !!p.HotIsExecuted,
        LastCommentText: p.LastCommentText || "",
        LastCommentUserName: p.LastCommentUserName || "",
        LastCommentUserRole: p.LastCommentUserRole || "",
      }));

    // Sort: current user's projects first
    const me = this.currentUser.username;
    transformed.sort((a, b) => {
      const aIsMe = a.AssignedTo === me;
      const bIsMe = b.AssignedTo === me;
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return 0;
    });

    return transformed;
  },

  /**
   * Render user info in header
   */
  renderUserInfo() {
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const userRole = document.getElementById("userRole");

    if (userAvatar)
      userAvatar.textContent = this.currentUser.username.charAt(0);
    if (userName) userName.textContent = this.currentUser.username;
    if (userRole)
      userRole.textContent =
        this.currentUser.role === "admin" ? "מנהל מערכת" : "משתמש";
  },

  /**
   * Update the project count badge in the card header
   */
  updateProjectCount() {
    const el = document.getElementById("projectCount");
    if (el) el.textContent = this.data.length;
  },

  /**
   * Update UI elements based on user role
   */
  updateUIForRole() {
    const adminMenuBtn = document.getElementById("adminMenuBtn");
    if (adminMenuBtn) {
      adminMenuBtn.classList.toggle("hidden", !Auth.isAdmin());
    }
  },

  /**
   * Build admin menu list from ADMIN_ACTIONS config
   */
  buildAdminMenu() {
    if (!Auth.isAdmin()) return;
    const $list = $("#adminMenuList").empty();
    ADMIN_ACTIONS.forEach(({ label, action }) => {
      $("<button>").addClass("admin-menu-item").text(label)
        .on("click", action)
        .appendTo($list);
    });
  },

  /**
   * Initialize DataTable
   */
  initDataTable() {
    const self = this;

    this.table = $("#projectsTable").DataTable({
      data: this.data,
      columns: [
        {
          data: "ProjectNumber",
          title: "מספר פרויקט",
        },
        {
          data: "ProjectName",
          title: "שם הפרויקט",
        },
        {
          data: "Priority",
          title: "עדיפות",
          render: (data) => this.renderPriorityBadge(data),
        },
        {
          data: "AssignedTo",
          title: "מוקצה ל",
          render: (data) =>
            data ? `<span class="assigned-user">${this.escapeHtml(data)}</span>` : '<span class="badge badge-empty">--</span>',
        },
        {
          data: "Status",
          title: "סטטוס",
          render: (data) => this.renderStatusBadge(data),
        },
        {
          data: "LastCommentText",
          title: "הערות",
          render: (data, _type, row) => {
            if (!data) return '<span class="badge badge-empty">--</span>';
            const isAdmin = row.LastCommentUserRole === "admin";
            const displayName = isAdmin ? "מנהל מערכת" : this.escapeHtml(row.LastCommentUserName || "");
            const truncated = data.length > 45 ? data.substring(0, 45) + "..." : data;
            return `<span class="comment-cell"
              data-project-id="${row.ProjectId}"
              data-project-name="${this.escapeHtml(row.ProjectName)}"
              ><strong class="comment-author">${displayName}:</strong> ${this.escapeHtml(truncated)}</span>`;
          },
        },
        {
          data: "Chachi",
          title: 'חח"י',
          className: "editable-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.ChachiIsExecuted),
        },
        {
          data: "Bezeq",
          title: "בזק",
          className: "editable-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.BezeqIsExecuted),
        },
        {
          data: "Hot",
          title: "הוט",
          className: "editable-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.HotIsExecuted),
        },
        {
          data: null,
          title: "פעולות",
          orderable: false,
          searchable: false,
          className: "text-center",
          render: (_data, _type, _row, meta) => {
            if (!Auth.isAdmin()) return "";
            return `
              <div class="action-buttons">
                <button class="btn btn-subtle-danger btn-icon btn-sm delete-btn"
                        data-row="${meta.row}"
                        title="מחק פרויקט">
                  ✕
                </button>
              </div>
            `;
          },
        },
      ],
      language: {
        search: "חיפוש:",
        lengthMenu: "הצג _MENU_ רשומות",
        info: "מציג _START_ עד _END_ מתוך _TOTAL_ רשומות",
        infoEmpty: "מציג 0 עד 0 מתוך 0 רשומות",
        infoFiltered: "(מסונן מתוך _MAX_ רשומות)",
        paginate: {
          first: "ראשון",
          last: "אחרון",
          next: "הבא",
          previous: "הקודם",
        },
        zeroRecords: "לא נמצאו רשומות תואמות",
        emptyTable: "אין נתונים זמינים בטבלה",
      },
      dom: '<"top-controls"<"top-right"lf><"top-left"B>>rt<"bottom-controls"<"bottom-right"i><"bottom-left"p>>',
      buttons: [
        {
          extend: "excelHtml5",
          text: "ייצוא לאקסל",
          title: "פרויקטים",
          className: "dt-button-excel",
          exportOptions: {
            columns: ":not(:last-child)",
            format: {
              body: function (data, _row, _column, _node) {
                // Strip HTML tags for export
                const temp = document.createElement("div");
                temp.innerHTML = data;
                return temp.textContent || temp.innerText || data;
              },
            },
          },
        },
      ],
      pageLength: 50,
      order: [],
      responsive: false,
      scrollX: true,
    });

    // Handle cell click for YES/NO inline editing (Chachi/Bezeq/Hot columns only)
    $("#projectsTable tbody").on("click", "td.editable-cell", function (e) {
      // Don't open select when clicking on the checkbox itself
      if ($(e.target).hasClass("executed-check")) return;
      self.handleCellClick(this);
    });

    // Handle IsExecuted checkbox change (admin only)
    $("#projectsTable tbody").on("change", ".executed-check", function () {
      if (!Auth.isAdmin()) return;
      const $cell = $(this).closest("td");
      const row = self.table.row($cell.parent());
      const rowIndex = row.index();
      const colIndex = $cell.index();
      const columns = self.table.settings().init().columns;
      const columnName = columns[colIndex].data; // "Chachi", "Bezeq", or "Hot"
      const executedField = columnName + "IsExecuted";
      self.data[rowIndex][executedField] = this.checked;
      // Redraw cell without full table redraw
      self.table.row(rowIndex).data(self.data[rowIndex]).draw(false);
    });

    // Handle delete button click
    $("#projectsTable tbody").on("click", ".delete-btn", function (e) {
      e.stopPropagation();
      const rowIndex = $(this).data("row");
      self.confirmDelete(rowIndex);
    });

    // Handle comment cell click — open full comments modal
    $("#projectsTable tbody").on("click", ".comment-cell", function (e) {
      e.stopPropagation();
      const $el = $(this);
      self.openCommentsModal($el.data("project-id"), $el.data("project-name"));
    });
  },

  /**
   * Handle cell click for inline editing (Chachi/Bezeq/Hot only)
   */
  handleCellClick(cell) {
    const $cell = $(cell);
    const columnIndex = $cell.index();
    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];
    const columns = this.table.settings().init().columns;
    const columnName = columns[columnIndex].data;

    // Only allow editing Chachi / Bezeq / Hot
    if (!["Chachi", "Bezeq", "Hot"].includes(columnName)) return;

    // Skip if already editing
    if ($cell.find("input, select").length > 0) return;

    // Permission check for non-admins: only own projects
    if (!Auth.isAdmin() && rowData.AssignedTo !== this.currentUser.username) {
      this.showLockedMessage();
      return;
    }

    const currentValue = rowData[columnName] || "";
    this.createEditControl($cell, rowIndex, columnName, currentValue);
  },

  /**
   * Show message when cell is locked
   */
  showLockedMessage() {
    Swal.fire({
      icon: "warning",
      title: "אין הרשאה",
      text: "אין לך הרשאה לערוך שדה זה",
      confirmButtonText: "אישור",
      customClass: { confirmButton: "swal-btn" },
    });
  },

  /**
   * Create YES/NO select edit control
   */
  createEditControl($cell, rowIndex, columnName, currentValue) {
    const inputHtml = this.createSelect(currentValue, Object.values(YES_NO));
    $cell.html(inputHtml);
    const $input = $cell.find("select");

    enhanceSelect($input[0]);
    $cell.find(".cs-trigger").focus();

    this.bindEditEvents($cell, $input, rowIndex, columnName, currentValue);
  },

  /**
   * Create select dropdown HTML
   */
  createSelect(currentValue, options) {
    let html = '<select class="edit-select">';
    options.forEach((opt) => {
      const selected = opt === currentValue ? "selected" : "";
      html += `<option value="${this.escapeHtml(opt)}" ${selected}>${this.escapeHtml(opt) || "-- בחר --"}</option>`;
    });
    html += "</select>";
    return html;
  },

  /**
   * Bind events for edit controls
   */
  bindEditEvents($cell, $input, rowIndex, columnName, originalValue) {
    const self = this;
    let saved = false;

    $input.on("change", function () {
      if (saved) return;
      saved = true;
      self.saveCell($cell, rowIndex, columnName, $(this).val());
    });

    $cell.find(".cs-trigger").on("blur", function () {
      if (saved) return;
      saved = true;
      self.saveCell($cell, rowIndex, columnName, $input.val());
    });

    $cell.on("cs:escape", function () {
      if (saved) return;
      saved = true;
      self.table.cell($cell).data(originalValue).draw(false);
    });
  },

  /**
   * Save cell value (in-memory only, no server call)
   */
  saveCell($cell, rowIndex, columnName, newValue) {
    this.data[rowIndex][columnName] = newValue;
    this.table.row(rowIndex).data(this.data[rowIndex]).draw(false);

    // Visual feedback
    $cell.addClass("cell-saved");
    setTimeout(() => $cell.removeClass("cell-saved"), 800);
  },

  /**
   * Render priority badge
   */
  renderPriorityBadge(priority) {
    if (!priority) return '<span class="badge badge-empty">--</span>';

    let badgeClass = "badge-priority-hold";
    if (priority === PRIORITY.URGENT) badgeClass = "badge-priority-urgent";
    else if (priority === PRIORITY.NEW) badgeClass = "badge-priority-new";

    return `<span class="badge ${badgeClass}">${this.escapeHtml(priority)}</span>`;
  },

  /**
   * Render status badge
   */
  renderStatusBadge(status) {
    if (!status) return '<span class="badge badge-empty">--</span>';

    const statusClasses = {
      [STATUS.WAITING]: "badge-status-waiting",
      [STATUS.IN_PROGRESS]: "badge-status-working",
      [STATUS.PLANS_SENT_FOR_REVIEW]: "badge-status-review",
      [STATUS.UPDATED_PLANS_SENT]: "badge-status-updated",
      [STATUS.PLANS_SENT_FOR_TENDER]: "badge-status-tender",
      [STATUS.PLANS_SENT_FOR_EXECUTION]: "badge-status-execution",
      [STATUS.SPECIAL]: "badge-status-special",
    };

    const badgeClass = statusClasses[status] || "badge-status-waiting";
    return `<span class="badge ${badgeClass}">${this.escapeHtml(status)}</span>`;
  },

  /**
   * Render Yes/No badge
   */
  renderYesNoBadge(value) {
    if (!value) return '<span class="badge badge-empty">--</span>';
    const badgeClass = value === YES_NO.YES ? "badge-yes" : "badge-no";
    return `<span class="badge ${badgeClass}">${this.escapeHtml(value)}</span>`;
  },

  /**
   * Render Yes/No badge with optional IsExecuted checkbox (shown only when value is כן)
   */
  renderYesNoWithExecuted(value, isExecuted) {
    const badge = this.renderYesNoBadge(value);
    if (value !== YES_NO.YES) return badge;

    const checkedAttr = isExecuted ? "checked" : "";
    const disabledAttr = Auth.isAdmin() ? "" : "disabled";
    return `<div class="yes-no-cell">
      ${badge}
      <label class="executed-label">
        <input type="checkbox" class="executed-check" ${checkedAttr} ${disabledAttr} />
        <span class="executed-text">האם בוצע</span>
      </label>
    </div>`;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Bind global events
   */
  bindEvents() {
    // Logout button
    $("#logoutBtn").on("click", () => {
      Auth.logout();
      window.location.href = "login.html";
    });

    // Admin menu button
    $("#adminMenuBtn").on("click", () => {
      $("#adminMenuModal").addClass("show");
    });

    // Add employee form submit
    $("#addEmployeeForm").on("submit", (e) => {
      e.preventDefault();
      this.addEmployee();
    });

    // Modal close
    $(".modal-close, .modal-overlay").on("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideModal();
      }
    });

    // Modal form submit
    $("#addProjectForm").on("submit", (e) => {
      e.preventDefault();
      this.addProject();
    });

    // Prevent modal content click from closing
    $(".modal").on("click", (e) => {
      e.stopPropagation();
    });

    this.bindCommentsModalFooterEvents();
  },

  /**
   * Show add project modal
   */
  async showAddModal() {
    await this.populateModalDropdowns();

    $("#addProjectForm")[0].reset();

    // Refresh custom-select triggers that may have stale values after reset
    $("#addProjectModal select[data-cs-enhanced]").each(function () {
      if (this._csRefresh) this._csRefresh();
    });

    enhanceAllSelects(document.getElementById("addProjectModal"));

    $("#addProjectModal").addClass("show");
  },

  /**
   * Hide modal
   */
  hideModal() {
    $(".modal-overlay").removeClass("show");
  },

  /**
   * Populate modal dropdowns with enum values
   */
  async populateModalDropdowns() {
    // Assigned to dropdown
    const $assigned = $("#newAssignedTo");
    $assigned.empty();
    $assigned.append('<option value="">-- בחר --</option>');
    const usernames = await Auth.getAllUsernames();
    usernames.forEach((name) => {
      $assigned.append(`<option value="${name}">${name}</option>`);
    });

    // Yes/No dropdowns
    ["#newChachi", "#newBezeq", "#newHot"].forEach((selector) => {
      const $select = $(selector);
      $select.empty();
      $select.append('<option value="">-- בחר --</option>');
      Object.values(YES_NO).forEach((val) => {
        $select.append(`<option value="${val}">${val}</option>`);
      });
    });
  },

  /**
   * Add new project via API
   */
  async addProject() {
    const projectNumber = $("#newProjectNumber").val().trim();
    const projectName   = $("#newProjectName").val().trim();
    const assignedTo    = $("#newAssignedTo").val();
    const chachi        = $("#newChachi").val();
    const bezeq         = $("#newBezeq").val();
    const hot           = $("#newHot").val();
    const comment       = $("#newInitialComment").val().trim();

    if (!projectNumber || !projectName) {
      Swal.fire({
        icon: "error",
        title: "שדות חסרים",
        text: "נא למלא את השדות הנדרשים: מספר פרויקט, שם הפרויקט",
        confirmButtonText: "אישור",
        customClass: { confirmButton: "swal-btn" },
      });
      return;
    }

    const payload = {
      ProjectNumber:    projectNumber,
      ProjectName:      projectName,
      Priority:         PRIORITY.NEW,
      AssignedTo:       assignedTo || null,
      Status:           STATUS.WAITING,
      Chachi:           chachi === YES_NO.YES,
      ChachiIsExecuted: false,
      Bezeq:            bezeq === YES_NO.YES,
      BezeqIsExecuted:  false,
      Hot:              hot === YES_NO.YES,
      HotIsExecuted:    false,
      InitialComment:   comment || null,
      UserId:           this.currentUser.userId,
      UserName:         this.currentUser.username,
      UserRole:         this.currentUser.role,
    };

    startLoader("שומר פרויקט...");
    try {
      await ApiClient.createProject(payload);
      stopLoader();
      this.hideModal();
      await this.loadData();
      this.showToast("הפרויקט נוסף בהצלחה");
    } catch (err) {
      stopLoader();
      const msg = err.responseJSON?.message || "שגיאה בהוספת הפרויקט";
      Swal.fire({
        icon: "error",
        title: "שגיאה",
        text: msg,
        confirmButtonText: "אישור",
      });
    }
  },

  /**
   * Add new employee via API
   */
  addEmployee() {
    const userData = {
      userName: $("#newEmpUserName").val().trim(),
      email: $("#newEmpEmail").val().trim(),
      password: $("#newEmpPassword").val(),
      permissions: $("#newEmpPermissions").val(),
      Role: $("#newEmpRole").val(),
    };

    startLoader("מוסיף עובד...");
    ApiClient.signup(userData)
      .done(() => {
        stopLoader();
        $("#addEmployeeModal").removeClass("show");
        $("#addEmployeeForm")[0].reset();
        this.showToast("העובד נוסף בהצלחה");
      })
      .fail((err) => {
        stopLoader();
        const msg = err.responseJSON?.message || "שגיאה בהוספת העובד";
        Swal.fire({
          icon: "error",
          title: "שגיאה",
          text: msg,
          confirmButtonText: "אישור",
        });
      });
  },

  /**
   * Confirm delete project
   */
  confirmDelete(rowIndex) {
    const project = this.data[rowIndex];
    $("#deleteProjectName").text(project.ProjectName);
    $("#confirmDeleteBtn").data("row", rowIndex);
    $("#deleteConfirmModal").addClass("show");

    $("#confirmDeleteBtn")
      .off("click")
      .on("click", () => {
        this.deleteProject(rowIndex);
      });

    $("#cancelDeleteBtn")
      .off("click")
      .on("click", () => {
        this.hideModal();
      });
  },

  /**
   * Delete project (in-memory only, no server endpoint yet)
   */
  deleteProject(rowIndex) {
    this.data.splice(rowIndex, 1);

    this.table.clear().rows.add(this.data).draw();

    this.hideModal();
    this.updateProjectCount();
    this.showToast("הפרויקט נמחק בהצלחה");
  },

  // ==========================================
  // Comments Modal
  // ==========================================

  /**
   * Check if current user can edit or delete a comment
   */
  canModifyComment(comment) {
    if (Auth.isAdmin()) return true;
    return Number(comment.UserId) === Number(this.currentUser.userId);
  },

  /**
   * Format a Unix-ms timestamp to DD/MM/YYYY HH:MM
   */
  formatCommentDate(timestamp) {
    if (!timestamp) return "";
    const d = new Date(Number(timestamp));
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * Open the comments modal for a given project
   */
  openCommentsModal(projectId, projectName) {
    this._currentCommentsProjectId = projectId;
    $("#commentsModalTitle").text(projectName || "הערות פרויקט");
    $("#commentsModalSubtitle").text("");
    // Reset add form
    $("#addCommentForm").addClass("hidden");
    $("#newCommentText").val("");
    $("#toggleAddCommentBtn").text("+ הוסף הערה");
    $("#commentsModal").addClass("show");
    this.loadComments(projectId);
  },

  /**
   * Fetch all comments for the given project and render them
   */
  loadComments(projectId) {
    startLoader("טוען הערות...");
    ApiClient.getCommentsByProjectId(projectId)
      .done((comments) => {
        this.renderComments(comments);
      })
      .fail(() => {
        this.showToast("שגיאה בטעינת הערות");
        $("#commentsModalBody").html('<p class="comments-empty">לא ניתן לטעון הערות</p>');
      })
      .always(() => {
        stopLoader();
      });
  },

  /**
   * Build and inject comment cards into the modal body
   */
  renderComments(comments) {
    const $body = $("#commentsModalBody");
    const count = comments.length;
    $("#commentsModalSubtitle").text(count === 0 ? "אין הערות" : `${count} הערות`);

    if (count === 0) {
      $body.html('<p class="comments-empty">אין הערות לפרויקט זה עדיין</p>');
      return;
    }

    const html = comments.map((c) => {
      const isAdmin = c.UserRole === "admin";
      const authorName = isAdmin ? "מנהל מערכת" : this.escapeHtml(c.UserName || "");
      const timeStr = this.formatCommentDate(c.CreatedAt);
      const canModify = this.canModifyComment(c);
      const actionButtons = canModify
        ? `<div class="comment-actions">
            <button class="btn-icon edit-comment-btn" data-comment-id="${c.CommentId}" title="ערוך">✎</button>
            <button class="btn-icon delete-comment-btn" data-comment-id="${c.CommentId}" title="מחק">🗑</button>
          </div>`
        : "";

      return `<div class="comment-card" data-comment-id="${c.CommentId}" data-user-id="${c.UserId}">
        <div class="comment-header">
          <div class="comment-meta">
            <span class="comment-author-name">${authorName}</span>
            <span class="comment-time">${timeStr}</span>
          </div>
          ${actionButtons}
        </div>
        <div class="comment-body">
          <p class="comment-text">${this.escapeHtml(c.CommentText)}</p>
          <textarea class="comment-edit-textarea hidden">${this.escapeHtml(c.CommentText)}</textarea>
          <div class="comment-edit-actions hidden">
            <button class="save-edit-btn btn btn-subtle-success" data-comment-id="${c.CommentId}">שמור</button>
            <button class="cancel-edit-btn btn btn-subtle-danger">ביטול</button>
          </div>
          <div class="comment-delete-confirm hidden">
            <span>האם למחוק הערה זו?</span>
            <button class="confirm-delete-btn btn btn-subtle-danger" data-comment-id="${c.CommentId}">מחק</button>
            <button class="cancel-delete-btn btn btn-outline">ביטול</button>
          </div>
        </div>
      </div>`;
    }).join("");

    $body.html(html);
    this.bindCommentCardEvents();
  },

  /**
   * Bind inline edit / delete interactions on comment cards
   */
  bindCommentCardEvents() {
    const $body = $("#commentsModalBody");
    // Unbind before rebinding to avoid duplicate handlers
    $body.off("click");

    // Show inline edit form
    $body.on("click", ".edit-comment-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-text").addClass("hidden");
      $card.find(".comment-edit-textarea").removeClass("hidden").focus();
      $card.find(".comment-edit-actions").removeClass("hidden");
      $card.find(".comment-actions").addClass("hidden");
      $card.find(".comment-delete-confirm").addClass("hidden");
    });

    // Cancel edit
    $body.on("click", ".cancel-edit-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-text").removeClass("hidden");
      $card.find(".comment-edit-textarea").addClass("hidden");
      $card.find(".comment-edit-actions").addClass("hidden");
      $card.find(".comment-actions").removeClass("hidden");
    });

    // Save edit
    $body.on("click", ".save-edit-btn", (e) => {
      const $btn = $(e.currentTarget);
      const commentId = $btn.data("comment-id");
      const $card = $btn.closest(".comment-card");
      const newText = $card.find(".comment-edit-textarea").val().trim();
      if (!newText) return;

      startLoader("שומר...");
      ApiClient.editComment({ commentId, commentText: newText })
        .done(() => {
          stopLoader();
          this.showToast("ההערה עודכנה");
          this.loadComments(this._currentCommentsProjectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה בעדכון ההערה");
        });
    });

    // Show delete confirm
    $body.on("click", ".delete-comment-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-delete-confirm").removeClass("hidden");
      $card.find(".comment-actions").addClass("hidden");
      $card.find(".comment-text").addClass("hidden");
    });

    // Cancel delete
    $body.on("click", ".cancel-delete-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-delete-confirm").addClass("hidden");
      $card.find(".comment-actions").removeClass("hidden");
      $card.find(".comment-text").removeClass("hidden");
    });

    // Confirm delete
    $body.on("click", ".confirm-delete-btn", (e) => {
      const commentId = $(e.currentTarget).data("comment-id");
      startLoader("מוחק...");
      ApiClient.deleteComment(commentId)
        .done(() => {
          stopLoader();
          this.showToast("ההערה נמחקה");
          this.loadComments(this._currentCommentsProjectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה במחיקת ההערה");
        });
    });
  },

  /**
   * Bind add-comment form events in the modal footer (called once from bindEvents)
   */
  bindCommentsModalFooterEvents() {
    $("#toggleAddCommentBtn").on("click", () => {
      const $form = $("#addCommentForm");
      if ($form.hasClass("hidden")) {
        $form.removeClass("hidden");
        $("#newCommentText").focus();
        $("#toggleAddCommentBtn").text("✕ סגור");
      } else {
        $form.addClass("hidden");
        $("#newCommentText").val("");
        $("#toggleAddCommentBtn").text("+ הוסף הערה");
      }
    });

    $("#cancelCommentBtn").on("click", () => {
      $("#addCommentForm").addClass("hidden");
      $("#newCommentText").val("");
      $("#toggleAddCommentBtn").text("+ הוסף הערה");
    });

    $("#submitCommentBtn").on("click", () => {
      const text = $("#newCommentText").val().trim();
      if (!text) return;
      const projectId = this._currentCommentsProjectId;
      const user = Auth.getCurrentUser();

      startLoader("מוסיף הערה...");
      ApiClient.addComment({
        projectId,
        commentText: text,
        userId: user.userId,
        userName: user.username,
        userRole: user.role,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה נוספה");
          $("#addCommentForm").addClass("hidden");
          $("#newCommentText").val("");
          $("#toggleAddCommentBtn").text("+ הוסף הערה");
          this.loadComments(projectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה בהוספת ההערה");
        });
    });
  },

  /**
   * Show toast message
   */
  showToast(message) {
    const Toast = Swal.mixin({
      toast: true,
      position: "bottom",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      },
    });
    Toast.fire({
      icon: "success",
      title: message,
    });
  },
};

// Initialize app when DOM is ready
$(document).ready(() => App.init());
