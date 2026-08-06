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
};

export const workInstructionApi = {
  list: (params) => api.get("/workinstructions", { params }),
  get: (id) => api.get(`/workinstructions/${id}`),
  departments: () => api.get("/workinstructions/departments"),
  file: (id) =>
    api.get(`/workinstructions/${id}/file`, { responseType: "blob" }),
};

export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
};

export const aiApi = {
  ask: (question, context) => api.post("/ai/ask", { question, context: context || {} }),
  runWorkflow: (data) => api.post("/ai/workflow", data),
};

export const decisionApi = {
  evaluate: (work, processData) => api.post("/decision/evaluate", { work, process_data: processData }),
  listRules: () => api.get("/decision/rules"),
  createRule: (rule) => api.post("/decision/rules", rule),
  updateRule: (id, rule) => api.put(`/decision/rules/${id}`, rule),
  deleteRule: (id) => api.delete(`/decision/rules/${id}`),
};

export const documentApi = {
  list: () => api.get("/documents"),
  upload: (formData) =>
    api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  archive: (id) => api.post(`/documents/${id}/archive`),
};

export const userApi = {
  list: () => api.get("/users"),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const checklistApi = {
  get: (wiId) => api.get(`/checklists/${wiId}`),
  addItems: (wiId, items) => api.post(`/checklists/${wiId}/items`, items),
  toggle: (itemId, isChecked) => api.put(`/checklists/${itemId}`, null, { params: { is_checked: isChecked } }),
};

export const inspectionApi = {
  submit: (data) => api.post("/inspection/submit", data),
  pending: () => api.get("/inspection/pending"),
  all: () => api.get("/inspection/all"),
  approve: (approvalId, status, comment) =>
    api.post("/inspection/approve", { approval_id: approvalId, status, comment }),
};

export const auditApi = {
  logs: (params) => api.get("/audit/logs", { params }),
};

export const reportApi = {
  types: () => api.get("/reports/types"),
  generate: (type) => api.get(`/reports/${type}`),
};

export const notificationApi = {
  list: () => api.get("/notifications"),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

export default api;
