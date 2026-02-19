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
};
