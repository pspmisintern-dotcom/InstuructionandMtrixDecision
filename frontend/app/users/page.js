"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Add, Delete, LockOpen, Lock, ContentCopy, SmartToy, Edit } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { userApi, authApi } from "../../lib/api";
import { parseServerDate } from "../../lib/dateUtils";

const DEPARTMENTS = ["Grinding", "Masking", "Spraying", "Production", "HR", "Marketing", "Change control", "Purchase", "Maintenance", "Quality", "Sales", "QMS"];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ department: "" });
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUser, setGrantUser] = useState(null);
  const [grantResult, setGrantResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [grantForm, setGrantForm] = useState({
    duration_hours: 8,
    new_password: "",
    department: "",
  });
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    role: "operator",
    department: "",
  });

  const loadUsers = async () => {
    try {
      const res = await userApi.list();
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async () => {
    setError("");
    setCreateResult(null);
    try {
      const res = await userApi.create(form);
      setCreateResult(res.data);
      setOpen(false);
      setForm({
        username: "",
        email: "",
        full_name: "",
        role: "operator",
        department: "",
      });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user");
    }
  };

  const handleDelete = async (id) => {
    try {
      await userApi.delete(id);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleUpdateDepartment = async () => {
    setError("");
    try {
      await userApi.update(editUser.id, { department: editForm.department || null });
      setEditOpen(false);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update user");
    }
  };

  const handleGrantAccess = async () => {
    setError("");
    try {
      const res = await authApi.grantAccess(
        grantUser.id,
        parseInt(grantForm.duration_hours),
        grantForm.new_password || null,
        grantForm.department || null
      );
      setGrantResult(res.data);
      setGrantOpen(false);
      setGrantForm({ duration_hours: 8, new_password: "", department: "" });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to grant access");
    }
  };

  const handleRevokeAccess = async (userId) => {
    setError("");
    try {
      await authApi.revokeAccess(userId);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to revoke access");
    }
  };

  const handleGrantAIAssistant = async (userId) => {
    setError("");
    try {
      await authApi.grantAIAssistant(userId);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to grant AI Assistant access");
    }
  };

  const handleRevokeAIAssistant = async (userId) => {
    setError("");
    try {
      await authApi.revokeAIAssistant(userId);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to revoke AI Assistant access");
    }
  };

  const copyPassword = (text) => {
    if (text) navigator.clipboard.writeText(text);
  };

  const roleColor = (role) => {
    if (role === "admin") return "error";
    if (role === "supervisor") return "warning";
    return "info";
  };

  const formatDate = (dateStr) => {
    const d = parseServerDate(dateStr);
    if (!d || isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            User Management
          </Typography>
          <Typography color="text.secondary">
            Manage users, grant/revoke access, and control permissions.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          Add User
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {createResult && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => copyPassword(createResult.generated_password)}
              startIcon={<ContentCopy />}
            >
              Copy Password
            </Button>
          }
        >
          <strong>User Created!</strong> Username: <strong>{createResult.username}</strong> | System-generated Password:{" "}
          <code style={{ background: "rgba(0,0,0,0.08)", padding: "2px 6px", borderRadius: 4 }}>
            <strong>{createResult.generated_password}</strong>
          </code>
          <br />
          Share this password with the user. They will be prompted to change it on first login.
        </Alert>
      )}

      {grantResult && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => copyPassword(grantResult.one_time_password)}
              startIcon={<ContentCopy />}
            >
              Copy
            </Button>
          }
        >
          <strong>Access Granted!</strong> Username: {grantResult.username} | One-time Password:{" "}
          <strong>{grantResult.one_time_password}</strong> | Expires: {formatDate(grantResult.access_expires_at)}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Access</TableCell>
                <TableCell>Access Expires</TableCell>
                <TableCell>AI Assistant</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>
                    <Chip label={u.role} color={roleColor(u.role)} size="small" />
                  </TableCell>
                  <TableCell>{u.department}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.is_active ? "Active" : "Inactive"}
                      color={u.is_active ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Chip label="Always" color="primary" size="small" />
                    ) : u.access_granted ? (
                      <Chip label="Granted" color="success" size="small" />
                    ) : (
                      <Chip label="Not Granted" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell>{u.role === "admin" ? "-" : formatDate(u.access_expires_at)}</TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Chip label="Always" color="primary" size="small" />
                    ) : u.ai_assistant_enabled ? (
                      <Chip label="Granted" color="success" size="small" />
                    ) : (
                      <Chip label="Not Granted" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {u.role !== "admin" && !u.ai_assistant_enabled && (
                        <Tooltip title="Grant AI Assistant">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleGrantAIAssistant(u.id)}
                          >
                            <SmartToy />
                          </IconButton>
                        </Tooltip>
                      )}
                      {u.role !== "admin" && u.ai_assistant_enabled && (
                        <Tooltip title="Revoke AI Assistant">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleRevokeAIAssistant(u.id)}
                          >
                            <SmartToy htmlColor="#ef4444" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit Department">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setEditUser(u);
                            setEditForm({ department: u.department || "" });
                            setEditOpen(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      {u.role !== "admin" && (
                        <>
                          {!u.access_granted ? (
                            <Tooltip title="Grant Access">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => {
                                  setGrantUser(u);
                                  setGrantForm({ duration_hours: 8, new_password: "", department: u.department || "" });
                                  setGrantOpen(true);
                                }}
                              >
                                <LockOpen />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Revoke Access">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleRevokeAccess(u.id)}
                              >
                                <Lock />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                      <Tooltip title="Deactivate">
                        <IconButton size="small" onClick={() => handleDelete(u.id)}>
                          <Delete color="error" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <TextField
            label="Full Name"
            fullWidth
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            margin="normal"
          />
          <TextField
            label="Username"
            fullWidth
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            margin="normal"
          />
          <TextField
            label="Email"
            fullWidth
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            margin="normal"
          />
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "info.50",
              border: "1px solid",
              borderColor: "info.200",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              <strong>System-generated password</strong> — A secure random password will be
              automatically created for this user. Copy it from the success banner after
              clicking Create and share it with the user (they will be prompted to change
              it on first login).
            </Typography>
          </Box>
          <TextField
            select
            label="Role"
            fullWidth
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            margin="normal"
          >
            <MenuItem value="operator">Operator</MenuItem>
            <MenuItem value="supervisor">Supervisor</MenuItem>
          </TextField>
          <TextField
            select
            label="Department"
            fullWidth
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            margin="normal"
          >
            {DEPARTMENTS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Department for {editUser?.full_name || ""}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Changes which Work Instructions {editUser?.username} can see. Takes effect
            immediately, without resetting their password or login access.
          </Typography>
          <TextField
            select
            label="Department"
            fullWidth
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            margin="normal"
          >
            {DEPARTMENTS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateDepartment}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Grant Access Dialog */}
      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Grant Access to {grantUser?.full_name || ""}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Granting access will generate a new one-time password for {grantUser?.username}. The
            user will only be able to login for the specified duration.
          </Typography>
          <TextField
            select
            label="Department (controls which Work Instructions this user can see)"
            fullWidth
            value={grantForm.department}
            onChange={(e) => setGrantForm({ ...grantForm, department: e.target.value })}
            margin="normal"
          >
            {DEPARTMENTS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Access Duration"
            fullWidth
            value={grantForm.duration_hours}
            onChange={(e) => setGrantForm({ ...grantForm, duration_hours: e.target.value })}
            margin="normal"
          >
            <MenuItem value={1}>1 Hour</MenuItem>
            <MenuItem value={4}>4 Hours</MenuItem>
            <MenuItem value={8}>8 Hours (default)</MenuItem>
            <MenuItem value={12}>12 Hours</MenuItem>
            <MenuItem value={24}>24 Hours</MenuItem>
            <MenuItem value={48}>48 Hours</MenuItem>
            <MenuItem value={168}>1 Week</MenuItem>
          </TextField>
          <TextField
            label="New Password (optional - leave blank to auto-generate)"
            type="text"
            fullWidth
            value={grantForm.new_password}
            onChange={(e) => setGrantForm({ ...grantForm, new_password: e.target.value })}
            margin="normal"
            helperText="A secure random password will be generated if left blank"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleGrantAccess}>
            Grant Access
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}