/**
 * API Client Library
 * All AJAX calls to the backend server live here.
 * Requires jQuery to be loaded before this file.
 */

const ApiClient = {
  BASE_URL: location.host === "" || location.host.includes("localhost") ? "http://localhost:3000" : "",

  /**
   * Sign in a user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {jQuery.Deferred} Resolves with the server response object
   */
  signin(email, password) {
    return $.ajax({
      url: `${this.BASE_URL}/users/signin`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ email, password }),
    });
  },

  /**
   * Register a new user (admin only)
   * @param {{ email: string, password: string, userName: string, permissions: string, Role: string }} userData
   * @returns {jQuery.Deferred}
   */
  signup(userData) {
    return $.ajax({
      url: `${this.BASE_URL}/users/signup`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(userData),
    });
  },

  /**
   * Update an existing user's details (admin only)
   * @param {{ userId: number, email: string, password: string, userName: string, permissions: number, Role: string }} payload
   * @returns {jQuery.Deferred}
   */
  updateUser(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/users/update`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  /**
   * Get all users with full details (admin only — response includes Password field).
   * @returns {jQuery.Deferred}
   */
  getAllUsers() {
    return $.ajax({
      url: `${this.BASE_URL}/users/all`,
      method: "GET",
    });
  },

  getAllProjects(params = {}) {
    return $.ajax({
      url: `${this.BASE_URL}/projects`,
      method: "GET",
      data: params,
    });
  },

  /**
   * Create a new project
   * @param {object} payload
   * @returns {jQuery.Deferred}
   */
  createProject(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/create/project`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  /**
   * Update all fields of an existing project (also used for soft-delete via IsDeleted: true)
   * @param {object} payload — must include all project fields + LastUpdated + IsDeleted
   * @returns {jQuery.Deferred}
   */
  updateProject(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/update`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  getCommentsByProjectId(projectId) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/getCommentsByProjectId`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ projectId }),
    });
  },

  /**
   * Add a new comment to a project
   * @param {{ ProjectId: number, CommentText: string, UserId: number }} payload
   * @returns {jQuery.Deferred}
   */
  addComment(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/addComment`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  /**
   * Update or soft-delete an existing comment
   * @param {{ CommentId: number, ProjectId: number, CommentText: string, UserId: number, IsDeleted: boolean }} payload
   * @returns {jQuery.Deferred}
   */
  updateComment(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/updateComment`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  /**
   * Get all user names (flat array of strings)
   * @returns {Promise<string[]>}
   */
  getUserNames() {
    return $.ajax({
      url: `${this.BASE_URL}/users/names`,
      method: "GET",
    });
  },
};
