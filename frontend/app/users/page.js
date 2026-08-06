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
} from "@mui/material";
import { Add, Delete, Edit } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { userApi } from "../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
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
    try {
      await userApi.create(form);
      setOpen(false);
      setForm({
        username: "",
        email: "",
        full_name: "",
        password: "",
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

  const roleColor = (role) => {
    if (role === "admin") return "error";
    if (role === "supervisor") return "warning";
    return "info";
  };

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            User Management
          </Typography>
          <Typography color="text.secondary">Manage users and their roles.</Typography>
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
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
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
                    <IconButton size="small" onClick={() => handleDelete(u.id)}>
                      <Delete color="error" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
          <TextField
            label="Password"
            type="password"
            fullWidth
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="normal"
          />
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
            <MenuItem value="admin">Administrator</MenuItem>
          </TextField>
          <TextField
            label="Department"
            fullWidth
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
