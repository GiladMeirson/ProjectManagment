/**
 * Project Management Application
 * Main application logic with DataTable and inline editing
 */

const STORAGE_KEY = "pm_projectsData";

// Application State
const App = {
  table: null,
  data: [],
  currentUser: null,

  /**
   * Initialize the application
   */
  init() {
    // Check authentication
    if (!Auth.requireAuth()) return;

    this.currentUser = Auth.getCurrentUser();
    this.renderUserInfo();
    this.loadData();
    this.initDataTable();
    this.bindEvents();
    this.updateUIForRole();
  },

  /**
   * Load projects data from localStorage or default
   */
  loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.data = JSON.parse(stored);
      } catch {
        this.data = [...PROJECTS];
        this.saveData();
      }
    } else {
      // First time - use default data from projects.js
      this.data = [...PROJECTS];
      this.saveData();
    }
  },

  /**
   * Save data to localStorage
   */
  saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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
   * Update UI elements based on user role
   */
  updateUIForRole() {
    const addBtn = document.getElementById("addProjectBtn");
    if (addBtn) {
      addBtn.style.display = Auth.isAdmin() ? "inline-flex" : "none";
    }
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
          data: "project_number",
          title: "מספר פרויקט",
          className: "editable-cell",
        },
        {
          data: "project",
          title: "שם הפרויקט",
          className: "editable-cell",
        },
        {
          data: "priority",
          title: "עדיפות",
          className: "editable-cell",
          render: (data) => this.renderPriorityBadge(data),
        },
        {
          data: "assigned_to",
          title: "מוקצה ל",
          className: "editable-cell",
          render: (data) => `<span class="assigned-user">${data}</span>`,
        },
        {
          data: "status",
          title: "סטטוס",
          className: "editable-cell",
          render: (data) => this.renderStatusBadge(data),
        },
        {
          data: "notes",
          title: "הערות",
          className: "editable-cell",
        },
        {
          data: "idf",
          title: 'חח"י',
          className: "editable-cell",
          render: (data) => this.renderYesNoBadge(data),
        },
        {
          data: "bezeq",
          title: "בזק",
          className: "editable-cell",
          render: (data) => this.renderYesNoBadge(data),
        },
        {
          data: "hot",
          title: "הוט",
          className: "editable-cell",
          render: (data) => this.renderYesNoBadge(data),
        },
        {
          data: null,
          title: "פעולות",
          orderable: false,
          searchable: false,
          className: "text-center",
          render: (data, type, row, meta) => {
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
              body: function (data, row, column, node) {
                // Strip HTML tags for export
                const temp = document.createElement("div");
                temp.innerHTML = data;
                return temp.textContent || temp.innerText || data;
              },
            },
          },
        },
      ],
      pageLength: 25,
      order: [[0, "asc"]],
      responsive: false,
      scrollX: true,
    });

    // Handle cell click for editing
    $("#projectsTable tbody").on("click", "td.editable-cell", function () {
      self.handleCellClick(this);
    });

    // Handle delete button click
    $("#projectsTable tbody").on("click", ".delete-btn", function (e) {
      e.stopPropagation();
      const rowIndex = $(this).data("row");
      self.confirmDelete(rowIndex);
    });
  },

  /**
   * Handle cell click for inline editing
   */
  handleCellClick(cell) {
    const $cell = $(cell);
    const columnIndex = $cell.index();
    const row = this.table.row($cell.parent());
    const rowIndex = row.index();
    const rowData = this.data[rowIndex];
    const columns = this.table.settings().init().columns;
    const columnName = columns[columnIndex].data;

    // Skip if already editing
    if ($cell.find("input, select").length > 0) return;

    // Check permissions
    if (!this.canEditCell(rowData, columnName)) {
      this.showLockedMessage();
      return;
    }

    const currentValue = rowData[columnName] || "";
    this.createEditControl($cell, rowIndex, columnName, currentValue);
  },

  /**
   * Check if current user can edit a specific cell
   */
  canEditCell(rowData, columnName) {
    // Admin can edit everything
    if (Auth.isAdmin()) return true;

    // assigned_to field is locked for non-admins
    if (columnName === "assigned_to") return false;

    // Users can only edit their own projects
    return rowData.assigned_to === this.currentUser.username;
  },

  /**
   * Show message when cell is locked
   */
  showLockedMessage() {
    const msg = Auth.isAdmin() ? "" : "אין לך הרשאה לערוך שדה זה";
    if (msg) {
      Swal.fire({
        icon: "warning",
        title: "אין הרשאה",
        text: msg,
        confirmButtonText: "אישור",
        customClass: {
          confirmButton: "swal-btn",
        },
      });
    }
  },

  /**
   * Create edit control based on column type
   */
  createEditControl($cell, rowIndex, columnName, currentValue) {
    let inputHtml;

    switch (columnName) {
      case "priority":
        inputHtml = this.createSelect(currentValue, Object.values(PRIORITY));
        break;
      case "status":
        inputHtml = this.createSelect(currentValue, [
          "",
          ...Object.values(STATUS),
        ]);
        break;
      case "assigned_to":
        inputHtml = this.createSelect(currentValue, Auth.getAllUsernames());
        break;
      case "idf":
      case "bezeq":
      case "hot":
        inputHtml = this.createSelect(currentValue, [
          "",
          ...Object.values(YES_NO),
        ]);
        break;
      default:
        inputHtml = `<input type="text" class="edit-input" value="${this.escapeHtml(currentValue)}" />`;
    }

    $cell.html(inputHtml);
    const $input = $cell.find("input, select");
    $input.focus();

    if ($input.is("input")) {
      $input.select();
    }

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

    $input.on("blur", function () {
      self.saveCell($cell, rowIndex, columnName, $(this).val());
    });

    $input.on("keydown", function (e) {
      if (e.key === "Enter") {
        $(this).blur();
      } else if (e.key === "Escape") {
        // Restore original value
        self.table.cell($cell).data(originalValue).draw(false);
      }
    });
  },

  /**
   * Save cell value
   */
  saveCell($cell, rowIndex, columnName, newValue) {
    // Update data array
    this.data[rowIndex][columnName] = newValue;

    // Save to localStorage
    this.saveData();

    // Update DataTable
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

    // Add project button
    $("#addProjectBtn").on("click", () => {
      this.showAddModal();
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
  },

  /**
   * Show add project modal
   */
  showAddModal() {
    // Populate dropdowns
    this.populateModalDropdowns();

    // Reset form
    $("#addProjectForm")[0].reset();

    // Show modal
    $("#addProjectModal").addClass("show");
  },

  /**
   * Hide modal
   */
  hideModal() {
    $("#addProjectModal").removeClass("show");
    $("#deleteConfirmModal").removeClass("show");
  },

  /**
   * Populate modal dropdowns with enum values
   */
  populateModalDropdowns() {
    // Priority dropdown
    const $priority = $("#newPriority");
    $priority.empty();
    Object.values(PRIORITY).forEach((val) => {
      $priority.append(`<option value="${val}">${val}</option>`);
    });

    // Status dropdown
    const $status = $("#newStatus");
    $status.empty();
    $status.append('<option value="">-- בחר --</option>');
    Object.values(STATUS).forEach((val) => {
      $status.append(`<option value="${val}">${val}</option>`);
    });

    // Assigned to dropdown
    const $assigned = $("#newAssignedTo");
    $assigned.empty();
    Auth.getAllUsernames().forEach((name) => {
      $assigned.append(`<option value="${name}">${name}</option>`);
    });

    // Yes/No dropdowns
    ["#newIdf", "#newBezeq", "#newHot"].forEach((selector) => {
      const $select = $(selector);
      $select.empty();
      $select.append('<option value="">-- בחר --</option>');
      Object.values(YES_NO).forEach((val) => {
        $select.append(`<option value="${val}">${val}</option>`);
      });
    });
  },

  /**
   * Add new project
   */
  addProject() {
    const newProject = {
      project_number: $("#newProjectNumber").val().trim(),
      project: $("#newProjectName").val().trim(),
      priority: $("#newPriority").val(),
      assigned_to: $("#newAssignedTo").val(),
      status: $("#newStatus").val(),
      notes: $("#newNotes").val().trim(),
      idf: $("#newIdf").val(),
      bezeq: $("#newBezeq").val(),
      hot: $("#newHot").val(),
    };

    // Validate required fields
    if (
      !newProject.project_number ||
      !newProject.project ||
      !newProject.assigned_to
    ) {
      Swal.fire({
        icon: "error",
        title: "שדות חסרים",
        text: "נא למלא את השדות הנדרשים: מספר פרויקט, שם הפרויקט, מוקצה ל",
        confirmButtonText: "אישור",
        customClass: {
          confirmButton: "swal-btn",
        },
      });
      return;
    }

    // Add to data
    this.data.push(newProject);
    this.saveData();

    // Update table
    this.table.row.add(newProject).draw();

    // Close modal
    this.hideModal();

    // Show success message
    this.showToast("הפרויקט נוסף בהצלחה");
  },

  /**
   * Confirm delete project
   */
  confirmDelete(rowIndex) {
    const project = this.data[rowIndex];
    $("#deleteProjectName").text(project.project);
    $("#confirmDeleteBtn").data("row", rowIndex);
    $("#deleteConfirmModal").addClass("show");

    // Bind confirm button
    $("#confirmDeleteBtn")
      .off("click")
      .on("click", () => {
        this.deleteProject(rowIndex);
      });

    // Bind cancel button
    $("#cancelDeleteBtn")
      .off("click")
      .on("click", () => {
        this.hideModal();
      });
  },

  /**
   * Delete project
   */
  deleteProject(rowIndex) {
    // Remove from data
    this.data.splice(rowIndex, 1);
    this.saveData();

    // Remove from table
    this.table.clear().rows.add(this.data).draw();

    // Close modal
    this.hideModal();

    // Show success message
    this.showToast("הפרויקט נמחק בהצלחה");
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
