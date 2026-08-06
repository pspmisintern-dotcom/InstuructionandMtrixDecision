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
} from "@mui/icons-material";
import Layout from "../../../components/Layout";
import { workInstructionApi, decisionApi, inspectionApi } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const steps = [
  "Pre-start Inspection",
  "Decision Matrix",
  "Procedure",
  "Inspection",
  "Approval",
  "Complete",
];

export default function WorkInstructionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [wi, setWi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [preStartOk, setPreStartOk] = useState(false);
  const [inspectionOk, setInspectionOk] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [processData, setProcessData] = useState({
    humidity: "",
    surface_roughness_ok: true,
    coating_thickness_status: "ok",
    torch_ignition_ok: true,
    component_damaged: false,
    ppe_confirmed: false,
    pre_start_ok: false,
  });
const [inspmeasurements, setInspMeasurements] = useState({});
  const [completedAt, setCompletedAt] = useState("");

  useEffect(() => {
    const fetchWi = async () => {
      try {
        const res = await workInstructionApi.get(id);
        setWi(res.data);
        // PPE is inherently confirmed when opening the approved instruction.
        setProcessData((prev) => ({ ...prev, ppe_confirmed: true }));
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

  const isInwardOrChallan =
    /inward|challan|incoming|receiving|goods receipt/i.test(getWorkLabel());

  const handleDecision = async () => {
    setError("");
    try {
      const workValue = getWorkLabel();
      const res = await decisionApi.evaluate(workValue, processData);
      setDecisions(res.data.triggered);
      const hasBlock = res.data.triggered.some((d) => d.action_type === "block");
      if (hasBlock) {
        const blockRule = res.data.triggered.find((d) => d.action_type === "block");
        setBlocked(true);
        setBlockReason(blockRule?.message || "Workflow blocked by decision rule");
      } else {
        setBlocked(false);
        setActiveStep(2); // proceed to process steps
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
    } catch (err) {
      setError(err.response?.data?.detail || "Inspection submission failed");
    }
  };

const handleComplete = () => {
    setCompletedAt(new Date().toLocaleString());
    setActiveStep(5);
  };

const openDocument = async () => {
    setError("");
    try {
      // Fetch the original DOCX through the authenticated API client (attaches JWT),
      // then open it as a blob URL in a new tab.
      const res = await workInstructionApi.file(wi.id);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        // Fallback: trigger a download if popups are blocked.
        const link = document.createElement("a");
        link.href = url;
        link.download = `${wi.wi_number || "document"}.docx`;
        link.click();
      }
      // Revoke the object URL after a short delay to free memory.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to open document");
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8, minHeight: "calc(100vh - 64px)" }}>
          <CircularProgress color="primary" />
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

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Pre-start Inspection
        return (
          <Paper
            sx={{
              p: 4,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <TravelExplore color="primary" />
              <Typography variant="h6" sx={{ color: "#1e3a8a", fontWeight: 700 }}>
                Pre-start Inspection
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Typography color="text.secondary" sx={{ mb: 3, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {wi.pre_start_checks || wi.prerequisites || "Validate the machine and environment before the decision matrix evaluation."}
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
              sx={{ px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
            >
              Mark Pre-start Complete
            </Button>
          </Paper>
        );
      case 1: // Decision matrix
        return (
          <Paper
            sx={{
              p: 4,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Build color="secondary" />
              <Typography variant="h6" sx={{ color: "#1e3a8a", fontWeight: 700 }}>
                Decision Matrix
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              This decision matrix is specific to this instruction and the selected process. It evaluates the current environment, PPE confirmation, and pre-start status against the applicable rules.
            </Typography>
<Chip label={`Process: ${getWorkLabel()}`} color="info" sx={{ mb: 3 }} />
            {isInwardOrChallan ? (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Challan Number"
                    value={processData.challan_number || ""}
                    onChange={(e) => setProcessData({ ...processData, challan_number: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Supplier Verified"
                    value={String(processData.supplier_verified ?? true)}
                    onChange={(e) => setProcessData({ ...processData, supplier_verified: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Documents Verified"
                    value={String(processData.documents_verified ?? true)}
                    onChange={(e) => setProcessData({ ...processData, documents_verified: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Quantity Mismatch"
                    value={String(processData.quantity_mismatch ?? false)}
                    onChange={(e) => setProcessData({ ...processData, quantity_mismatch: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Packing OK"
                    value={String(processData.packing_ok ?? true)}
                    onChange={(e) => setProcessData({ ...processData, packing_ok: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Surface Rust / Corrosion"
                    value={String(processData.surface_rust ?? false)}
                    onChange={(e) => setProcessData({ ...processData, surface_rust: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Dimension OK"
                    value={String(processData.dimension_ok ?? true)}
                    onChange={(e) => setProcessData({ ...processData, dimension_ok: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Weight Mismatch"
                    value={String(processData.weight_mismatch ?? false)}
                    onChange={(e) => setProcessData({ ...processData, weight_mismatch: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Destination Mismatch"
                    value={String(processData.destination_mismatch ?? false)}
                    onChange={(e) => setProcessData({ ...processData, destination_mismatch: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </TextField>
                </Grid>
              </Grid>
            ) : (
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
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Torch Ignition OK"
                    value={String(processData.torch_ignition_ok)}
                    onChange={(e) => setProcessData({ ...processData, torch_ignition_ok: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    select
                    label="Component Damaged"
                    value={String(processData.component_damaged)}
                    onChange={(e) => setProcessData({ ...processData, component_damaged: e.target.value === "true" })}
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </TextField>
                </Grid>
              </Grid>
            )}
            {isInwardOrChallan && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info">
                  This is an Inward / Challan process. Ensure supplier, documents, and physical verifications are complete before proceeding.
                </Alert>
              </Box>
            )}
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={handleDecision}
              sx={{ mt: 3, px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
            >
              Evaluate Decision Matrix
            </Button>

            {decisions.length > 0 && (
              <Box sx={{ mt: 3 }}>
                {decisions.map((d, i) => (
                  <Alert
                    key={i}
                    severity={d.action_type === "block" ? "error" : d.action_type === "notify" ? "warning" : "info"}
                    sx={{ mb: 1 }}
                  >
                    <strong>{d.rule}:</strong> {d.message}
                  </Alert>
                ))}
              </Box>
            )}
          </Paper>
        );
      case 2: // Procedure
        return (
          <Paper
            sx={{
              p: 4,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Description color="primary" />
              <Typography variant="h6" sx={{ color: "#1e3a8a", fontWeight: 700 }}>
                Procedure & Key Requirements
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {wi.procedure || "No procedure text is available for this instruction."}
            </Typography>
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#1e3a8a" }}>
                Machine Parameters
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, mt: 1 }}>
                {wi.machine_parameters || "Not specified"}
              </Typography>
            </Box>
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#1e3a8a" }}>
                Inspection & Quality Requirements
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, mt: 1 }}>
                {wi.inspection || wi.quality_requirements || "Not specified"}
              </Typography>
            </Box>
            {wi.shutdown_procedure && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#1e3a8a" }}>
                  Shutdown Procedure
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, mt: 1 }}>
                  {wi.shutdown_procedure}
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 4, display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<FactCheck />}
                onClick={() => setActiveStep(3)}
                sx={{ px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
              >
                Begin Inspection
              </Button>
              <Button
                variant="outlined"
                color="info"
                size="large"
                startIcon={<SmartToy />}
                onClick={() => router.push(`/ai?wi=${wi.id}`)}
                sx={{ px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
              >
                Ask AI Assistant
              </Button>
            </Box>
          </Paper>
        );
      case 3: // Inspection
        return (
          <Paper
            sx={{
              p: 4,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Gavel color="primary" />
              <Typography variant="h6" sx={{ color: "#1e3a8a", fontWeight: 700 }}>
                Inspection & Quality
              </Typography>
            </Box>
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Surface Roughness (Ra)"
                  value={inspmeasurements.roughness || ""}
                  onChange={(e) => setInspMeasurements({ ...inspmeasurements, roughness: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmitInspection}
              sx={{ mt: 3, px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
            >
              Submit Inspection
            </Button>
          </Paper>
        );
      case 4: // Approval
        return (
          <Paper
            sx={{
              p: 4,
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: "#1e3a8a", fontWeight: 700 }}>
              Final Approval
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              {wi.supervisor_approval_required && "Supervisor approval required. "}
              {wi.qa_approval_required && "QA approval required."}
              {!wi.supervisor_approval_required && !wi.qa_approval_required && "No additional approval required."}
            </Alert>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<CheckCircle />}
              onClick={handleComplete}
              sx={{ px: 4, py: 1.2, textTransform: "none", fontWeight: 700 }}
            >
              Complete Work
            </Button>
          </Paper>
        );
      case 5: // Complete
        return (
          <Paper
            sx={{
              p: 5,
              textAlign: "center",
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 3,
              boxShadow: "0 20px 40px rgba(30, 58, 138, 0.08)",
            }}
          >
            <Check sx={{ fontSize: 64, color: "success.main" }} />
            <Typography variant="h4" fontWeight={800} sx={{ mt: 2, color: "#1e3a8a" }}>
              Work Instruction Complete!
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {wi.title} ({wi.wi_number}) has been completed successfully.
            </Typography>
<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Operator: {user?.full_name} | {completedAt}
            </Typography>
            <Button
              variant="outlined"
              size="large"
              sx={{ mt: 3, px: 4, textTransform: "none", fontWeight: 700 }}
              onClick={() => router.push("/workinstructions")}
            >
              Back to Work Instructions
            </Button>
          </Paper>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <Button
        variant="text"
        startIcon={<ArrowBack />}
        onClick={() => router.push("/workinstructions")}
        sx={{ mb: 2, textTransform: "none", fontWeight: 600, color: "#1e3a8a" }}
      >
        Back to Work Instructions
      </Button>

      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: "0 24px 50px rgba(30, 58, 138, 0.12)",
          overflow: "hidden",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              justifyContent: "space-between",
              gap: 3,
              color: "#ffffff",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Chip
                  label={wi.department || "General"}
                  sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }}
                />
                {wi.activity && (
                  <Chip label={wi.activity} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700 }} />
                )}
                <Chip label={`Rev ${wi.revision || "-"}`} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700 }} />
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5 }}>
                {wi.wi_number || "WI"} — {wi.title}
              </Typography>
              <Typography sx={{ opacity: 0.9, maxWidth: 760, whiteSpace: "pre-line", lineHeight: 1.8 }}>
                {wi.scope || "A clear, structured work instruction for safe operation, quality checks, and process control."}
              </Typography>
            </Box>

            <Box sx={{ display: "grid", gap: 2, width: { xs: "100%", sm: 280 }, alignSelf: "start" }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Description />}
                onClick={openDocument}
                sx={{
                  bgcolor: "#ffffff",
                  color: "#1e3a8a",
                  py: 1.5,
                  fontWeight: 800,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#e2e8f0" },
                }}
              >
                Open Document
              </Button>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 2 }}>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  WI Number
                </Typography>
                <Typography fontWeight={700}>{wi.wi_number || "-"}</Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "rgba(255,255,255,0.12)", color: "#fff", borderRadius: 2 }}>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  Approval
                </Typography>
                <Typography fontWeight={700}>
                  {wi.supervisor_approval_required || wi.qa_approval_required ? "Required" : "Not Required"}
                </Typography>
              </Paper>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {blocked && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Warning /> {blockReason}
        </Alert>
      )}

      <Card sx={{ p: 3, mb: 3, borderRadius: 3, boxShadow: "0 14px 30px rgba(30, 58, 138, 0.06)" }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ flexWrap: "wrap" }}>
          {steps.map((label, idx) => (
            <Step key={label} completed={idx < activeStep}>
              <StepLabel sx={{ color: idx === activeStep ? "primary.main" : "text.secondary" }}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>

      {renderStepContent()}
    </Layout>
  );
}
