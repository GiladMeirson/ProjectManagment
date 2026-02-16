/**
 * Authentication Module
 * Handles login, logout, and session management via localStorage
 */

const AUTH_KEYS = {
  CURRENT_USER: "pm_currentUser",
  IS_LOGGED_IN: "pm_isLoggedIn",
};

const Auth = {
  /**
   * Attempt to log in a user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {object} Result with success status and user/error message
   */
  login(email, password) {
    if (!email || !password) {
      return { success: false, error: "נא להזין אימייל וסיסמה" };
    }

    const user = USERS.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password,
    );

    if (!user) {
      return { success: false, error: "אימייל או סיסמה שגויים" };
    }

    // Store user session (without password for security)
    const sessionUser = {
      username: user.username,
      email: user.email,
      role: user.role,
    };

    localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(sessionUser));
    localStorage.setItem(AUTH_KEYS.IS_LOGGED_IN, "true");

    return { success: true, user: sessionUser };
  },

  /**
   * Log out the current user
   */
  logout() {
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
    localStorage.removeItem(AUTH_KEYS.IS_LOGGED_IN);
  },

  /**
   * Check if a user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return localStorage.getItem(AUTH_KEYS.IS_LOGGED_IN) === "true";
  },

  /**
   * Get the current logged-in user
   * @returns {object|null}
   */
  getCurrentUser() {
    const userJson = localStorage.getItem(AUTH_KEYS.CURRENT_USER);
    if (!userJson) return null;

    try {
      return JSON.parse(userJson);
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
   * Get all available users (for admin to assign projects)
   * @returns {Array} List of usernames
   */
  getAllUsernames() {
    return USERS.filter((u) => u.role !== "admin").map((u) => u.username);
  },
};
