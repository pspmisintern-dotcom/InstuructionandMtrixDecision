import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
  grantAccess: (userId, durationHours, newPassword) =>
    api.post("/auth/grant-access", { user_id: userId, duration_hours: durationHours, new_password: newPassword }),
  revokeAccess: (userId) => api.post("/auth/revoke-access", { user_id: userId }),
};

export const workInstructionApi = {
  list: (params) => api.get("/workinstructions", { params }),
  get: (id) => api.get(`/workinstructions/${id}`),
  departments: (lang) => api.get("/workinstructions/departments", { params: lang ? { lang } : {} }),
  file: (id) =>
    api.get(`/workinstructions/${id}/file`, { responseType: "blob" }),
  pdf: (id, lang) =>
    api.get(`/workinstructions/${id}/pdf`, {
      params: { lang },
      responseType: "blob",
    }),
  languages: () => api.get("/workinstructions/languages"),
};

export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
};

export const aiApi = {
  ask: (question, context) => api.post("/ai/ask", { question, context: context || {} }),
  runWorkflow: (data) => api.post("/ai/workflow", data),
};

export const userApi = {
  list: () => api.get("/users"),
  create: (data) => {
    const payload = { ...data };
    delete payload.password;
    return api.post("/users", payload);
  },
  update: (id, data) => {
    const payload = { ...data };
    delete payload.password;
    return api.put(`/users/${id}`, payload);
  },
  delete: (id) => api.delete(`/users/${id}`),
};

export const checklistApi = {
  get: (wiId) => api.get(`/checklists/${wiId}`),
  addItems: (wiId, items) => api.post(`/checklists/${wiId}/items`, items),
  toggle: (itemId, isChecked) => api.put(`/checklists/${itemId}`, null, { params: { is_checked: isChecked } }),
};

export const auditApi = {
  logs: (params) => api.get("/audit/logs", { params }),
};

export const notificationApi = {
  list: () => api.get("/notifications"),
  send: (data) => api.post("/notifications/send", data),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

export default api;
