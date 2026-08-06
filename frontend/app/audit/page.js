"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
} from "@mui/material";
import Layout from "../../components/Layout";
import { auditApi } from "../../lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await auditApi.logs({ limit: 200 });
        setLogs(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const actionColor = (action) => {
    if (action === "LOGIN") return "primary";
    if (action === "BLOCKED") return "error";
    if (action.includes("CHECKLIST")) return "success";
    if (action === "AI_QUESTION") return "secondary";
    return "default";
  };

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Audit Logs
        </Typography>
        <Typography color="text.secondary">
          Complete audit trail of operator activity, decisions, and approvals.
        </Typography>
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
        <TableContainer component={Paper} sx={{ maxHeight: "70vh" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Work Instruction</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Detail</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{log.user}</TableCell>
                  <TableCell>{log.role}</TableCell>
                  <TableCell>{log.work_instruction || "N/A"}</TableCell>
                  <TableCell>
                    <Typography color={actionColor(log.action)} fontWeight={600}>
                      {log.action}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 400 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                      {log.detail}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No audit logs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Layout>
  );
}
