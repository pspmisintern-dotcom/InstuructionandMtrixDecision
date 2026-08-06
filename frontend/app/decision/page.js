"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  AccountTree,
  CheckCircle,
  Warning,
  Block,
  Add,
  Delete,
  Edit,
  ExpandMore,
  Gavel,
  Speed,
  Assessment,
  Info,
  Refresh,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { decisionApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

// Process groups with their specific parameter sets
const PROCESS_CONFIG = {
  "Blasting": {
    group: "Surface Preparation",
    color: "#f59e0b",
    params: [
      { key: "humidity", label: "Humidity (%)", type: "number", placeholder: "e.g. 65" },
      { key: "surface_roughness_ok", label: "Surface Roughness", type: "bool" },
      { key: "moisture_in_gun", label: "Moisture in Blasting Gun", type: "bool_inverse" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
      { key: "air_pressure_ok", label: "Air Pressure OK", type: "bool" },
    ]
  },
  "Plasma": {
    group: "Thermal Spray",
    color: "#6366f1",
    params: [
      { key: "torch_ignition_ok", label: "Torch Ignition OK", type: "bool" },
      { key: "powder_feeder_ok", label: "Powder Feeder OK", type: "bool" },
      { key: "humidity", label: "Humidity (%)", type: "number", placeholder: "e.g. 60" },
      { key: "coating_thickness_status", label: "Coating Thickness", type: "select", options: ["ok", "low", "high"] },
      { key: "surface_roughness_ok", label: "Surface Roughness OK", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
    ]
  },
  "HVOF": {
    group: "Thermal Spray",
    color: "#ef4444",
    params: [
      { key: "torch_ignition_ok", label: "Torch Ignition OK", type: "bool" },
      { key: "gas_flow_ok", label: "Gas Flow / Pressure OK", type: "bool" },
      { key: "humidity", label: "Humidity (%)", type: "number", placeholder: "e.g. 60" },
      { key: "coating_thickness_status", label: "Coating Thickness", type: "select", options: ["ok", "low", "high"] },
      { key: "surface_roughness_ok", label: "Surface Roughness OK", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
    ]
  },
  "TWAS": {
    group: "Thermal Spray",
    color: "#ec4899",
    params: [
      { key: "arc_voltage_ok", label: "Arc Voltage OK", type: "bool" },
      { key: "wire_feed_ok", label: "Wire Feed OK", type: "bool" },
      { key: "coating_thickness_status", label: "Coating Thickness", type: "select", options: ["ok", "low", "high"] },
      { key: "surface_roughness_ok", label: "Surface Roughness OK", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
    ]
  },
"Grinding": {
    group: "Finishing",
    color: "#22c55e",
    params: [
      { key: "surface_roughness_ok", label: "Surface Roughness OK", type: "bool" },
      { key: "dimension_ok", label: "Dimension OK", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
      { key: "coolant_ok", label: "Coolant Flow OK", type: "bool" },
    ]
  },
  "Cleaning": {
    group: "Surface Preparation",
    color: "#0ea5e9",
    params: [
      { key: "solvent_compatible", label: "Solvent / Agent Compatible", type: "bool" },
      { key: "cleaning_complete", label: "Cleaning Complete", type: "bool" },
      { key: "residue_free", label: "Surface Residue-Free", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
      { key: "humidity", label: "Humidity (%)", type: "number", placeholder: "e.g. 55" },
    ]
  },
  "Removal of Old Coating": {
    group: "Surface Preparation",
    color: "#f97316",
    params: [
      { key: "surface_roughness_ok", label: "Surface Clean & Rough OK", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
      { key: "chemical_ok", label: "Chemical / Stripper OK", type: "bool" },
      { key: "humidity", label: "Humidity (%)", type: "number", placeholder: "e.g. 55" },
    ]
  },
  "Masking": {
    group: "Process Control",
    color: "#14b8a6",
    params: [
      { key: "masking_complete", label: "Masking Complete", type: "bool" },
      { key: "masking_secure", label: "Masking Secure / No Gaps", type: "bool" },
      { key: "component_damaged", label: "Component Damaged", type: "bool_inverse" },
    ]
  },
  "Inward / Outward Challan": {
    group: "Logistics",
    color: "#3b82f6",
    params: [
      { key: "challan_number", label: "Challan / DC Number", type: "text", placeholder: "e.g. DC-2024-001" },
      { key: "supplier_verified", label: "Supplier / Customer Verified", type: "bool" },
      { key: "documents_verified", label: "Documents Verified (PO/Invoice)", type: "bool" },
      { key: "quantity_mismatch", label: "Quantity Mismatch", type: "bool_inverse" },
      { key: "packing_ok", label: "Packing / Condition OK", type: "bool" },
      { key: "surface_rust", label: "Surface Rust / Corrosion", type: "bool_inverse" },
      { key: "dimension_ok", label: "Dimension Check OK", type: "bool" },
      { key: "weight_mismatch", label: "Weight Mismatch", type: "bool_inverse" },
      { key: "destination_mismatch", label: "Destination Mismatch", type: "bool_inverse" },
    ]
  },
};

const ALL_PROCESSES = Object.keys(PROCESS_CONFIG);

function computeRiskScore(triggered) {
  if (!triggered || triggered.length === 0) return 0;
  let score = 0;
  triggered.forEach(r => {
    if (r.action_type === "block") score += 35;
    else if (r.action_type === "notify") score += 15;
    else score += 5;
  });
  return Math.min(score, 100);
}

function RiskMeter({ score }) {
  const color = score === 0 ? "#22c55e" : score < 30 ? "#f59e0b" : score < 60 ? "#f97316" : "#ef4444";
  const label = score === 0 ? "✅ ALL CLEAR" : score < 30 ? "⚠️ NEEDS REVIEW" : score < 60 ? "🔶 HIGH RISK" : "🚫 BLOCKED";
  const verdict = score === 0 ? "✅ APPROVED" : score < 30 ? "✅ APPROVED" : score < 60 ? "⚠️ NEEDS REVIEW" : "🚫 BLOCKED";
  const verdictColor = score < 30 ? "#22c55e" : score < 60 ? "#f59e0b" : "#ef4444";

  return (
    <Box sx={{ p: 3, borderRadius: 3, border: `2px solid ${color}30`, bgcolor: color + "10" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">RISK SCORE</Typography>
        <Typography variant="h4" fontWeight={900} color={color}>{score}</Typography>
      </Box>
      <Box sx={{
        mb: 2, p: 1.5, borderRadius: 2, textAlign: "center",
        bgcolor: verdictColor + "15", border: `1px solid ${verdictColor}40`,
      }}>
        <Typography variant="subtitle1" fontWeight={900} fontSize={16} color={verdictColor}>
          {verdict}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          height: 10, borderRadius: 5, bgcolor: "#e2e8f0",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 5 },
          mb: 1.5,
        }}
      />
      <Chip
        label={label}
        sx={{ bgcolor: color, color: "#fff", fontWeight: 800, fontSize: 13, width: "100%", borderRadius: 2 }}
      />
    </Box>
  );
}

export default function DecisionPage() {
  const { hasRole } = useAuth();
  const [rules, setRules] = useState([]);
  const [process, setProcess] = useState("Blasting");
  const [paramValues, setParamValues] = useState({});
const [results, setResults] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRule, setNewRule] = useState({ name: "", work: "*", condition_field: "", condition_operator: "==", condition_value: "", action_type: "notify", action_detail: "" });

  const config = PROCESS_CONFIG[process];

  useEffect(() => {
    loadRules();
  }, []);

  // Initialize default param values when process changes
  useEffect(() => {
    const defaults = {};
    config.params.forEach(p => {
      if (p.type === "bool") defaults[p.key] = "true";
      else if (p.type === "bool_inverse") defaults[p.key] = "false";
      else if (p.type === "select") defaults[p.key] = p.options[0];
      else defaults[p.key] = "";
    });
setParamValues(defaults);
    setResults(null);
    setRiskScore(null);
  }, [process]);

  const loadRules = async () => {
    try {
      const res = await decisionApi.listRules();
      setRules(res.data);
    } catch { setRules([]); }
  };

const handleEvaluate = async () => {
    setLoading(true);
    setError("");
    try {
      // Map API work name (Inward/Challan handled as single)
      const apiWork = process === "Inward / Outward Challan" ? "Inward" : process;
      // Convert bool strings
      const payload = {};
      config.params.forEach(p => {
        const val = paramValues[p.key];
        if (p.type === "bool" || p.type === "bool_inverse") payload[p.key] = val === "true";
        else if (p.type === "number") payload[p.key] = val;
        else payload[p.key] = val;
      });
      const res = await decisionApi.evaluate(apiWork, payload);
      setResults(res.data.triggered);
      setRiskScore(res.data.risk_score ?? computeRiskScore(res.data.triggered));
    } catch (err) {
      setError(err.response?.data?.detail || "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

const handleDeleteRule = async (id) => {
    try {
      await decisionApi.deleteRule(id);
      loadRules();
    } catch {}
  };

  const handleStartEdit = (rule) => {
    setEditingRule(rule);
    setNewRule({
      name: rule.name,
      work: rule.work,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      action_type: rule.action_type,
      action_detail: rule.action_detail,
    });
    setShowRuleDialog(true);
  };

  const handleUpdateRule = async () => {
    try {
      await decisionApi.updateRule(editingRule.id, newRule);
      setShowRuleDialog(false);
      setEditingRule(null);
      setNewRule({ name: "", work: "*", condition_field: "", condition_operator: "==", condition_value: "", action_type: "notify", action_detail: "" });
      loadRules();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update rule");
    }
  };

  const handleCreateRule = async () => {
    try {
      await decisionApi.createRule(newRule);
      setShowRuleDialog(false);
      setNewRule({ name: "", work: "*", condition_field: "", condition_operator: "==", condition_value: "", action_type: "notify", action_detail: "" });
      loadRules();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create rule");
    }
  };

const setParam = (key, val) => setParamValues(prev => ({ ...prev, [key]: val }));

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <AccountTree sx={{ color: "#6366f1", fontSize: 28 }} />
            <Typography variant="h4" fontWeight={800} color="text.primary">Decision Matrix Engine</Typography>
          </Box>
          <Typography color="text.secondary" fontSize={14}>
            Advanced rule-based process evaluation with real-time risk scoring and actionable recommendations.
          </Typography>
        </Box>
        {hasRole("admin", "supervisor") && (
<Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => { setEditingRule(null); setNewRule({ name: "", work: "*", condition_field: "", condition_operator: "==", condition_value: "", action_type: "notify", action_detail: "" }); setShowRuleDialog(true); }}
            sx={{ borderRadius: 2, fontWeight: 700, bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}
          >
            Add Rule
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Left: Evaluation Panel */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Speed sx={{ color: "#6366f1" }} /> Evaluate Process Conditions
            </Typography>

            {/* Process Selector */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Process / Work Activity</InputLabel>
              <Select
                value={process}
                onChange={e => setProcess(e.target.value)}
                label="Process / Work Activity"
                sx={{ borderRadius: 2 }}
              >
                {ALL_PROCESSES.map(p => (
                  <MenuItem key={p} value={p}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PROCESS_CONFIG[p].color }} />
                      {p}
                      <Chip label={PROCESS_CONFIG[p].group} size="small" sx={{ fontSize: 10, ml: "auto", bgcolor: PROCESS_CONFIG[p].color + "20", color: PROCESS_CONFIG[p].color }} />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ mb: 2 }} />

            {/* Dynamic Parameters */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
              {config.params.map(param => (
                <Box key={param.key}>
                  {(param.type === "bool" || param.type === "bool_inverse") ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{param.label}</InputLabel>
                      <Select
                        value={paramValues[param.key] || "true"}
                        onChange={e => setParam(param.key, e.target.value)}
                        label={param.label}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="true">{param.type === "bool_inverse" ? "❌ Yes" : "✅ Yes / OK"}</MenuItem>
                        <MenuItem value="false">{param.type === "bool_inverse" ? "✅ No" : "❌ No / Fail"}</MenuItem>
                      </Select>
                    </FormControl>
                  ) : param.type === "select" ? (
                    <FormControl fullWidth size="small">
                      <InputLabel>{param.label}</InputLabel>
                      <Select
                        value={paramValues[param.key] || param.options[0]}
                        onChange={e => setParam(param.key, e.target.value)}
                        label={param.label}
                        sx={{ borderRadius: 2 }}
                      >
                        {param.options.map(o => <MenuItem key={o} value={o}>{o.toUpperCase()}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      size="small"
                      label={param.label}
                      placeholder={param.placeholder || ""}
                      value={paramValues[param.key] || ""}
                      onChange={e => setParam(param.key, e.target.value)}
                      type={param.type === "number" ? "number" : "text"}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  )}
                </Box>
              ))}
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleEvaluate}
              disabled={loading}
              sx={{
                py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 15,
                bgcolor: config.color,
                "&:hover": { bgcolor: config.color, filter: "brightness(0.9)" },
                boxShadow: `0 8px 24px ${config.color}40`,
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "▶ Evaluate Rules"}
            </Button>
          </Paper>
        </Grid>

        {/* Right: Results + Rules */}
        <Grid item xs={12} md={7}>
          {/* Result Panel */}
          {results !== null && (
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0", mb: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Assessment sx={{ color: "#6366f1" }} /> Evaluation Results
              </Typography>

              <RiskMeter score={riskScore} />

              {results.length === 0 ? (
                <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                  <strong>All Clear!</strong> No rules triggered. Process conditions are within acceptable parameters.
                </Alert>
              ) : (
                <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 0.5 }}>
                    TRIGGERED RULES ({results.length})
                  </Typography>
                  {results.map((r, i) => (
                    <Alert
                      key={i}
                      severity={r.action_type === "block" ? "error" : r.action_type === "notify" ? "warning" : "info"}
                      sx={{ borderRadius: 2 }}
                      icon={r.action_type === "block" ? <Block /> : r.action_type === "notify" ? <Warning /> : <Info />}
                    >
                      <Typography fontWeight={700} fontSize={13}>{r.rule}</Typography>
                      <Typography fontSize={13} sx={{ mt: 0.5 }}>{r.message}</Typography>
                    </Alert>
                  ))}

                  {/* Recommendations */}
                  <Paper sx={{ p: 2, mt: 1, bgcolor: "#0f172a", borderRadius: 2 }}>
                    <Typography variant="caption" fontWeight={800} color="#94a3b8" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                      Recommended Actions
                    </Typography>
                    {results.filter(r => r.action_type === "block").length > 0 && (
                      <Typography color="#f87171" fontSize={13} sx={{ mt: 0.5 }}>
                        🚫 STOP: Do not proceed. Address all blocking issues before resuming.
                      </Typography>
                    )}
                    {results.filter(r => r.action_type === "notify").length > 0 && (
                      <Typography color="#fbbf24" fontSize={13} sx={{ mt: 0.5 }}>
                        ⚠️ NOTIFY: Inform supervisor and document the deviation before proceeding.
                      </Typography>
                    )}
                    {results.filter(r => r.action_type === "info").length > 0 && (
                      <Typography color="#60a5fa" fontSize={13} sx={{ mt: 0.5 }}>
                        ℹ️ NOTE: Log the observation in the process record and monitor.
                      </Typography>
                    )}
                  </Paper>
                </Box>
              )}
            </Paper>
          )}

          {/* Configured Rules Table */}
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" }}>
              <Typography variant="h6" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Gavel sx={{ color: "#6366f1", fontSize: 20 }} /> Configured Rules
                <Chip label={rules.length} size="small" sx={{ bgcolor: "#eef2ff", color: "#6366f1", fontWeight: 700 }} />
              </Typography>
              <Tooltip title="Refresh rules">
                <IconButton size="small" onClick={loadRules}><Refresh fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
            <TableContainer sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", bgcolor: "background.paper" }}>Rule Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", bgcolor: "background.paper" }}>Process</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", bgcolor: "background.paper" }}>Condition</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", bgcolor: "background.paper" }}>Type</TableCell>
                    {hasRole("admin") && <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", bgcolor: "background.paper" }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map(rule => (
                    <TableRow key={rule.id} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{rule.name}</TableCell>
                      <TableCell>
                        <Chip label={rule.work === "*" ? "All" : rule.work} size="small" sx={{ fontSize: 10, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: "text.secondary", maxWidth: 180 }}>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {rule.condition_field} {rule.condition_operator} {rule.condition_value}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rule.action_type}
                          size="small"
                          color={rule.action_type === "block" ? "error" : rule.action_type === "notify" ? "warning" : "info"}
                          sx={{ fontWeight: 700, fontSize: 10 }}
                        />
                      </TableCell>
{(hasRole("admin") || hasRole("supervisor")) && (
                        <TableCell>
                          <IconButton size="small" color="primary" onClick={() => handleStartEdit(rule)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          {hasRole("admin") && (
                            <IconButton size="small" color="error" onClick={() => handleDeleteRule(rule.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {rules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary", fontSize: 13 }}>
                        No rules configured. Add rules using the button above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Add Rule Dialog */}
<Dialog open={showRuleDialog} onClose={() => { setShowRuleDialog(false); setEditingRule(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingRule ? "✏️ Edit Decision Rule" : "➕ Create New Decision Rule"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField label="Rule Name" value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} fullWidth size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Process</InputLabel>
            <Select value={newRule.work} onChange={e => setNewRule(p => ({ ...p, work: e.target.value }))} label="Process">
              <MenuItem value="*">All Processes</MenuItem>
              {ALL_PROCESSES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <Grid container spacing={1.5}>
            <Grid item xs={5}>
              <TextField label="Condition Field" value={newRule.condition_field} onChange={e => setNewRule(p => ({ ...p, condition_field: e.target.value }))} fullWidth size="small" placeholder="e.g. humidity" />
            </Grid>
            <Grid item xs={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Operator</InputLabel>
                <Select value={newRule.condition_operator} onChange={e => setNewRule(p => ({ ...p, condition_operator: e.target.value }))} label="Operator">
                  {[">", "<", ">=", "<=", "==", "!="].map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField label="Value" value={newRule.condition_value} onChange={e => setNewRule(p => ({ ...p, condition_value: e.target.value }))} fullWidth size="small" placeholder="e.g. 85" />
            </Grid>
          </Grid>
          <FormControl fullWidth size="small">
            <InputLabel>Action Type</InputLabel>
            <Select value={newRule.action_type} onChange={e => setNewRule(p => ({ ...p, action_type: e.target.value }))} label="Action Type">
              <MenuItem value="block">🚫 Block (Stop Process)</MenuItem>
              <MenuItem value="notify">⚠️ Notify (Inform Supervisor)</MenuItem>
              <MenuItem value="info">ℹ️ Info (Log & Monitor)</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Action Message / Detail" value={newRule.action_detail} onChange={e => setNewRule(p => ({ ...p, action_detail: e.target.value }))} fullWidth size="small" multiline rows={2} placeholder="Describe what to do when this rule triggers..." />
        </DialogContent>
<DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => { setShowRuleDialog(false); setEditingRule(null); }}>Cancel</Button>
          <Button variant="contained" onClick={editingRule ? handleUpdateRule : handleCreateRule} sx={{ bgcolor: "#6366f1" }}>
            {editingRule ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
