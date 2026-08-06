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
} from "@mui/material";
import { NotificationsActive, Warning, Info, CheckCircle, DoneAll } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { notificationApi } from "../../lib/api";

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    loadNotifs();
  }, []);

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      await loadNotifs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to mark read");
    }
  };

  const severityIcon = (severity) => {
    if (severity === "danger") return <Warning color="error" />;
    if (severity === "warning") return <NotificationsActive color="warning" />;
    return <Info color="info" />;
  };

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Notifications
          </Typography>
          <Typography color="text.secondary">
            Alerts and approvals.
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

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
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
    </Layout>
  );
}
