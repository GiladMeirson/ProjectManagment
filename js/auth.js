/**
 * Authentication Module
 * Handles login, logout, and session management via localStorage.
 * Login is performed via API call (ApiClient.signin) — requires clientLib.js.
 */

const AUTH_KEYS = {
  CURRENT_USER: "pm_currentUser",
  IS_LOGGED_IN: "pm_isLoggedIn",
};

const SESSION_TTL_MS = 4 * 24 * 60 * 60 * 1000; // 4 days

function _setSession(user) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify({ ...user, expiresAt }));
  localStorage.setItem(AUTH_KEYS.IS_LOGGED_IN, "true");
}

function _isSessionExpired() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_KEYS.CURRENT_USER) || "{}");
    return !stored.expiresAt || Date.now() > stored.expiresAt;
  } catch {
    return true;
  }
}

const Auth = {
  /**
   * Attempt to log in a user with email and password via the API.
   * Async — results delivered via callbacks.
   * @param {string} email
   * @param {string} password
   * @param {function} onSuccess - called on successful login
   * @param {function} onError   - called with an error message string on failure
   */
  login(email, password, onSuccess, onError) {
    if (!email || !password) {
      onError("נא להזין אימייל וסיסמה");
      return;
    }

    ApiClient.signin(email, password)
      .done(function (response) {
        const u = response.user;
        _setSession({
          username: u.UserName,
          email: u.Email,
          role: u.Role,
        });
        onSuccess();
      })
      .fail(function (xhr) {
        const msg =
          (xhr.responseJSON && xhr.responseJSON.message) ||
          "אימייל או סיסמה שגויים";
        onError(msg);
      });
  },

  /**
   * Log out the current user
   */
  logout() {
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
    localStorage.removeItem(AUTH_KEYS.IS_LOGGED_IN);
  },

  /**
   * Check if a user is currently logged in (and session not expired)
   * @returns {boolean}
   */
  isLoggedIn() {
    if (localStorage.getItem(AUTH_KEYS.IS_LOGGED_IN) !== "true") return false;
    if (_isSessionExpired()) {
      this.logout();
      return false;
    }
    return true;
  },

  /**
   * Get the current logged-in user (without internal session fields)
   * @returns {object|null}
   */
  getCurrentUser() {
    const userJson = localStorage.getItem(AUTH_KEYS.CURRENT_USER);
    if (!userJson) return null;

    try {
      const { expiresAt, ...user } = JSON.parse(userJson);
      return user;
    } catch {
      return null;
    }
  },

  /**
   * Check if the current user is an admin
   * @returns {boolean}
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === "admin";
  },

  /**
   * Redirect to login page if not authenticated
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },

  /**
   * Redirect to main page if already authenticated
   */
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      window.location.href = "index.html";
      return true;
    }
    return false;
  },

  /**
   * Get all available usernames (for admin to assign projects)
   * @returns {Array} List of usernames
   */
  getAllUsernames() {
    return USERS.filter((u) => u.role !== "admin").map((u) => u.username);
  },
};
