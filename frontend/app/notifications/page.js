"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Button,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Snackbar,
  Divider,
} from "@mui/material";
import {
  NotificationsActive,
  Warning,
  Info,
  CheckCircle,
  DoneAll,
  Send as SendIcon,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { notificationApi, userApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function NotificationsPage() {
  const { user, hasRole } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [recipientIds, setRecipientIds] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const canSend = hasRole("admin", "supervisor");

  const loadNotifs = async () => {
    try {
      const res = await notificationApi.list();
      setNotifs(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canSend) return;
    try {
      const res = await userApi.list();
      // Only show supervisors and operators as recipients
      const recipients = (res.data || []).filter((u) => u.role !== "admin" && u.is_active);
      setUsers(recipients);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadNotifs();
    loadUsers();
  }, []);

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      await loadNotifs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to mark read");
    }
  };

  const handleSend = async () => {
    if (!recipientIds.length || !title.trim() || !message.trim()) {
      setSnackbar({ open: true, message: "Please fill in all fields and select at least one recipient.", severity: "error" });
      return;
    }
    setSending(true);
    try {
      await notificationApi.send({
        recipient_ids: recipientIds,
        title: title.trim(),
        message: message.trim(),
        severity,
      });
      setSnackbar({ open: true, message: "Notification sent successfully!", severity: "success" });
      setRecipientIds([]);
      setTitle("");
      setMessage("");
      setSeverity("info");
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || "Failed to send notification.", severity: "error" });
    } finally {
      setSending(false);
    }
  };

  const severityIcon = (severity) => {
    if (severity === "danger") return <Warning color="error" />;
    if (severity === "warning") return <NotificationsActive color="warning" />;
    return <Info color="info" />;
  };

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: "#0D47A1" }}>
            Notifications
          </Typography>
          <Typography color="text.secondary">
            Alerts, messages, and notifications.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<DoneAll />} onClick={markAllRead}>
          Mark all read
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {canSend && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1, color: "#0D47A1" }}>
            <SendIcon color="primary" />
            Send Notification
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Recipients</InputLabel>
              <Select
                multiple
                value={recipientIds}
                onChange={(e) => setRecipientIds(e.target.value)}
                input={<OutlinedInput label="Recipients" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selected.map((id) => {
                      const u = users.find((x) => x.id === id);
                      return <Chip key={id} label={u ? `${u.full_name} (${u.role})` : id} size="small" />;
                    })}
                  </Box>
                )}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.full_name} ({u.role} - {u.department || "General"})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Title / Subject"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              multiline
              rows={3}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                label="Severity"
              >
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="danger">Danger</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={handleSend}
              disabled={sending}
              sx={{ alignSelf: "flex-start", px: 4 }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : "Send Notification"}
            </Button>
          </Box>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <List>
            {notifs.map((n, i) => (
              <ListItem key={n.id} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                <ListItemIcon>{severityIcon(n.severity)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {n.title}
                      <Chip
                        label={n.severity}
                        size="small"
                        color={n.severity === "danger" ? "error" : n.severity === "warning" ? "warning" : "info"}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      {n.message}
                      <Box component="span" sx={{ display: "block", color: "text.disabled", mt: 0.5 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </Box>
                    </>
                  }
                />
                {n.is_read && <CheckCircle color="success" fontSize="small" />}
              </ListItem>
            ))}
            {notifs.length === 0 && (
              <ListItem>
                <ListItemText primary="No notifications." align="center" />
              </ListItem>
            )}
          </List>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}