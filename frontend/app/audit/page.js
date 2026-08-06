"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
IconButton,
  Tooltip,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import {
  History,
  Search,
  FilterList,
  Login as LoginIcon,
  Block,
  SmartToy,
  FactCheck,
  AccountCircle,
  Refresh,
  TrendingUp,
  Security,
  Assignment,
  Timeline as TimelineIcon,
  TableChart,
  Download,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { auditApi } from "../../lib/api";

const ACTION_META = {
  LOGIN: { color: "#22c55e", bg: "#f0fdf4", label: "Login", icon: <LoginIcon fontSize="small" /> },
  LOGOUT: { color: "#64748b", bg: "#f8fafc", label: "Logout", icon: <LoginIcon fontSize="small" /> },
  BLOCKED: { color: "#ef4444", bg: "#fef2f2", label: "Blocked", icon: <Block fontSize="small" /> },
  DECISION_EVALUATE: { color: "#6366f1", bg: "#eef2ff", label: "Decision", icon: <FactCheck fontSize="small" /> },
  AI_QUESTION: { color: "#8b5cf6", bg: "#f5f3ff", label: "AI Query", icon: <SmartToy fontSize="small" /> },
  INSPECTION_APPROVE: { color: "#f59e0b", bg: "#fffbeb", label: "Approved", icon: <FactCheck fontSize="small" /> },
  INSPECTION_REJECT: { color: "#ef4444", bg: "#fef2f2", label: "Rejected", icon: <Block fontSize="small" /> },
  WI_VIEW: { color: "#3b82f6", bg: "#eff6ff", label: "WI View", icon: <Assignment fontSize="small" /> },
  DEFAULT: { color: "#64748b", bg: "#f8fafc", label: "Activity", icon: <AccountCircle fontSize="small" /> },
};

function getActionMeta(action) {
  return ACTION_META[action] || ACTION_META.DEFAULT;
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3, bgcolor: bg || "background.paper" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5, bgcolor: color + "20",
            display: "flex", alignItems: "center", justifyContent: "center", color,
          }}>
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

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'timeline'

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.logs({ limit: 500 });
      setLogs(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  // Stats
  const totalLogins = logs.filter(l => l.action === "LOGIN").length;
  const totalBlocked = logs.filter(l => l.action === "BLOCKED").length;
  const totalAI = logs.filter(l => l.action === "AI_QUESTION").length;
  const totalDecisions = logs.filter(l => l.action === "DECISION_EVALUATE").length;

  // Unique actions and roles for filters
  const uniqueActions = ["ALL", ...new Set(logs.map(l => l.action))];
  const uniqueRoles = ["ALL", ...new Set(logs.map(l => l.role).filter(Boolean))];

// Filtered
  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.user?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.detail?.toLowerCase().includes(search.toLowerCase()) ||
      log.work_instruction?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "ALL" || log.action === actionFilter;
    const matchRole = roleFilter === "ALL" || log.role === roleFilter;
    const ts = new Date(log.timestamp).getTime();
    const matchStart = !startDate || ts >= new Date(startDate).getTime();
    const matchEnd = !endDate || ts <= new Date(endDate + "T23:59:59").getTime();
    return matchSearch && matchAction && matchRole && matchStart && matchEnd;
  });

  // CSV Export
  const exportCSV = () => {
    const headers = ["Timestamp", "User", "Role", "Work Instruction", "Action", "Detail"];
    const rows = filtered.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.user || "",
      log.role || "",
      log.work_instruction || "",
      log.action || "",
      (log.detail || "").replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <History sx={{ color: "#6366f1", fontSize: 28 }} />
            <Typography variant="h4" fontWeight={800} color="text.primary">
              Audit Trail
            </Typography>
          </Box>
          <Typography color="text.secondary" fontSize={14}>
            Complete chronological record of all operator activity, decisions, AI queries, and approvals.
          </Typography>
        </Box>
<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" startIcon={<Download />} onClick={exportCSV} sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none" }}>
            Export CSV
          </Button>
          <Tooltip title={viewMode === "table" ? "Switch to Timeline View" : "Switch to Table View"}>
            <IconButton onClick={() => setViewMode(viewMode === "table" ? "timeline" : "table")} sx={{ bgcolor: "background.paper", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              {viewMode === "table" ? <TimelineIcon /> : <TableChart />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh logs">
            <IconButton onClick={loadLogs} sx={{ bgcolor: "background.paper", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard icon={<LoginIcon />} label="Total Logins" value={totalLogins} color="#22c55e" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<Block />} label="Blocked Events" value={totalBlocked} color="#ef4444" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<SmartToy />} label="AI Queries" value={totalAI} color="#8b5cf6" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard icon={<FactCheck />} label="Decisions Made" value={totalDecisions} color="#6366f1" />
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid #e2e8f0", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Search user, action, detail..."
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ color: "#64748b", fontSize: 18 }} /></InputAdornment>
          }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Action Type</InputLabel>
          <Select value={actionFilter} onChange={e => setActionFilter(e.target.value)} label="Action Type" sx={{ borderRadius: 2 }}>
            {uniqueActions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
<FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} label="Role" sx={{ borderRadius: 2 }}>
            {uniqueRoles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          type="date"
          size="small"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          InputLabelProps={{ shrink: true }}
          label="From"
        />
        <TextField
          type="date"
          size="small"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          InputLabelProps={{ shrink: true }}
          label="To"
        />
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>
          {filtered.length} / {logs.length} events
        </Typography>
      </Paper>

{/* Table / Timeline */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : viewMode === "timeline" ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", p: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {filtered.map((log) => {
              const meta = getActionMeta(log.action);
              return (
                <Box key={log.id} sx={{ display: "flex", gap: 2 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: meta.color, mt: 0.5 }} />
                    <Box sx={{ width: 2, flex: 1, bgcolor: "divider", mt: 0.5 }} />
                  </Box>
                  <Box sx={{ flex: 1, pb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                      <Chip size="small" label={meta.label} sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11 }} />
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">• {log.user || "Unknown"}</Typography>
                      {log.work_instruction && (
                        <Typography variant="caption" color="text.secondary">• {log.work_instruction}</Typography>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                      {log.detail}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            {filtered.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
                No audit events match your filter criteria.
              </Typography>
            )}
          </Box>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <TableContainer sx={{ maxHeight: "calc(100vh - 420px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper" }}>Timestamp</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper" }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper" }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper" }}>Work Instruction</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper" }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, bgcolor: "background.paper", maxWidth: 300 }}>Detail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((log) => {
                  const meta = getActionMeta(log.action);
                  return (
                    <TableRow
                      key={log.id}
                      sx={{
                        "&:hover": { bgcolor: meta.bg },
                        borderLeft: `3px solid ${meta.color}`,
                        transition: "background 0.15s",
                      }}
                    >
                      <TableCell sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{
                            width: 28, height: 28, borderRadius: "50%",
                            bgcolor: meta.color + "20", color: meta.color,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                          }}>
                            {(log.user || "?")[0].toUpperCase()}
                          </Box>
                          <Typography fontSize={13} fontWeight={600}>{log.user}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.role || "—"}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: 11,
                            bgcolor: log.role === "admin" ? "#fef2f2" : log.role === "supervisor" ? "#fffbeb" : "#f0fdf4",
                            color: log.role === "admin" ? "#dc2626" : log.role === "supervisor" ? "#d97706" : "#16a34a",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary", maxWidth: 180 }}>
                        <Typography variant="caption" noWrap sx={{ display: "block", maxWidth: 180 }}>
                          {log.work_instruction || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<Box sx={{ color: meta.color + " !important", "& svg": { fontSize: "14px !important" } }}>{meta.icon}</Box>}
                          label={meta.label}
                          size="small"
                          sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 11, border: `1px solid ${meta.color}30` }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="caption" sx={{ wordBreak: "break-word", color: "text.secondary", lineHeight: 1.5 }}>
                          {log.detail}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      No audit events match your filter criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Layout>
  );
}
