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

  getAllProjects(){
    return $.ajax({
      url: `${this.BASE_URL}/projects`,
      method: "GET",
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

  getCommentsByProjectId(projectId) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/getCommentsByProjectId`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ projectId }),
    });
  },

  addComment(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/addComment`,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  editComment(payload) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/editComment`,
      method: "PUT",
      contentType: "application/json",
      data: JSON.stringify(payload),
    });
  },

  deleteComment(commentId) {
    return $.ajax({
      url: `${this.BASE_URL}/projects/deleteComment`,
      method: "DELETE",
      contentType: "application/json",
      data: JSON.stringify({ commentId }),
    });
  },
};
