"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
Alert,
  Paper,
  Divider,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ArrowBack,
  Check,
  Warning,
  SmartToy,
Description,
  FactCheck,
  TravelExplore,
  Build,
  Gavel,
  CheckCircle,
  Shield,
  Construction,
  Tune,
  PowerSettingsNew,
  AssignmentTurnedIn,
  PlayArrow,
} from "@mui/icons-material";
import Layout from "../../../components/Layout";
import { workInstructionApi, decisionApi, inspectionApi } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const steps = [
  "Pre-start Inspection",
  "Decision Matrix",
  "Procedure Check",
  "Inspection Submission",
  "Complete",
];

// Renders text that has "1. Step one\n2. Step two" format as visual step cards
function renderSteps(text, accentColor = "#1e3a8a") {
  if (!text) return null;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // Check if it looks like numbered steps
  const isNumbered = lines.some((l) => /^\d+\.\s/.test(l));
  if (!isNumbered) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#334155" }}>
        {text}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {lines.map((line, idx) => {
        const match = line.match(/^(\d+)\.\s+(.*)$/);
        const stepNum = match ? match[1] : String(idx + 1);
        const stepText = match ? match[2] : line;
        return (
          <Box
            key={idx}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 2,
              p: 1.8,
              borderRadius: 2,
              bgcolor: "#f8fafc",
              border: "1px solid #e2e8f0",
              transition: "box-shadow 0.2s",
              "&:hover": { boxShadow: "0 4px 12px rgba(30,58,138,0.08)", bgcolor: "#eff6ff" },
            }}
          >
            <Box
              sx={{
                minWidth: 32,
                height: 32,
                borderRadius: "50%",
                bgcolor: accentColor,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 13,
                flexShrink: 0,
                mt: 0.1,
              }}
            >
              {stepNum}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.75, color: "#1e293b", fontWeight: 500, pt: 0.4 }}>
              {stepText}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// Strip any lingering 'Work Instruction for' or 'Work Instruction' prefix from title
function cleanTitle(title) {
  if (!title) return title;
  return title.replace(/^Work Instruction(s)? for /i, "").replace(/^Work Instruction(s)?:?\s*/i, "").trim();
}

export default function WorkInstructionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [wi, setWi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tab state: 0 = Full Document View, 1 = Interactive Execution Workflow
  const [tabValue, setTabValue] = useState(0);

  // Interactive execution workflow states
  const [activeStep, setActiveStep] = useState(0);
  const [preStartOk, setPreStartOk] = useState(false);
  const [inspectionOk, setInspectionOk] = useState(true);
  const [decisions, setDecisions] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [processData, setProcessData] = useState({
    humidity: "",
    surface_roughness_ok: true,
    coating_thickness_status: "ok",
    torch_ignition_ok: true,
    component_damaged: false,
    ppe_confirmed: true,
    pre_start_ok: false,
  });
  const [inspmeasurements, setInspMeasurements] = useState({});
  const [completedAt, setCompletedAt] = useState("");

  useEffect(() => {
    const fetchWi = async () => {
      try {
        const res = await workInstructionApi.get(id);
        setWi(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load work instruction");
      } finally {
        setLoading(false);
      }
    };
    fetchWi();
  }, [id]);

  const getWorkLabel = () => {
    return wi?.activity || wi?.department || wi?.title || "*";
  };

  const isInwardOrChallan = /inward|challan|incoming|receiving|goods receipt/i.test(getWorkLabel());

  const handleDecision = async () => {
    setError("");
    try {
      const workValue = getWorkLabel();
      const res = await decisionApi.evaluate(workValue, processData);
      setDecisions(res.data.triggered || []);
      const hasBlock = res.data.triggered?.some((d) => d.action_type === "block");
      if (hasBlock) {
        const blockRule = res.data.triggered.find((d) => d.action_type === "block");
        setBlocked(true);
        setBlockReason(blockRule?.message || "Workflow blocked by decision rule");
      } else {
        setBlocked(false);
        setActiveStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Decision evaluation failed");
    }
  };

  const handleSubmitInspection = async () => {
    setError("");
    try {
      await inspectionApi.submit({
        work_instruction_id: wi.id,
        result: inspectionOk ? "pass" : "fail",
        measurements: inspmeasurements,
        remarks: "",
        require_supervisor_approval: wi?.supervisor_approval_required,
        require_qa_approval: wi?.qa_approval_required,
      });
      setActiveStep(4);
      setCompletedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err.response?.data?.detail || "Inspection submission failed");
    }
  };

  const openDocument = async () => {
    setError("");
    try {
      const res = await workInstructionApi.file(wi.id);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${wi.wi_number || "document"}.docx`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to open document file");
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 12 }}>
          <CircularProgress color="primary" size={48} />
        </Box>
      </Layout>
    );
  }

  if (!wi) {
    return (
      <Layout>
        <Alert severity="error">{error || "Work Instruction not found"}</Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Top Navigation Back Action */}
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
          <Button
            variant="text"
            size="small"
            onClick={() => router.push("/")}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary", minWidth: "auto", p: 0.5 }}
          >
            Dashboard
          </Button>
          <Typography variant="body2" color="text.disabled" sx={{ fontSize: 14 }}>/</Typography>
          <Button
            variant="text"
            size="small"
            onClick={() => router.push("/workinstructions")}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary", minWidth: "auto", p: 0.5 }}
          >
            Work Instructions
          </Button>
          <Typography variant="body2" color="text.disabled" sx={{ fontSize: 14 }}>/</Typography>
          <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ fontSize: 14 }}>
            {wi?.wi_number || "Work Instruction"}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="info"
          startIcon={<SmartToy />}
          onClick={() => router.push(`/ai?wi=${wi.id}`)}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
        >
          Ask AI Assistant
        </Button>
      </Box>

      {/* Main Header Banner */}
      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0b1220 0%, #1e3a8a 100%)",
          color: "#ffffff",
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Chip label={wi.wi_number || "WI"} color="primary" sx={{ fontWeight: 800 }} />
                <Chip label={wi.department || "General"} sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }} />
                {wi.activity && (
                  <Chip label={wi.activity} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700 }} />
                )}
                <Chip label={`Rev: ${wi.revision || "Rev 1"}`} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700 }} />
              </Box>
              <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, letterSpacing: "-0.5px" }}>
                {cleanTitle(wi.title)}
              </Typography>
              <Typography sx={{ opacity: 0.9, maxWidth: 800, lineHeight: 1.7 }}>
                {wi.scope || "Standard operating procedures and quality guidelines for manufacturing compliance."}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "rgba(255,255,255,0.08)", p: 2.5, borderRadius: 2.5, border: "1px solid rgba(255,255,255,0.15)" }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Description />}
                  onClick={openDocument}
                  sx={{ bgcolor: "#ffffff", color: "#1e3a8a", py: 1.2, fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#f1f5f9" } }}
                >
                  Download DOCX File
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={() => setTabValue(1)}
                  sx={{ py: 1.2, fontWeight: 800, textTransform: "none" }}
                >
                  Start Execution Mode
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Main View Mode Selector Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid #e2e8f0" }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            icon={<Description />}
            iconPosition="start"
            label="Complete Work Instruction Document"
            sx={{ fontWeight: 700, py: 2, textTransform: "none", fontSize: 16 }}
          />
          <Tab
            icon={<PlayArrow />}
            iconPosition="start"
            label="Interactive Execution & Decision Matrix"
            sx={{ fontWeight: 700, py: 2, textTransform: "none", fontSize: 16 }}
          />
        </Tabs>
      </Paper>

      {/* TAB 0: Complete Work Instruction Document View */}
      {tabValue === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Key Parameters Quick Summary Bar */}
          <Grid container spacing={2}>
            {wi.ppe && (
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2.5, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#f8fafc", height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, color: "#1e3a8a" }}>
                    <Shield fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Required PPE
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {wi.ppe}
                  </Typography>
                </Paper>
              </Grid>
            )}
            {wi.tools_required && (
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2.5, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#f8fafc", height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, color: "#1e3a8a" }}>
                    <Construction fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Tools & Equipment
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {wi.tools_required}
                  </Typography>
                </Paper>
              </Grid>
            )}
            {wi.machine_parameters && (
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2.5, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#f8fafc", height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, color: "#1e3a8a" }}>
                    <Tune fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Machine Parameters
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {wi.machine_parameters}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>

{/* Quality & Inspection Controls */}
          <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Gavel color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h5" fontWeight={800} color="#0f172a">
                2. Inspection & Quality Acceptance
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight={700} color="#1e3a8a" sx={{ mb: 1 }}>
                  Inspection Protocol
                </Typography>
                {renderSteps(wi.inspection || wi.quality_requirements) || (
                  <Typography variant="body2" color="text.secondary">Perform visual and dimensional inspection per quality standards.</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight={700} color="#1e3a8a" sx={{ mb: 1 }}>
                  Acceptance Criteria
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#334155" }}>
                  {wi.acceptance_criteria || "All parameters must meet specified target ranges without surface or structural defects."}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Shutdown Procedure & Safety Notes */}
          <Grid container spacing={3}>
            {wi.shutdown_procedure && (
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff", height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "#dc2626" }}>
                    <PowerSettingsNew />
                    <Typography variant="h6" fontWeight={700}>
                      Shutdown Procedure
                    </Typography>
                  </Box>
                  {renderSteps(wi.shutdown_procedure, "#dc2626")}
                </Paper>
              </Grid>
            )}

            {wi.safety_notes && (
              <Grid item xs={12} md={wi.shutdown_procedure ? 6 : 12}>
                <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #fef3c7", bgcolor: "#fffbeb", height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "#d97706" }}>
                    <Warning />
                    <Typography variant="h6" fontWeight={700}>
                      Safety Notes & Warnings
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#92400e" }}>
                    {wi.safety_notes}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* TAB 1: Optional Interactive Execution Workflow Mode */}
      {tabValue === 1 && (
        <Box>
          <Card sx={{ p: 3, mb: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label, idx) => (
                <Step key={label} completed={idx < activeStep}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Card>

          {blocked && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Warning /> {blockReason}
            </Alert>
          )}

          {activeStep === 0 && (
            <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
              <Typography variant="h6" fontWeight={700} color="#1e3a8a" sx={{ mb: 2 }}>
                Step 1: Pre-start Inspection
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Typography color="text.secondary" sx={{ mb: 3, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                {wi.pre_start_checks || wi.prerequisites || "Verify machine parameters and environmental conditions before starting."}
              </Typography>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<Check />}
                onClick={() => {
                  setPreStartOk(true);
                  setProcessData((prev) => ({ ...prev, pre_start_ok: true }));
                  setActiveStep(1);
                }}
                sx={{ px: 4, py: 1.2, fontWeight: 700, textTransform: "none" }}
              >
                Mark Pre-start Inspection Complete
              </Button>
            </Paper>
          )}

          {activeStep === 1 && (
            <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
              <Typography variant="h6" fontWeight={700} color="#1e3a8a" sx={{ mb: 2 }}>
                Step 2: Decision Matrix Evaluation
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Chip label={`Process Target: ${getWorkLabel()}`} color="info" sx={{ mb: 3 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Humidity (%)"
                    type="number"
                    value={processData.humidity}
                    onChange={(e) => setProcessData({ ...processData, humidity: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Surface Roughness OK"
                    value={String(processData.surface_roughness_ok)}
                    onChange={(e) => setProcessData({ ...processData, surface_roughness_ok: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">OK</option>
                    <option value="false">NOT OK</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Coating Thickness"
                    value={processData.coating_thickness_status}
                    onChange={(e) => setProcessData({ ...processData, coating_thickness_status: e.target.value })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="ok">OK</option>
                    <option value="low">LOW</option>
                    <option value="high">HIGH</option>
                  </TextField>
                </Grid>
              </Grid>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                onClick={handleDecision}
                sx={{ mt: 3, px: 4, py: 1.2, fontWeight: 700, textTransform: "none" }}
              >
                Evaluate Decision Rules
              </Button>
              {decisions.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  {decisions.map((d, i) => (
                    <Alert key={i} severity={d.action_type === "block" ? "error" : "warning"} sx={{ mb: 1 }}>
                      <strong>{d.rule}:</strong> {d.message}
                    </Alert>
                  ))}
                </Box>
              )}
            </Paper>
          )}

          {activeStep === 2 && (
            <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
              <Typography variant="h6" fontWeight={700} color="#1e3a8a" sx={{ mb: 2 }}>
                Step 3: Procedure Check
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, mb: 3 }}>
                Verify all operating steps have been completed as per the approved Work Instruction before submitting the inspection record.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setActiveStep(3)}
                sx={{ px: 4, py: 1.2, fontWeight: 700, textTransform: "none" }}
              >
                Proceed to Inspection Submission
              </Button>
            </Paper>
          )}

          {activeStep === 3 && (
            <Paper sx={{ p: 4, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
              <Typography variant="h6" fontWeight={700} color="#1e3a8a" sx={{ mb: 2 }}>
                Step 4: Inspection Submission
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Inspection Result"
                    select
                    value={inspectionOk ? "pass" : "fail"}
                    onChange={(e) => setInspectionOk(e.target.value === "pass")}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Measured Dimension (mm)"
                    value={inspmeasurements.dimension || ""}
                    onChange={(e) => setInspMeasurements({ ...inspmeasurements, dimension: e.target.value })}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmitInspection}
                sx={{ mt: 3, px: 4, py: 1.2, fontWeight: 700, textTransform: "none" }}
              >
                Submit Inspection Record
              </Button>
            </Paper>
          )}

          {activeStep === 4 && (
            <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3, bgcolor: "#ffffff" }}>
              <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
              <Typography variant="h4" fontWeight={800} color="#1e3a8a" sx={{ mt: 2 }}>
                Work Instruction Execution Complete
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Completed by {user?.full_name} on {completedAt}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Layout>
  );
}
