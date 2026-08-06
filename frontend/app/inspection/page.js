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
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { Check, Close } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { inspectionApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function InspectionPage() {
  const { hasRole } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");

  const loadPending = async () => {
    try {
      const res = await inspectionApi.pending();
      setPending(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (status) => {
    setError("");
    try {
      await inspectionApi.approve(selected.id, status, comment);
      setSelected(null);
      setComment("");
      await loadPending();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process approval");
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Inspection & Approvals
        </Typography>
        <Typography color="text.secondary">
          Review inspections and approve work.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!hasRole("supervisor", "admin") && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only supervisors and admins can review inspections.
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
                <TableCell>Work Instruction</TableCell>
                <TableCell>Approval Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pending.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.work_title} ({a.work_instruction_id})
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={a.type}
                      color={a.type === "qa" ? "secondary" : "info"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={a.status} color="warning" size="small" />
                  </TableCell>
                  <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="small" variant="contained" color="success" onClick={() => setSelected(a)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No pending approvals.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Review Approval - {selected?.work_title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Type:</strong> {selected?.type} | <strong>Status:</strong> {selected?.status}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Comment from inspection:</strong> {selected?.comment || "None"}
          </Typography>
          <TextField
            label="Approval Comment"
            fullWidth
            multiline
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Cancel</Button>
          <Button
            color="error"
            startIcon={<Close />}
            onClick={() => handleApprove("rejected")}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<Check />}
            onClick={() => handleApprove("approved")}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
