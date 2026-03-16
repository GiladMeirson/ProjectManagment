/**
 * User Management Page
 * Admin-only dashboard for viewing and editing system users.
 * Data source: GET /users/all (returns UserId, UserName, Email, Password,
 * Permissions, Role, LastModified, LastLogin).
 * Password is used internally for the "keep existing password" edit flow and
 * is never displayed in the UI.
 */

const UsersApp = {
  table: null,
  data: [],
  currentUser: null,
  showingDeleted: false,

  /**
   * Initialize the users page (admin only)
   */
  async init() {
    if (!Auth.requireAuth()) return;

    this.currentUser = Auth.getCurrentUser();

    // Redirect non-admins back to projects
    if (!Auth.isAdmin()) {
      window.location.href = "index.html";
      return;
    }

    this.renderUserInfo();
    this.bindEvents();
    enhanceAllSelects(document.getElementById("addUserModal"));
    enhanceAllSelects(document.getElementById("editUserModal"));

    await this.loadData();
  },

  /**
   * Fetch users from API and render table
   */
  async loadData() {
    startLoader("טוען משתמשים...");
    try {
      const users = await ApiClient.getAllUsers();
      this.data = users.filter((u) =>
        this.showingDeleted ? u.IsDeleted : !u.IsDeleted
      );
      $("#addUserBtn").toggleClass("hidden", this.showingDeleted);

      if (this.table) {
        this.table.destroy();
        this.table = null;
        $("#usersTable").empty();
      }

      this.initDataTable();
      this.updateUserCount();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "שגיאה",
        text: "לא ניתן לטעון משתמשים מהשרת",
        confirmButtonText: "אישור",
      });
    } finally {
      stopLoader();
    }
  },

  /**
   * Render user info in header
   */
  renderUserInfo() {
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const userRole = document.getElementById("userRole");

    if (userAvatar) userAvatar.textContent = this.currentUser.username.charAt(0);
    if (userName) userName.textContent = this.currentUser.username;
    if (userRole) userRole.textContent = "מנהל מערכת";
  },

  /**
   * Update user count badge
   */
  updateUserCount() {
    const el = document.getElementById("userCount");
    if (el) el.textContent = this.data.length;
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
   * Format a Unix-ms timestamp to DD/MM/YYYY HH:MM, or "--" if null/invalid
   */
  formatDate(timestamp) {
    if (!timestamp) return "--";
    const d = new Date(Number(timestamp));
    if (isNaN(d.getTime())) return "--";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * Render role badge
   */
  renderRoleBadge(role) {
    if (!role) return '<span class="badge badge-empty">--</span>';
    const isAdmin = role === "admin";
    const badgeClass = isAdmin ? "badge-priority-urgent" : "badge-status-working";
    const label = isAdmin ? "מנהל" : "עובד";
    return `<span class="badge ${badgeClass}">${label}</span>`;
  },

  /**
   * Render permissions badge
   */
  renderPermissionsBadge(permissions) {
    if (permissions === undefined || permissions === null) {
      return '<span class="badge badge-empty">--</span>';
    }
    const val = String(permissions);
    const badgeClass = val === "1" ? "badge-priority-urgent" : "badge-yes";
    return `<span class="badge ${badgeClass}">${this.escapeHtml(val)}</span>`;
  },

  /**
   * Initialize DataTable
   */
  initDataTable() {
    const self = this;

    this.table = $("#usersTable").DataTable({
      data: this.data,
      columns: [
        {
          data: "UserName",
          title: "שם משתמש",
          render: (data) => `<span class="assigned-user">${this.escapeHtml(data)}</span>`,
        },
        {
          data: "Email",
          title: "אימייל",
          render: (data) => this.escapeHtml(data || ""),
        },
        {
          data: "Role",
          title: "תפקיד",
          render: (data) => this.renderRoleBadge(data),
        },
        {
          data: "Permissions",
          title: "הרשאות",
          render: (data) => this.renderPermissionsBadge(data),
        },
        {
          data: "LastLogin",
          title: "התחברות אחרונה",
          render: (data) => `<span class="comment-time">${this.formatDate(data)}</span>`,
        },
        {
          data: null,
          title: "פעולות",
          orderable: false,
          searchable: false,
          className: "text-center",
          render: (_data, _type, _row, meta) => {
            if (self.showingDeleted) {
              return `
                <div class="action-buttons">
                  <button class="btn btn-subtle-success btn-icon btn-sm restore-user-btn"
                          data-row="${meta.row}"
                          title="שחזר משתמש">
                    ↩
                  </button>
                </div>
              `;
            }
            return `
              <div class="action-buttons">
                <button class="btn btn-subtle-primary btn-icon btn-sm edit-user-btn"
                        data-row="${meta.row}"
                        title="ערוך משתמש">
                  ✎
                </button>
                <button class="btn btn-subtle-danger btn-icon btn-sm delete-user-btn"
                        data-row="${meta.row}"
                        title="מחק משתמש">
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
          title: "משתמשים",
          className: "dt-button-excel",
          exportOptions: {
            columns: ":not(:last-child)",
            format: {
              body: function (data) {
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

    // Edit user button
    $("#usersTable tbody").on("click", ".edit-user-btn", function () {
      const rowIndex = $(this).data("row");
      self.showEditModal(rowIndex);
    });

    // Delete user button
    $("#usersTable tbody").on("click", ".delete-user-btn", async function () {
      const rowIndex = parseInt($(this).data("row"));
      const user = self.data[rowIndex];

      // Fetch active projects assigned to this user
      startLoader("בודק פרוייקטים משוייכים...");
      let allProjects;
      try {
        allProjects = await ApiClient.getAllProjects();
      } catch {
        stopLoader();
        Swal.fire({ icon: "error", title: "שגיאה", text: "לא ניתן לטעון פרוייקטים", confirmButtonText: "אישור" });
        return;
      }
      stopLoader();

      const assignedProjects = allProjects.filter(
        p => !p.IsDeleted && p.AssignedTo === user.UserName
      );
      const count = assignedProjects.length;

      // Block deletion if more than 5 projects are assigned
      if (count > 5) {
        Swal.fire({
          icon: "error",
          title: "לא ניתן למחוק משתמש",
          text: "למשתמש זה יש מעל 5 פרוייקטים משוייכים, נא להקצות מחדש ולאחר מכן תוכל לבצע פעולה זו.",
          confirmButtonText: "אישור",
        });
        return;
      }

      // Show confirmation — include warning text if there are assigned projects
      const confirmText = count > 0
        ? `שים לב- למשתמש זה יש ${count} פרוייקטים משוייכים, דאג להקצות אותם בהקדם.\n\nהאם למחוק את המשתמש "${user.UserName}"?`
        : `האם למחוק את המשתמש "${user.UserName}"?`;

      const result = await Swal.fire({
        title: "מחיקת משתמש",
        text: confirmText,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "מחק",
        cancelButtonText: "ביטול",
      });
      if (!result.isConfirmed) return;

      startLoader("מוחק משתמש...");
      try {
        // Unassign the user from all active projects before deleting
        for (const project of assignedProjects) {
          await ApiClient.updateProject({
            ProjectId:        project.ProjectId,
            ProjectNumber:    project.ProjectNumber,
            ProjectName:      project.ProjectName,
            Priority:         project.Priority,
            AssignedTo:       null,
            Status:           project.Status,
            Chachi:           !!project.Chachi,
            ChachiIsExecuted: !!project.ChachiIsExecuted,
            Bezeq:            !!project.Bezeq,
            BezeqIsExecuted:  !!project.BezeqIsExecuted,
            Hot:              !!project.Hot,
            HotIsExecuted:    !!project.HotIsExecuted,
            LastUpdated:      Date.now(),
            IsDeleted:        false,
          });
        }
        await ApiClient.updateUser({
          userId: user.UserId,
          userName: user.UserName,
          email: user.Email,
          password: user.Password || "",
          permissions: user.Permissions,
          Role: user.Role,
          IsDeleted: true,
        });
        stopLoader();
        self.showToast("המשתמש נמחק בהצלחה");
        await self.loadData();
      } catch {
        stopLoader();
        Swal.fire({ icon: "error", title: "שגיאה", text: "לא ניתן למחוק את המשתמש", confirmButtonText: "אישור" });
      }
    });

    // Restore user button
    $("#usersTable tbody").on("click", ".restore-user-btn", async function () {
      const rowIndex = parseInt($(this).data("row"));
      const user = self.data[rowIndex];
      const result = await Swal.fire({
        title: "שחזור משתמש",
        text: `האם לשחזר את המשתמש "${user.UserName}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "שחזר",
        cancelButtonText: "ביטול",
      });
      if (!result.isConfirmed) return;
      startLoader("משחזר משתמש...");
      try {
        await ApiClient.updateUser({
          userId: user.UserId,
          userName: user.UserName,
          email: user.Email,
          password: user.Password || "",
          permissions: user.Permissions,
          Role: user.Role,
          IsDeleted: false,
        });
        stopLoader();
        self.showToast("המשתמש שוחזר בהצלחה");
        await self.loadData();
      } catch {
        stopLoader();
        Swal.fire({ icon: "error", title: "שגיאה", text: "לא ניתן לשחזר את המשתמש", confirmButtonText: "אישור" });
      }
    });
  },

  /**
   * Bind global page events
   */
  bindEvents() {
    // Back to projects
    $("#backBtn").on("click", () => {
      window.location.href = "index.html";
    });

    // Logout
    $("#logoutBtn").on("click", () => {
      Auth.logout();
      window.location.href = "login.html";
    });

    // Open add user modal
    $("#addUserBtn").on("click", () => {
      $("#addUserForm")[0].reset();
      $("#addUserModal select[data-cs-enhanced]").each(function () {
        if (this._csRefresh) this._csRefresh();
      });
      enhanceAllSelects(document.getElementById("addUserModal"));
      $("#addUserModal").addClass("show");
    });

    // Add user form submit
    $("#addUserForm").on("submit", (e) => {
      e.preventDefault();
      this.addUser();
    });

    // Edit user form submit
    $("#editUserForm").on("submit", (e) => {
      e.preventDefault();
      this.saveEditUser();
    });

    // Deleted users filter toggle
    $("#deletedUsersFilter").on("change", () => {
      this.showingDeleted = $("#deletedUsersFilter").is(":checked");
      this.loadData();
    });

    // Close modals
    $(".modal-close, .modal-overlay").on("click", (e) => {
      if (e.target === e.currentTarget) {
        this.hideModal();
      }
    });

    $(".modal").on("click", (e) => {
      e.stopPropagation();
    });
  },

  /**
   * Hide all modals
   */
  hideModal() {
    $(".modal-overlay").removeClass("show");
  },

  /**
   * Open edit user modal pre-filled with existing data
   */
  showEditModal(rowIndex) {
    const user = this.data[rowIndex];
    $("#editUserModal").data("row-index", rowIndex);

    $("#editUserName").val(user.UserName || "");
    $("#editUserEmail").val(user.Email || "");
    $("#editUserPassword").val("");
    $("#editUserPermissions").val(String(user.Permissions ?? "2"));
    $("#editUserRole").val(user.Role || "employee");

    $("#editUserModal select[data-cs-enhanced]").each(function () {
      if (this._csRefresh) this._csRefresh();
    });
    enhanceAllSelects(document.getElementById("editUserModal"));

    $("#editUserModal").addClass("show");
  },

  /**
   * Add a new user via API
   */
  addUser() {
    const userName    = $("#newUserName").val().trim();
    const email       = $("#newUserEmail").val().trim();
    const password    = $("#newUserPassword").val();
    const permissions = $("#newUserPermissions").val();
    const role        = $("#newUserRole").val();

    if (!userName || !email || !password) {
      Swal.fire({
        icon: "error",
        title: "שדות חסרים",
        text: "נא למלא את כל השדות הנדרשים",
        confirmButtonText: "אישור",
        customClass: { confirmButton: "swal-btn" },
      });
      return;
    }

    startLoader("מוסיף משתמש...");
    ApiClient.signup({ userName, email, password, permissions, Role: role })
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
        this.hideModal();
        this.showToast("המשתמש נוסף בהצלחה");
        this.loadData();
      })
      .fail((err) => {
        stopLoader();
        const msg = err.responseJSON?.message || "שגיאה בהוספת המשתמש";
        Swal.fire({
          icon: "error",
          title: "שגיאה",
          text: msg,
          confirmButtonText: "אישור",
        });
      });
  },

  /**
   * Save edited user via API
   */
  async saveEditUser() {
    const rowIndex    = $("#editUserModal").data("row-index");
    const existing    = this.data[rowIndex];
    const userName    = $("#editUserName").val().trim();
    const email       = $("#editUserEmail").val().trim();
    const password    = $("#editUserPassword").val();
    const permissions = parseInt($("#editUserPermissions").val(), 10);
    const role        = $("#editUserRole").val();

    if (!userName || !email) {
      Swal.fire({
        icon: "error",
        title: "שדות חסרים",
        text: "נא למלא שם משתמש ואימייל",
        confirmButtonText: "אישור",
        customClass: { confirmButton: "swal-btn" },
      });
      return;
    }

    // Use existing password if none provided (server requires the field)
    const resolvedPassword = password || existing.Password || "";

    if (!resolvedPassword) {
      Swal.fire({
        icon: "warning",
        title: "נדרשת סיסמה",
        text: "לא ידועה הסיסמה הנוכחית. נא הזן סיסמה חדשה.",
        confirmButtonText: "אישור",
      });
      return;
    }

    const payload = {
      userId:      existing.UserId,
      userName,
      email,
      password:    resolvedPassword,
      permissions,
      Role:        role,
    };

    startLoader("שומר שינויים...");
    try {
      await ApiClient.updateUser(payload);
      // Update local data
      this.data[rowIndex] = {
        ...existing,
        UserName:    userName,
        Email:       email,
        Role:        role,
        Permissions: permissions,
      };

      if (this.table) {
        this.table.row(rowIndex).data(this.data[rowIndex]).draw(false);
      }

      this.hideModal();
      this.showToast("המשתמש עודכן בהצלחה");
    } catch (err) {
      const msg = err.responseJSON?.message || "שגיאה בעדכון המשתמש";
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
   * Show toast notification
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
    Toast.fire({ icon: "success", title: message });
  },
};

$(document).ready(() => UsersApp.init());
