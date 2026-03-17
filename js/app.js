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
  {
    label: "ניהול משתמשים",
    action: () => {
      window.location.href = "users.html";
    },
  },
];

// Application State
const App = {
  table: null,
  data: [],
  currentUser: null,
  _currentCommentsProjectId: null,
  _currentPriceOfferCommentsProjectId: null,
  _cachedUserNames: [],
  showingDeleted: false,
  _pollingInterval: null,

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

    window.addEventListener('beforeunload', () => this.stopPolling());
    await this.loadData();
  },

  /**
   * Fetch projects from API, transform and render table
   */
  async loadData() {
    this.stopPolling();
    startLoader("טוען פרויקטים...");
    try {
      const [projects, usernames] = await Promise.all([
        ApiClient.getAllProjects(this.showingDeleted ? { isDeleted: true } : {}),
        ApiClient.getUserNames().catch(() => []),
      ]);
      this._cachedUserNames = usernames;
      this.data = this.transformProjects(projects);

      // Destroy existing table before re-initialising (e.g. after create)
      if (this.table) {
        this.table.destroy();
        this.table = null;
        $("#projectsTable").empty();
      }

      this.initDataTable();
      this.updateProjectCount();
      this.startPolling();
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
      .map((p) => ({
        ProjectId: p.ProjectId,
        IsDeleted: !!p.IsDeleted,
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
        PriceOfferStatus: p.PriceOfferStatus || PRICE_OFFER_STATUS.WAITING,
        LastPriceOfferCommentText:      p.LastPriceOfferCommentText || "",
        LastPriceOfferCommentUserName:  p.LastPriceOfferCommentUserName || "",
        LastPriceOfferCommentUserRole:  p.LastPriceOfferCommentUserRole || "",
        LastPriceOfferCommentCreatedAt: p.LastPriceOfferCommentCreatedAt || null,
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
   * Convert internal row data back to the full API payload for /projects/update
   */
  buildProjectPayload(row) {
    return {
      ProjectId:        row.ProjectId,
      ProjectNumber:    row.ProjectNumber,
      ProjectName:      row.ProjectName,
      Priority:         row.Priority,
      AssignedTo:       row.AssignedTo || null,
      Status:           row.Status,
      Chachi:           row.Chachi === YES_NO.YES,
      ChachiIsExecuted: !!row.ChachiIsExecuted,
      Bezeq:            row.Bezeq === YES_NO.YES,
      BezeqIsExecuted:  !!row.BezeqIsExecuted,
      Hot:              row.Hot === YES_NO.YES,
      HotIsExecuted:    !!row.HotIsExecuted,
      PriceOfferStatus: row.PriceOfferStatus || PRICE_OFFER_STATUS.WAITING,
      LastUpdated:      Date.now(),
      IsDeleted:        false,
    };
  },

  /**
   * Start the 60-second background poll for project changes
   */
  startPolling() {
    this.stopPolling();
    this._pollingInterval = setInterval(() => this._pollProjects(), 45_000);
  },

  /**
   * Stop the background poll (called before full reloads and on page unload)
   */
  stopPolling() {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
  },

  /**
   * Silently fetch projects and add/remove rows if the list has changed.
   * Never shows a loader or error dialog — must not interrupt the user.
   */
  async _pollProjects() {
    try {
      const params = this.showingDeleted ? { isDeleted: true } : {};
      const rawProjects = await ApiClient.getAllProjects(params);
      const fetched = this.transformProjects(rawProjects);

      const currentIds = new Set(this.data.map(p => p.ProjectId));
      const fetchedIds  = new Set(fetched.map(p => p.ProjectId));

      const added      = fetched.filter(p => !currentIds.has(p.ProjectId));
      const removedIds = [...currentIds].filter(id => !fetchedIds.has(id));

      if (added.length === 0 && removedIds.length === 0) return;

      added.forEach(project => {
        this.data.push(project);
        this.table.row.add(project);
      });

      removedIds.forEach(id => {
        const idx = this.data.findIndex(p => p.ProjectId === id);
        if (idx !== -1) this.data.splice(idx, 1);
        this.table.rows().every(function() {
          if (this.data().ProjectId === id) this.remove();
        });
      });

      this.table.draw(false);
      this.updateProjectCount();
      this.showToast("הטבלה עודכנה אוטומטית", "info", 2000);
    } catch (_) {
      // silent — never interrupt the user on poll failure
    }
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
    if (!el) return;
    if (this.table && $("#myProjectsFilter").is(":checked")) {
      el.textContent = this.table.rows({ filter: "applied" }).count();
    } else {
      el.textContent = this.data.length;
    }
  },

  /**
   * Update UI elements based on user role
   */
  updateUIForRole() {
    const adminMenuBtn = document.getElementById("adminMenuBtn");
    if (adminMenuBtn) {
      adminMenuBtn.classList.toggle("hidden", !Auth.isAdmin());
    }
    const quickAddBtn = document.getElementById("quickAddProjectBtn");
    if (quickAddBtn) {
      quickAddBtn.classList.toggle("hidden", !Auth.isAdmin());
    }
    if (Auth.isAdmin()) {
      document.body.classList.add("is-admin");
    }
    document.getElementById("deletedProjectsFilterWrap")
      ?.classList.toggle("hidden", !Auth.isAdmin());
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
          className: "inline-text-cell",
        },
        {
          data: "ProjectName",
          title: "שם הפרויקט",
          className: "inline-text-cell",
        },
        {
          data: "Priority",
          title: "עדיפות",
          className: "inline-select-cell priority-cell",
          render: (data) => this.renderPriorityBadge(data),
        },
        {
          data: "AssignedTo",
          title: "מוקצה ל",
          className: "inline-select-cell assignedto-cell",
          render: (data) =>
            data ? `<span class="assigned-user">${this.escapeHtml(data)}</span>` : '<span class="badge badge-empty">--</span>',
        },
        {
          data: "Status",
          title: "סטטוס",
          className: "status-cell",
          render: (data) => this.renderStatusBadge(data),
        },
        {
          data: "LastCommentText",
          title: "הערות",
          render: (data, _type, row) => {
            if (!data) return `<span class="comment-cell badge badge-empty"
              data-project-id="${row.ProjectId}"
              data-project-name="${this.escapeHtml(row.ProjectName)}"
              >--</span>`;
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
          className: "editable-cell centered-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.ChachiIsExecuted, row),
        },
        {
          data: "Bezeq",
          title: "בזק",
          className: "editable-cell centered-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.BezeqIsExecuted, row),
        },
        {
          data: "Hot",
          title: "הוט",
          className: "editable-cell centered-cell",
          render: (data, _type, row) =>
            this.renderYesNoWithExecuted(data, row.HotIsExecuted, row),
        },
        {
          data: "PriceOfferStatus",
          title: "סטטוס הצעת מחיר",
          className: "price-offer-status-cell centered-cell",
          orderable: false,
          searchable: false,
          visible: Auth.isAdmin(),
          render: (data) => {
            const val = data || PRICE_OFFER_STATUS.WAITING;
            const cls = PRICE_OFFER_STATUS_BADGE_MAP[val] ?? "badge-default";
            return `<span class="badge ${cls}">${val}</span>`;
          },
        },
        {
          data: "LastPriceOfferCommentText",
          title: "הערות הצעת מחיר",
          orderable: false,
          searchable: false,
          visible: Auth.isAdmin(),
          render: (data, _type, row) => {
            if (!data) return `<span class="po-comment-cell badge badge-empty"
              data-project-id="${row.ProjectId}"
              data-project-name="${self.escapeHtml(row.ProjectName)}"
              >--</span>`;
            const isAdmin = row.LastPriceOfferCommentUserRole === "admin";
            const displayName = isAdmin ? "מנהל מערכת" : self.escapeHtml(row.LastPriceOfferCommentUserName || "");
            const truncated = data.length > 45 ? data.substring(0, 45) + "..." : data;
            return `<span class="po-comment-cell"
              data-project-id="${row.ProjectId}"
              data-project-name="${self.escapeHtml(row.ProjectName)}"
              ><strong class="comment-author">${displayName}:</strong> ${self.escapeHtml(truncated)}</span>`;
          },
        },
        {
          data: null,
          title: "פעולות",
          orderable: false,
          searchable: false,
          className: "text-center",
          render: (_data, _type, _row, meta) => {
            if (!Auth.isAdmin()) return "";
            if (self.showingDeleted) {
              return `
                <div class="action-buttons">
                  <button class="btn btn-subtle-success btn-icon btn-sm restore-btn"
                          data-row="${meta.row}"
                          title="שחזר פרויקט">
                    ↩
                  </button>
                </div>
              `;
            }
            return `
              <div class="action-buttons">
                <button class="btn btn-subtle-primary btn-icon btn-sm edit-btn"
                        data-row="${meta.row}"
                        title="ערוך פרויקט">
                  ✎
                </button>
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

    // Register custom search for "my projects" filter
    $.fn.dataTable.ext.search.push((settings, _data, _dataIndex, rowData) => {
      if (settings.nTable.id !== "projectsTable") return true;
      if (!$("#myProjectsFilter").is(":checked")) return true;
      return rowData.AssignedTo === self.currentUser.username;
    });

    // Handle cell click for YES/NO inline editing (admin only — Chachi/Bezeq/Hot columns)
    $("#projectsTable tbody").on("click", "td.editable-cell", function (e) {
      if (self.showingDeleted) return;
      // Don't open select when clicking on the checkbox itself
      if ($(e.target).hasClass("executed-check")) return;
      self.handleCellClick(this);
    });

    // Handle cell click for Status inline editing (admin or own-project employee)
    $("#projectsTable tbody").on("click", "td.status-cell", function () {
      if (self.showingDeleted) return;
      self.handleStatusCellClick(this);
    });

    // Admin inline text editing (ProjectNumber, ProjectName)
    $("#projectsTable tbody").on("click", "td.inline-text-cell", function () {
      if (self.showingDeleted) return;
      self.handleTextCellClick(this);
    });

    // Admin inline select for Priority
    $("#projectsTable tbody").on("click", "td.priority-cell", function () {
      if (self.showingDeleted) return;
      self.handleInlineSelectCellClick(this, "Priority", Object.values(PRIORITY));
    });

    // Admin inline select for AssignedTo
    $("#projectsTable tbody").on("click", "td.assignedto-cell", function () {
      if (self.showingDeleted) return;
      self.handleInlineSelectCellClick(this, "AssignedTo", [""].concat(self._cachedUserNames));
    });

    // Admin inline select for PriceOfferStatus
    $("#projectsTable tbody").on("click", "td.price-offer-status-cell", function () {
      if (self.showingDeleted) return;
      if (!Auth.isAdmin()) return;
      self.handleInlineSelectCellClick(this, "PriceOfferStatus", Object.values(PRICE_OFFER_STATUS));
    });

    // Handle restore button click (admin, deleted-projects mode only)
    $("#projectsTable tbody").on("click", ".restore-btn", function (e) {
      e.stopPropagation();
      const rowIndex = parseInt($(this).data("row"));
      self.confirmRestore(rowIndex);
    });

    // Handle IsExecuted checkbox change
    // Allowed for: admin (any project), regular user (own projects only)
    $("#projectsTable tbody").on("change", ".executed-check", function () {
      const $cell = $(this).closest("td");
      const row = self.table.row($cell.parent());
      const rowIndex = row.index();
      const rowData = self.data[rowIndex];

      // Permission check
      if (!Auth.isAdmin() && rowData.AssignedTo !== self.currentUser.username) {
        this.checked = !this.checked; // revert
        self.showLockedMessage();
        return;
      }

      const colIndex = $cell.index();
      const columns = self.table.settings().init().columns;
      const columnName = columns[colIndex].data; // "Chachi", "Bezeq", or "Hot"
      const executedField = columnName + "IsExecuted";
      rowData[executedField] = this.checked;

      // Persist to server
      ApiClient.updateProject(self.buildProjectPayload(rowData))
        .done(() => {
          $cell.addClass("cell-saved");
          setTimeout(() => $cell.removeClass("cell-saved"), 800);
          self.showToast("הנתונים נשמרו בהצלחה", "success", 1500);
        })
        .fail(() => {
          // Revert on failure
          rowData[executedField] = !this.checked;
          self.table.row(rowIndex).data(rowData).draw(false);
          self.showToast("שגיאה בשמירת הנתונים", "error");
        });

      // Redraw cell without full table redraw
      self.table.row(rowIndex).data(rowData).draw(false);
    });

    // Handle edit button click (admin only)
    $("#projectsTable tbody").on("click", ".edit-btn", function (e) {
      e.stopPropagation();
      const rowIndex = $(this).data("row");
      self.showEditModal(rowIndex);
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

    // Handle price offer comment cell click — open price offer comments modal (admin only)
    $("#projectsTable tbody").on("click", ".po-comment-cell", function (e) {
      e.stopPropagation();
      const $el = $(this);
      self.openPriceOfferCommentsModal($el.data("project-id"), $el.data("project-name"));
    });
  },

  /**
   * Handle cell click for inline editing (admin only — Chachi/Bezeq/Hot)
   */
  handleCellClick(cell) {
    // YES/NO inline editing is admin-only
    if (!Auth.isAdmin()) {
      this.showLockedMessage();
      return;
    }

    const $cell = $(cell);
    const columnIndex = $cell.index();
    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];
    const columns = this.table.settings().init().columns;
    const columnName = columns[columnIndex].data;

    // Only allow editing Chachi / Bezeq / Hot
    if (!["Chachi", "Bezeq", "Hot"].includes(columnName)) return;

    // Skip if already editing (check for the custom-select trigger, not checkbox inputs)
    if ($cell.find(".edit-select, .cs-trigger").length > 0) return;

    const currentValue = rowData[columnName] || "";
    this.createEditControl($cell, rowIndex, columnName, currentValue, Object.values(YES_NO));
  },

  /**
   * Handle Status cell click — admin or employee on own project
   */
  handleStatusCellClick(cell) {
    const $cell = $(cell);
    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];

    const isOwnProject = rowData.AssignedTo === this.currentUser.username;
    if (!Auth.isAdmin() && !isOwnProject) {
      this.showLockedMessage();
      return;
    }

    // Skip if already editing
    if ($cell.find(".edit-select, .cs-trigger").length > 0) return;

    const currentValue = rowData.Status || "";
    this.createEditControl($cell, rowIndex, "Status", currentValue, Object.values(STATUS));
  },

  /**
   * Handle inline text edit for ProjectNumber / ProjectName (admin only)
   */
  handleTextCellClick(cell) {
    if (!Auth.isAdmin()) return;
    const $cell = $(cell);
    if ($cell.find(".edit-text-input").length > 0) return;

    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];
    const colIndex = $cell.index();
    const columnName = this.table.settings().init().columns[colIndex].data;
    const currentValue = rowData[columnName] || "";

    const $input = $('<input type="text" class="edit-text-input">').val(currentValue);
    $cell.html($input);
    $input.focus().select();

    let saved = false;

    const save = async () => {
      if (saved) return;
      saved = true;

      const newValue = $input.val().trim();
      if (!newValue || newValue === currentValue) {
        this.table.row(rowIndex).data(rowData).draw(false);
        return;
      }

      if (columnName === "ProjectNumber" || columnName === "ProjectName") {
        const fieldName = columnName === "ProjectNumber" ? "מספר הפרויקט" : "שם הפרויקט";
        const result = await Swal.fire({
          icon: "warning",
          title: "שינוי שדה קריטי",
          html: `האם אתה בטוח שברצונך לשנות את <strong>${fieldName}</strong>?<br>שינוי זה ישפיע על זיהוי הפרויקט במערכת.`,
          confirmButtonText: "כן, שנה",
          showCancelButton: true,
          cancelButtonText: "ביטול",
          confirmButtonColor: "#e74c3c",
        });
        if (!result.isConfirmed) {
          this.table.row(rowIndex).data(rowData).draw(false);
          return;
        }
      }

      this.saveCell($cell, rowIndex, columnName, newValue);
    };

    $input.on("blur", save);
    $input.on("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $input.trigger("blur"); }
      if (e.key === "Escape") { saved = true; this.table.row(rowIndex).data(rowData).draw(false); }
    });
  },

  /**
   * Handle inline select edit for Priority / AssignedTo (admin only)
   */
  handleInlineSelectCellClick(cell, columnName, options) {
    if (!Auth.isAdmin()) return;
    const $cell = $(cell);
    if ($cell.find(".edit-select, .cs-trigger").length > 0) return;

    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];
    const currentValue = rowData[columnName] || "";

    this.createEditControl($cell, rowIndex, columnName, currentValue, options);
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
   * Create inline select edit control
   */
  createEditControl($cell, rowIndex, columnName, currentValue, options = Object.values(YES_NO)) {
    const inputHtml = this.createSelect(currentValue, options);
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
   * Save cell value and persist to server
   */
  saveCell($cell, rowIndex, columnName, newValue) {
    const oldValue = this.data[rowIndex][columnName];
    this.data[rowIndex][columnName] = newValue;
    this.table.row(rowIndex).data(this.data[rowIndex]).draw(false);

    // Persist to server
    ApiClient.updateProject(this.buildProjectPayload(this.data[rowIndex]))
      .done(() => {
        $cell.addClass("cell-saved");
        setTimeout(() => $cell.removeClass("cell-saved"), 800);
        this.showToast("הנתונים נשמרו בהצלחה", "success", 1500);
      })
      .fail(() => {
        // Revert on failure
        this.data[rowIndex][columnName] = oldValue;
        this.table.row(rowIndex).data(this.data[rowIndex]).draw(false);
        this.showToast("שגיאה בשמירת הנתונים", "error");
      });
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
   * Render Yes/No badge with optional IsExecuted checkbox
   * IsExecuted checkbox: enabled for admin (any project) and regular user on own project
   */
  renderYesNoWithExecuted(value, isExecuted, row) {
    const badge = this.renderYesNoBadge(value);
    if (value !== YES_NO.YES) return badge;

    const checkedAttr = isExecuted ? "checked" : "";
    const isOwnProject = row && row.AssignedTo === this.currentUser.username;
    const disabledAttr = (Auth.isAdmin() || isOwnProject) ? "" : "disabled";
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

    // Quick add project button (shortcut — admin only)
    $("#quickAddProjectBtn").on("click", () => {
      App.showAddModal();
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

    // Edit project form submit
    $("#editProjectForm").on("submit", (e) => {
      e.preventDefault();
      this.saveEditProject();
    });

    // Prevent modal content click from closing
    $(".modal").on("click", (e) => {
      e.stopPropagation();
    });

    // My projects filter checkbox
    $("#myProjectsFilter").on("change", () => {
      if (this.table) {
        this.table.draw();
        this.updateProjectCount();
      }
    });

    // Deleted projects toggle (admin only)
    $("#deletedProjectsFilter").on("change", () => {
      this.showingDeleted = $("#deletedProjectsFilter").is(":checked");
      $("#projectsTable").toggleClass("deleted-mode", this.showingDeleted);
      this.loadData();
    });

    this.bindCommentsModalFooterEvents();
    this.bindPriceOfferCommentsModalFooterEvents();
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
   * Show edit project modal (admin only)
   */
  async showEditModal(rowIndex) {
    const row = this.data[rowIndex];
    $("#editProjectModal").data("row-index", rowIndex);

    // Populate dropdowns first
    await this.populateEditModalDropdowns();

    // Fill fields
    $("#editProjectNumber").val(row.ProjectNumber);
    $("#editProjectName").val(row.ProjectName);
    $("#editAssignedTo").val(row.AssignedTo || "");
    $("#editStatus").val(row.Status || "");
    $("#editPriority").val(row.Priority || "");
    $("#editChachi").val(row.Chachi || YES_NO.NO);
    $("#editChachiIsExecuted").prop("checked", !!row.ChachiIsExecuted);
    $("#editBezeq").val(row.Bezeq || YES_NO.NO);
    $("#editBezeqIsExecuted").prop("checked", !!row.BezeqIsExecuted);
    $("#editHot").val(row.Hot || YES_NO.NO);
    $("#editHotIsExecuted").prop("checked", !!row.HotIsExecuted);
    $("#editPriceOfferStatus").val(row.PriceOfferStatus || PRICE_OFFER_STATUS.WAITING);

    // Refresh custom-select UI after setting values
    $("#editProjectModal select[data-cs-enhanced]").each(function () {
      if (this._csRefresh) this._csRefresh();
    });
    enhanceAllSelects(document.getElementById("editProjectModal"));

    $("#editProjectModal").addClass("show");
  },

  /**
   * Populate edit modal dropdowns
   */
  async populateEditModalDropdowns() {
    // AssignedTo dropdown
    const $assigned = $("#editAssignedTo");
    $assigned.empty().append('<option value="">-- בחר --</option>');
    this._cachedUserNames.forEach((name) => {
      $assigned.append(`<option value="${name}">${name}</option>`);
    });

    // Status dropdown
    const $status = $("#editStatus");
    $status.empty();
    Object.values(STATUS).forEach((val) => {
      $status.append(`<option value="${val}">${val}</option>`);
    });

    // Priority dropdown
    const $priority = $("#editPriority");
    $priority.empty();
    Object.values(PRIORITY).forEach((val) => {
      $priority.append(`<option value="${val}">${val}</option>`);
    });

    // Chachi/Bezeq/Hot dropdowns
    ["#editChachi", "#editBezeq", "#editHot"].forEach((selector) => {
      const $select = $(selector);
      $select.empty();
      Object.values(YES_NO).forEach((val) => {
        $select.append(`<option value="${val}">${val}</option>`);
      });
    });

    // PriceOfferStatus dropdown
    const $poStatus = $("#editPriceOfferStatus");
    $poStatus.empty();
    Object.values(PRICE_OFFER_STATUS).forEach((val) => {
      $poStatus.append(`<option value="${val}">${val}</option>`);
    });
  },

  /**
   * Save edited project via API
   */
  async saveEditProject() {
    const rowIndex = $("#editProjectModal").data("row-index");
    const row = this.data[rowIndex];

    const updated = {
      ...row,
      ProjectNumber:    $("#editProjectNumber").val().trim(),
      ProjectName:      $("#editProjectName").val().trim(),
      AssignedTo:       $("#editAssignedTo").val() || null,
      Status:           $("#editStatus").val(),
      Priority:         $("#editPriority").val(),
      Chachi:           $("#editChachi").val(),
      ChachiIsExecuted: $("#editChachiIsExecuted").is(":checked"),
      Bezeq:            $("#editBezeq").val(),
      BezeqIsExecuted:  $("#editBezeqIsExecuted").is(":checked"),
      Hot:              $("#editHot").val(),
      HotIsExecuted:    $("#editHotIsExecuted").is(":checked"),
      PriceOfferStatus: $("#editPriceOfferStatus").val() || PRICE_OFFER_STATUS.WAITING,
    };

    if (!updated.ProjectNumber || !updated.ProjectName) {
      Swal.fire({
        icon: "error",
        title: "שדות חסרים",
        text: "נא למלא את שדות מספר פרויקט ושם הפרויקט",
        confirmButtonText: "אישור",
        customClass: { confirmButton: "swal-btn" },
      });
      return;
    }

    startLoader("שומר שינויים...");
    try {
      await ApiClient.updateProject(this.buildProjectPayload(updated));
      // Update local data
      this.data[rowIndex] = updated;
      this.hideModal();
      await this.loadData();
      this.showToast("הפרויקט עודכן בהצלחה");
    } catch (err) {
      const msg = err.responseJSON?.message || "שגיאה בעדכון הפרויקט";
      Swal.fire({
        icon: "error",
        title: "שגיאה",
        text: msg,
        confirmButtonText: "אישור",
      });
    } finally {
      stopLoader();
    }
  },

  /**
   * Hide modal
   */
  hideModal() {
    $(".modal-overlay").removeClass("show");
  },

  /**
   * Populate modal dropdowns with enum values (for add project modal)
   */
  async populateModalDropdowns() {
    // Assigned to dropdown
    const $assigned = $("#newAssignedTo");
    $assigned.empty();
    $assigned.append('<option value="">-- בחר --</option>');
    this._cachedUserNames.forEach((name) => {
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

    // PriceOfferStatus dropdown
    const $newPoStatus = $("#newPriceOfferStatus");
    $newPoStatus.empty();
    Object.values(PRICE_OFFER_STATUS).forEach((val) => {
      $newPoStatus.append(`<option value="${val}">${val}</option>`);
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

    if (!assignedTo) {
      const result = await Swal.fire({
        icon: "warning",
        title: "לא נבחר עובד",
        text: "לא נבחר עובד לשיוך הפרויקט. האם ברצונך להמשיך בכל זאת?",
        confirmButtonText: "המשך",
        showCancelButton: true,
        cancelButtonText: "חזור",
        customClass: { confirmButton: "swal-btn" },
      });
      if (!result.isConfirmed) return;
    }

    const payload = {
      ProjectNumber:    projectNumber,
      ProjectName:      projectName,
      Priority:         PRIORITY.NEW,
      AssignedTo:       assignedTo || null,
      Status:           STATUS.WAITING,
      PriceOfferStatus: $("#newPriceOfferStatus").val() || PRICE_OFFER_STATUS.WAITING,
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
      .done((res) => {
        stopLoader();
        if (res.user && res.user.Message === "EMAIL_ALREADY_EXISTS") {
          Swal.fire({
            icon: "warning",
            title: "אימייל קיים",
            text: "כתובת האימייל כבר רשומה במערכת",
            confirmButtonText: "אישור",
          });
          return;
        }
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
   * Confirm restore project (shows modal, asks for reason)
   */
  confirmRestore(rowIndex) {
    const project = this.data[rowIndex];
    $("#restoreProjectName").text(project.ProjectName);
    $("#restoreReasonText").val("");
    $("#restoreConfirmModal").addClass("show");

    $("#confirmRestoreBtn")
      .off("click")
      .on("click", () => {
        const reason = $("#restoreReasonText").val().trim();
        this.hideModal();
        this.restoreProject(rowIndex, reason);
      });

    $("#cancelRestoreBtn")
      .off("click")
      .on("click", () => {
        this.hideModal();
      });
  },

  /**
   * Restore project via API (IsDeleted: false), adds reason as comment
   */
  async restoreProject(rowIndex, reason) {
    const row = this.data[rowIndex];

    if (!reason) {
      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      reason = `פרויקט זה שוחזר על ידי מנהל המערכת בתאריך ${dateStr}`;
    }

    const payload = { ...this.buildProjectPayload(row), IsDeleted: false };

    startLoader("משחזר פרויקט...");
    try {
      await ApiClient.addComment({
        ProjectId:   row.ProjectId,
        CommentText: reason,
        UserId:      Auth.getCurrentUser().userId,
      });
      await ApiClient.updateProject(payload);
      stopLoader();
      this.showToast("הפרויקט שוחזר בהצלחה");
      await this.loadData();
    } catch (err) {
      stopLoader();
      const msg = err.responseJSON?.message || "שגיאה בשחזור הפרויקט";
      Swal.fire({ icon: "error", title: "שגיאה", text: msg, confirmButtonText: "אישור" });
    }
  },

  /**
   * Confirm delete project
   */
  confirmDelete(rowIndex) {
    const project = this.data[rowIndex];
    $("#deleteProjectName").text(project.ProjectName);
    $("#deleteReasonText").val("").removeClass("input-error");
    $("#deleteConfirmModal").addClass("show");

    $("#confirmDeleteBtn")
      .off("click")
      .on("click", () => {
        const reason = $("#deleteReasonText").val().trim();
        if (!reason) {
          $("#deleteReasonText").addClass("input-error");
          return;
        }
        this.hideModal();
        this.deleteProject(rowIndex, reason);
      });

    $("#cancelDeleteBtn")
      .off("click")
      .on("click", () => {
        this.hideModal();
      });
  },

  /**
   * Soft-delete project via API (IsDeleted: true)
   */
  async deleteProject(rowIndex, reason) {
    const row = this.data[rowIndex];
    const payload = { ...this.buildProjectPayload(row), IsDeleted: true };

    startLoader("מוחק פרויקט...");
    try {
      await ApiClient.addComment({
        ProjectId:   row.ProjectId,
        CommentText: reason,
        UserId:      Auth.getCurrentUser().userId,
      });
      await ApiClient.updateProject(payload);
      stopLoader();
      this.data.splice(rowIndex, 1);
      this.table.clear().rows.add(this.data).draw();
      this.hideModal();
      this.updateProjectCount();
      this.showToast("הפרויקט נמחק בהצלחה");
    } catch (err) {
      stopLoader();
      const msg = err.responseJSON?.message || "שגיאה במחיקת הפרויקט";
      Swal.fire({
        icon: "error",
        title: "שגיאה",
        text: msg,
        confirmButtonText: "אישור",
      });
    }
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
        // Filter out soft-deleted comments
        const active = comments.filter((c) => !c.IsDeleted);
        this.renderComments(active);
      })
      .fail(() => {
        this.showToast("שגיאה בטעינת הערות", "error");
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

      const safeText = this.escapeHtml(c.CommentText);

      return `<div class="comment-card"
          data-comment-id="${c.CommentId}"
          data-user-id="${c.UserId}"
          data-comment-text="${safeText}">
        <div class="comment-header">
          <div class="comment-meta">
            <span class="comment-author-name">${authorName}</span>
            <span class="comment-time">${timeStr}</span>
          </div>
          ${actionButtons}
        </div>
        <div class="comment-body">
          <p class="comment-text">${safeText}</p>
          <textarea class="comment-edit-textarea hidden">${safeText}</textarea>
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
      ApiClient.updateComment({
        CommentId:   commentId,
        ProjectId:   this._currentCommentsProjectId,
        CommentText: newText,
        UserId:      this.currentUser.userId,
        IsDeleted:   false,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה עודכנה");
          this.loadComments(this._currentCommentsProjectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה בעדכון ההערה", "error");
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

    // Confirm delete — soft-delete via updateComment with IsDeleted: true
    $body.on("click", ".confirm-delete-btn", (e) => {
      const $btn = $(e.currentTarget);
      const commentId = $btn.data("comment-id");
      const $card = $btn.closest(".comment-card");
      const commentText = $card.data("comment-text") || "";
      const userId = $card.data("user-id");

      startLoader("מוחק...");
      ApiClient.updateComment({
        CommentId:   commentId,
        ProjectId:   this._currentCommentsProjectId,
        CommentText: commentText,
        UserId:      userId,
        IsDeleted:   true,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה נמחקה");
          this.loadComments(this._currentCommentsProjectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה במחיקת ההערה", "error");
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
        ProjectId:   projectId,
        CommentText: text,
        UserId:      user.userId,
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
          this.showToast(err.responseJSON?.message || "שגיאה בהוספת ההערה", "error");
        });
    });
  },

  // ─── Price Offer Comments Modal ───────────────────────────────────────────

  /**
   * Open the price offer comments modal for a given project (admin only)
   */
  openPriceOfferCommentsModal(projectId, projectName) {
    this._currentPriceOfferCommentsProjectId = projectId;
    $("#poCommentsModalTitle").text(projectName || "הערות הצעת מחיר");
    $("#poCommentsModalSubtitle").text("");
    // Reset add form
    $("#addPoCommentForm").addClass("hidden");
    $("#newPoCommentText").val("");
    $("#toggleAddPoCommentBtn").text("+ הוסף הערה");
    $("#priceOfferCommentsModal").addClass("show");
    this.loadPriceOfferComments(projectId);
  },

  /**
   * Fetch all price offer comments for the given project and render them
   */
  loadPriceOfferComments(projectId) {
    startLoader("טוען הערות...");
    ApiClient.getPriceOfferCommentsByProjectId(projectId)
      .done((comments) => {
        const active = comments.filter((c) => !c.IsDeleted);
        this.renderPriceOfferComments(active);
      })
      .fail(() => {
        this.showToast("שגיאה בטעינת הערות", "error");
        $("#poCommentsModalBody").html('<p class="comments-empty">לא ניתן לטעון הערות</p>');
      })
      .always(() => {
        stopLoader();
      });
  },

  /**
   * Build and inject price offer comment cards into the modal body
   */
  renderPriceOfferComments(comments) {
    const $body = $("#poCommentsModalBody");
    const count = comments.length;
    $("#poCommentsModalSubtitle").text(count === 0 ? "אין הערות" : `${count} הערות`);

    if (count === 0) {
      $body.html('<p class="comments-empty">אין הערות לפרויקט זה עדיין</p>');
      return;
    }

    const html = comments.map((c) => {
      const isAdmin = c.UserRole === "admin";
      const authorName = isAdmin ? "מנהל מערכת" : this.escapeHtml(c.UserName || "");
      const timeStr = this.formatCommentDate(c.CreatedAt);
      // Price offer comments are admin-only — only admins can modify
      const canModify = Auth.isAdmin();
      const actionButtons = canModify
        ? `<div class="comment-actions">
            <button class="btn-icon edit-comment-btn" data-comment-id="${c.CommentId}" title="ערוך">✎</button>
            <button class="btn-icon delete-comment-btn" data-comment-id="${c.CommentId}" title="מחק">🗑</button>
          </div>`
        : "";

      const safeText = this.escapeHtml(c.CommentText);

      return `<div class="comment-card"
          data-comment-id="${c.CommentId}"
          data-user-id="${c.UserId}"
          data-comment-text="${safeText}">
        <div class="comment-header">
          <div class="comment-meta">
            <span class="comment-author-name">${authorName}</span>
            <span class="comment-time">${timeStr}</span>
          </div>
          ${actionButtons}
        </div>
        <div class="comment-body">
          <p class="comment-text">${safeText}</p>
          <textarea class="comment-edit-textarea hidden">${safeText}</textarea>
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
    this.bindPriceOfferCommentCardEvents();
  },

  /**
   * Bind inline edit / delete interactions on price offer comment cards
   */
  bindPriceOfferCommentCardEvents() {
    const $body = $("#poCommentsModalBody");
    $body.off("click");

    $body.on("click", ".edit-comment-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-text").addClass("hidden");
      $card.find(".comment-edit-textarea").removeClass("hidden").focus();
      $card.find(".comment-edit-actions").removeClass("hidden");
      $card.find(".comment-actions").addClass("hidden");
      $card.find(".comment-delete-confirm").addClass("hidden");
    });

    $body.on("click", ".cancel-edit-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-text").removeClass("hidden");
      $card.find(".comment-edit-textarea").addClass("hidden");
      $card.find(".comment-edit-actions").addClass("hidden");
      $card.find(".comment-actions").removeClass("hidden");
    });

    $body.on("click", ".save-edit-btn", (e) => {
      const $btn = $(e.currentTarget);
      const commentId = $btn.data("comment-id");
      const $card = $btn.closest(".comment-card");
      const newText = $card.find(".comment-edit-textarea").val().trim();
      if (!newText) return;

      const projectId = this._currentPriceOfferCommentsProjectId;
      const projectRow = this.data.find((p) => p.ProjectId === projectId);

      startLoader("שומר...");
      ApiClient.updatePriceOfferComment({
        CommentId:     commentId,
        ProjectId:     projectId,
        ProjectNumber: projectRow?.ProjectNumber || "",
        CommentText:   newText,
        UserId:        this.currentUser.userId,
        UserName:      this.currentUser.username,
        UserRole:      this.currentUser.role,
        IsDeleted:     false,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה עודכנה");
          this.loadPriceOfferComments(projectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה בעדכון ההערה", "error");
        });
    });

    $body.on("click", ".delete-comment-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-delete-confirm").removeClass("hidden");
      $card.find(".comment-actions").addClass("hidden");
      $card.find(".comment-text").addClass("hidden");
    });

    $body.on("click", ".cancel-delete-btn", function () {
      const $card = $(this).closest(".comment-card");
      $card.find(".comment-delete-confirm").addClass("hidden");
      $card.find(".comment-actions").removeClass("hidden");
      $card.find(".comment-text").removeClass("hidden");
    });

    $body.on("click", ".confirm-delete-btn", (e) => {
      const $btn = $(e.currentTarget);
      const commentId = $btn.data("comment-id");
      const $card = $btn.closest(".comment-card");
      const commentText = $card.data("comment-text") || "";
      const userId = $card.data("user-id");

      const projectId = this._currentPriceOfferCommentsProjectId;
      const projectRow = this.data.find((p) => p.ProjectId === projectId);

      startLoader("מוחק...");
      ApiClient.updatePriceOfferComment({
        CommentId:     commentId,
        ProjectId:     projectId,
        ProjectNumber: projectRow?.ProjectNumber || "",
        CommentText:   commentText,
        UserId:        userId,
        UserName:      this.currentUser.username,
        UserRole:      this.currentUser.role,
        IsDeleted:     true,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה נמחקה");
          this.loadPriceOfferComments(projectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה במחיקת ההערה", "error");
        });
    });
  },

  /**
   * Bind add-comment form events in the price offer comments modal footer
   */
  bindPriceOfferCommentsModalFooterEvents() {
    $("#toggleAddPoCommentBtn").on("click", () => {
      const $form = $("#addPoCommentForm");
      if ($form.hasClass("hidden")) {
        $form.removeClass("hidden");
        $("#newPoCommentText").focus();
        $("#toggleAddPoCommentBtn").text("✕ סגור");
      } else {
        $form.addClass("hidden");
        $("#newPoCommentText").val("");
        $("#toggleAddPoCommentBtn").text("+ הוסף הערה");
      }
    });

    $("#cancelPoCommentBtn").on("click", () => {
      $("#addPoCommentForm").addClass("hidden");
      $("#newPoCommentText").val("");
      $("#toggleAddPoCommentBtn").text("+ הוסף הערה");
    });

    $("#submitPoCommentBtn").on("click", () => {
      const text = $("#newPoCommentText").val().trim();
      if (!text) return;
      const projectId = this._currentPriceOfferCommentsProjectId;
      const projectRow = this.data.find((p) => p.ProjectId === projectId);
      const user = Auth.getCurrentUser();

      startLoader("מוסיף הערה...");
      ApiClient.addPriceOfferComment({
        ProjectId:     projectId,
        ProjectNumber: projectRow?.ProjectNumber || "",
        CommentText:   text,
        UserId:        user.userId,
        UserName:      user.username,
        UserRole:      user.role,
      })
        .done(() => {
          stopLoader();
          this.showToast("ההערה נוספה");
          $("#addPoCommentForm").addClass("hidden");
          $("#newPoCommentText").val("");
          $("#toggleAddPoCommentBtn").text("+ הוסף הערה");
          this.loadPriceOfferComments(projectId);
          this.loadData();
        })
        .fail((err) => {
          stopLoader();
          this.showToast(err.responseJSON?.message || "שגיאה בהוספת ההערה", "error");
        });
    });
  },

  /**
   * Show toast message
   */
  showToast(message, icon = "success", timer = 3000) {
    const Toast = Swal.mixin({
      toast: true,
      position: "bottom",
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      },
    });
    Toast.fire({ icon, title: message });
  },
};

// Initialize app when DOM is ready
$(document).ready(() => App.init());
