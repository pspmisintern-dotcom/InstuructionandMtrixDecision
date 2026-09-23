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
import { Add, Delete, LockOpen, Lock, ContentCopy, Edit, PersonAdd } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { userApi, authApi } from "../../lib/api";
import { parseServerDate } from "../../lib/dateUtils";
import { useAuth } from "../../context/AuthContext";

const DEPARTMENTS = ["Grinding", "Masking", "Spraying", "Production", "HR", "Marketing", "Change control", "Purchase", "Maintenance", "Quality", "Sales", "QMS"];

// Maps the backend's derived, login-accurate `status` (see
// backend/routes/user_routes.py:_access_state) to a chip label/colour.
const STATUS_META = {
  active: { label: "Active", color: "success" },
  password_change_required: { label: "Active • Password Pending", color: "warning" },
  expired: { label: "Access Expired", color: "error" },
  not_granted: { label: "No Access", color: "default" },
  pending: { label: "Pending Approval", color: "warning" },
  rejected: { label: "Rejected", color: "error" },
  // Matches the backend login error ("Your account is deactivated"), so the
  // reason an inactive account cannot log in is obvious from the list.
  inactive: { label: "Deactivated", color: "error" },
};

function getStatusMeta(user) {
  if (user?.role === "admin") return { label: "Active (Fixed Admin)", color: "primary" };
  const key = user?.status;
  if (key && STATUS_META[key]) return STATUS_META[key];
  // Fallback for an older backend that doesn't send `status` yet.
  return user?.is_active
    ? { label: "Active", color: "success" }
    : { label: "Inactive", color: "default" };
}

export default function UsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", department: "" });
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUser, setGrantUser] = useState(null);
  const [grantResult, setGrantResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  // Delete now asks for confirmation and reports the result, so a click can
  // never silently appear to "do nothing".
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [grantForm, setGrantForm] = useState({
    duration_hours: 8,
    new_password: "",
  });
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    role: "operator",
    department: "",
  });

  const loadUsers = async () => {
    try {
      const res = await userApi.list();
      setUsers((res.data || []).filter((user) => user.role !== "admin"));
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
    setError("");
    setSuccess("");
    setDeleting(true);
    try {
      const res = await userApi.delete(id);
      setSuccess(res.data?.message || "User deleted.");
      setDeleteUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete user");
      setDeleteUser(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateDepartment = async () => {
    setError("");
    try {
      await userApi.update(editUser.id, {
        username: editForm.username.trim(),
        department: editForm.department || null,
      });
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
        null
      );
      setGrantResult(res.data);
      setGrantOpen(false);
      setGrantForm({ duration_hours: 8, new_password: "" });
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

  // An inactive account cannot log in at all ("Account is deactivated"), so
  // it must be reactivated before Grant Access is useful.
  const handleActivate = async (id) => {
    setError("");
    setSuccess("");
    try {
      const res = await userApi.activate(id);
      setSuccess(res.data?.message || "User reactivated.");
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reactivate user");
    }
  };

  const handleDeactivate = async (id) => {
    setError("");
    setSuccess("");
    try {
      const res = await userApi.deactivate(id);
      setSuccess(res.data?.message || "User deactivated.");
      setDeleteUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to deactivate user");
      setDeleteUser(null);
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
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
            Add User
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
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
                    {(() => {
                      const meta = getStatusMeta(u);
                      return <Chip label={meta.label} color={meta.color} size="small" />;
                    })()}
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Chip label="Always" color="primary" size="small" />
                    ) : u.status === "expired" || u.access_expired ? (
                      <Chip label="Expired" color="error" size="small" />
                    ) : !u.is_active ? (
                      <Chip label="Revoked" color="default" size="small" />
                    ) : u.access_granted ? (
                      <Chip label="Granted" color="success" size="small" />
                    ) : (
                      <Chip label="Not Granted" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role === "admin"
                      ? "-"
                      : u.status === "expired" || u.access_expired
                        ? `Expired ${formatDate(u.access_expires_at)}`
                        : formatDate(u.access_expires_at)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {!isAdmin ? (
                        // Only admins can mutate users; without this guard a
                        // supervisor saw buttons that always failed with 403,
                        // which looked like the action "not working".
                        <Typography variant="caption" color="text.secondary">
                          View only
                        </Typography>
                      ) : (
                        <>
                          <Tooltip title="Edit User">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setEditUser(u);
                                setEditForm({ username: u.username || "", department: u.department || "" });
                                setEditOpen(true);
                              }}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          {u.role !== "admin" && (
                            <>
                              {u.status === "inactive" ? (
                                <Tooltip title="Reactivate account (restores login)">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleActivate(u.id)}
                                  >
                                    <PersonAdd />
                                  </IconButton>
                                </Tooltip>
                              ) : u.status === "expired" || u.access_expired || !u.access_granted ? (
                                <Tooltip title="Grant Access">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      setGrantUser(u);
                                      setGrantForm({ duration_hours: 8, new_password: "" });
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
                          <Tooltip title="Delete User">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setError("");
                                  setSuccess("");
                                  setDeleteUser(u);
                                }}
                                disabled={u.id === currentUser?.id}
                              >
                                <Delete color="error" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
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
            Update the username and department. Changes take effect immediately without
            resetting the user&apos;s password or login access.
          </Typography>
          <TextField
            label="Username"
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
            value={editForm.username}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            margin="normal"
          />
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

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteUser)}
        onClose={() => !deleting && setDeleteUser(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Delete color="error" />
          Delete user permanently?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>{deleteUser?.full_name}</strong> ({deleteUser?.username}) will be removed
            from the system and will no longer be able to log in. This cannot be undone.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            To only block login temporarily (keeping the account and its history),
            use <strong>Deactivate</strong> instead — you can reactivate it later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button onClick={() => setDeleteUser(null)} disabled={deleting}>
            Cancel
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              color="warning"
              onClick={() => handleDeactivate(deleteUser?.id)}
              disabled={deleting || !deleteUser}
            >
              Deactivate
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleDelete(deleteUser?.id)}
              disabled={deleting || !deleteUser}
            >
              {deleting ? <CircularProgress size={20} color="inherit" /> : "Delete User"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}