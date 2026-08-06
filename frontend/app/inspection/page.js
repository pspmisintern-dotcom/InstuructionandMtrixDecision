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
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
} from "@mui/material";
import {
  Check,
  Close,
  ExpandMore,
  ExpandLess,
  Gavel,
  History,
  Assignment,
  Warning,
  ErrorOutline,
  Info,
  ArrowDropDown,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { inspectionApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const STATUS_COLORS = {
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
};

function getSeverity(record) {
  const text = `${record.comment || ""} ${record.work_title || ""}`.toLowerCase();
  if (/critical|block|damag|reject|fail|severe|major/.test(text)) return { label: "Critical", color: "#ef4444", bg: "#fef2f2" };
  if (/minor|slight|small|cosmetic|warning/.test(text)) return { label: "Minor", color: "#f59e0b", bg: "#fffbeb" };
  return { label: "Major", color: "#f97316", bg: "#fff7ed" };
}

function SummaryCard({ label, value, color, icon }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: color + "20", display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color={color}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function InspectionPage() {
  const { hasRole } = useAuth();
  const [inspection, setInspection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState(0); // 0 pending, 1 all, 2 approved, 3 rejected
  const [expanded, setExpanded] = useState(null);

  const isAdmin = hasRole("admin", "supervisor");

  const loadAll = async () => {
    try {
      const res = await inspectionApi.all();
      setInspection(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load inspection history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleApprove = async (status) => {
    setError("");
    try {
      await inspectionApi.approve(selected.id, status, comment);
      setSelected(null);
      setComment("");
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process approval");
    }
  };

  // Summary calculations
  const totalCount = inspection.length;
  const approvedCount = inspection.filter((i) => i.status === "approved").length;
  const rejectedCount = inspection.filter((i) => i.status === "rejected").length;
  const pendingCount = inspection.filter((i) => i.status === "pending").length;
  const decidedCount = approvedCount + rejectedCount;
  const passRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 0;

  // Rejection by WI category
  const rejectedByDept = {};
  inspection.filter((i) => i.status === "rejected").forEach((i) => {
    const dept = i.department || "General";
    rejectedByDept[dept] = (rejectedByDept[dept] || 0) + 1;
  });
  const categoryData = Object.entries(rejectedByDept).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Tab filtering
  const filtered = tab === 0 ? inspection.filter((i) => i.status === "pending") :
    tab === 1 ? inspection :
    tab === 2 ? inspection.filter((i) => i.status === "approved") :
    inspection.filter((i) => i.status === "rejected");

  return (
    <Layout>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Gavel sx={{ color: "#6366f1", fontSize: 28 }} />
            <Typography variant="h4" fontWeight={800}>Inspection & Problem Reporting</Typography>
          </Box>
          <Typography color="text.secondary">
            Full inspection history with problem details, severity assessment, and approval workflow.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only supervisors and admins can review and approve inspections.
        </Alert>
      )}

      {/* Summary Dashboard */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <SummaryCard label="Total Inspections" value={inspection.length} color="#6366f1" icon={<Assignment />} />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard label="Pending" value={pendingCount} color="#f59e0b" icon={<Warning />} />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard label="Approved" value={approvedCount} color="#22c55e" icon={<Check />} />
        </Grid>
        <Grid item xs={6} md={3}>
          <SummaryCard label="Rejected" value={rejectedCount} color="#ef4444" icon={<Close />} />
        </Grid>
      </Grid>

      {/* Pass rate + Category breakdown */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0", height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Pass Rate</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h3" fontWeight={900} color={passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#f59e0b" : "#ef4444"}>
                {passRate}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={passRate}
                sx={{ flex: 1, height: 10, borderRadius: 5, "& .MuiLinearProgress-bar": { bgcolor: passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#f59e0b" : "#ef4444" } }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              {approvedCount} approved out of {decidedCount} inspected
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0", height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Rejections by WI Category</Typography>
            {categoryData.length === 0 ? (
              <Typography color="text.secondary">No rejections recorded.</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {categoryData.map(([dept, count]) => (
                  <Box key={dept} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" fontWeight={600}>{dept}</Typography>
                    <Chip label={`${count} reject`} size="small" sx={{ bgcolor: "#fef2f2", color: "#dc2626", fontWeight: 700 }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Status Tabs */}
      <Paper sx={{ mb: 2, borderRadius: 3, border: "1px solid #e2e8f0" }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth" textColor="primary" indicatorColor="primary">
          <Tab label={`Pending (${pendingCount})`} />
          <Tab label={`All (${totalCount})`} />
          <Tab label={`Approved (${approvedCount})`} />
          <Tab label={`Rejected (${rejectedCount})`} />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>WI</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Component / Issue</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => {
                  const sev = getSeverity(item);
                  const isExpanded = expanded === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <TableRow
                        sx={{
                          "&:hover": { bgcolor: "#f8fafc" },
                          borderLeft: `3px solid ${STATUS_COLORS[item.status] || "#64748b"}`,
                          cursor: "pointer",
                        }}
                        onClick={() => setExpanded(isExpanded ? null : item.id)}
                      >
                        <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>
                          {item.wi_number || item.work_instruction_id || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, maxWidth: 220 }}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{item.work_title || "N/A"}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={item.type} size="small" sx={{ fontSize: 10, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.status}
                            size="small"
                            sx={{ bgcolor: STATUS_COLORS[item.status] + "20", color: STATUS_COLORS[item.status], fontWeight: 700, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 700, fontSize: 11 }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, color: "text.secondary", whiteSpace: "nowrap" }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : item.id); }}>
                              {isExpanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                            {item.status === "pending" && isAdmin && (
                              <Button size="small" variant="contained" color="success" onClick={(e) => { e.stopPropagation(); setSelected(item); }}>
                                Review
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 3, bgcolor: "#fafafa" }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                <Assignment fontSize="small" color="primary" /> Problem / Issue Description
                              </Typography>
                              <Typography variant="body2" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
                                {item.comment || "No issue description provided."}
                              </Typography>

                              <Divider sx={{ my: 1.5 }} />
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Process / Category</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.activity || "N/A"} — {item.department || "General"}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Approver</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.approver_name || "Not yet assigned"}
                                  </Typography>
                                </Grid>
                              </Grid>

                              {item.status === "rejected" && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                  <strong>Rejection Reason:</strong> {item.comment || "No reason provided"}
                                </Alert>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      No inspections match this view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Review Dialog */}
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Review Approval</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>WI:</strong> {selected?.wi_number || selected?.work_instruction_id} | <strong>Title:</strong> {selected?.work_title}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Type:</strong> {selected?.type} | <strong>Status:</strong> {selected?.status}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Issue / Comment:</strong> {selected?.comment || "None"}
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
          <Button color="error" startIcon={<Close />} onClick={() => handleApprove("rejected")}>Reject</Button>
          <Button variant="contained" color="success" startIcon={<Check />} onClick={() => handleApprove("approved")}>Approve</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
