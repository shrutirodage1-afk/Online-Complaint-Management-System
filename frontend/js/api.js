/* =====================================================
   OCMC — Shared API helper
   Connects the frontend pages to the Express + MongoDB
   backend. Replaces old localStorage-only logic.
   ===================================================== */

const API_BASE = "http://localhost:5000/api";

const OCMC = {
  // ---- token / session helpers ----
  getToken() {
    return localStorage.getItem("ocms_token");
  },
  setSession(token, user) {
    localStorage.setItem("ocms_token", token);
    localStorage.setItem("ocms_user", JSON.stringify(user));
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem("ocms_user"));
    } catch {
      return null;
    }
  },
  clearSession() {
    localStorage.removeItem("ocms_token");
    localStorage.removeItem("ocms_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },

  // Redirect to login if not authenticated (call at top of protected pages)
  requireAuth(loginPage = "login.html") {
    if (!this.isLoggedIn()) {
      window.location.href = loginPage;
    }
  },
  requireAdmin(loginPage = "admin-login.html") {
    const user = this.getUser();
    if (!this.isLoggedIn() || !user || user.role !== "admin") {
      window.location.href = loginPage;
    }
  },

  // ---- core request wrapper ----
  async request(path, { method = "GET", body, isForm = false, auth = true } = {}) {
    const headers = {};
    if (!isForm) headers["Content-Type"] = "application/json";
    if (auth && this.getToken()) headers["Authorization"] = `Bearer ${this.getToken()}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: "Invalid server response" };
    }

    if (!res.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }
    return data;
  },

  // ---- Auth ----
  registerUser(payload) {
    return this.request("/auth/register", { method: "POST", body: payload, auth: false });
  },
  registerAdmin(payload) {
    return this.request("/auth/admin/register", { method: "POST", body: payload, auth: false });
  },
  loginUser(email, password) {
    return this.request("/auth/login", { method: "POST", body: { email, password }, auth: false });
  },
  loginAdmin(email, password) {
    return this.request("/auth/admin/login", { method: "POST", body: { email, password }, auth: false });
  },

  // ---- Complaints ----
  submitComplaint(formData) {
    return this.request("/complaints", { method: "POST", body: formData, isForm: true });
  },
  getMyComplaints() {
    return this.request("/complaints/mine");
  },
  trackComplaint(complaintId) {
    return this.request(`/complaints/track/${encodeURIComponent(complaintId)}`, { auth: false });
  },
  getAllComplaints() {
    return this.request("/complaints");
  },
  getComplaintStats() {
    return this.request("/complaints/stats");
  },
  updateComplaintStatus(id, status) {
    return this.request(`/complaints/${id}/status`, { method: "PATCH", body: { status } });
  },

  // ---- Users / Profile ----
  getProfile() {
    return this.request("/users/profile");
  },
  updateProfile(formData) {
    return this.request("/users/profile", { method: "PUT", body: formData, isForm: true });
  },
  getAllUsers() {
    return this.request("/users");
  },
  deleteUser(id) {
    return this.request(`/users/${id}`, { method: "DELETE" });
  },

  // ---- Notifications ----
  getNotifications() {
    return this.request("/notifications");
  },
  sendNotification(message, audience = "all") {
    return this.request("/notifications", { method: "POST", body: { message, audience } });
  },

  // ---- helpers ----
  imageUrl(path) {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `http://localhost:5000${path}`;
  }
};
