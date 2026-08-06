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
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
} from "@mui/material";
import Layout from "../../components/Layout";
import { decisionApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function DecisionPage() {
  const { hasRole } = useAuth();
  const [rules, setRules] = useState([]);
const [work, setWork] = useState("Blasting");
  const [humidity, setHumidity] = useState("");
  const [roughnessOk, setRoughnessOk] = useState("true");
  const [coating, setCoating] = useState("ok");
  const [damaged, setDamaged] = useState("false");
  const [ignitionOk, setIgnitionOk] = useState("true");
  // Inward / Challan fields
  const [challanNumber, setChallanNumber] = useState("");
  const [supplierVerified, setSupplierVerified] = useState("true");
  const [documentsVerified, setDocumentsVerified] = useState("true");
  const [quantityMismatch, setQuantityMismatch] = useState("false");
  const [packingOk, setPackingOk] = useState("true");
  const [surfaceRust, setSurfaceRust] = useState("false");
  const [dimensionOk, setDimensionOk] = useState("true");
  const [weightMismatch, setWeightMismatch] = useState("false");
  const [destinationMismatch, setDestinationMismatch] = useState("false");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLogistics = work === "Inward" || work === "Challan";

  useEffect(() => {
    const loadRules = async () => {
      try {
        const res = await decisionApi.listRules();
        setRules(res.data);
      } catch {
        setRules([]);
      }
    };
    loadRules();
  }, []);

const handleEvaluate = async () => {
    setLoading(true);
    setError("");
    try {
      const baseData = {
        humidity: humidity,
        surface_roughness_ok: roughnessOk === "true",
        coating_thickness_status: coating,
        component_damaged: damaged === "true",
        torch_ignition_ok: ignitionOk === "true",
      };
      const logisticsData = {
        challan_number: challanNumber,
        supplier_verified: supplierVerified === "true",
        documents_verified: documentsVerified === "true",
        quantity_mismatch: quantityMismatch === "true",
        packing_ok: packingOk === "true",
        surface_rust: surfaceRust === "true",
        dimension_ok: dimensionOk === "true",
        weight_mismatch: weightMismatch === "true",
        destination_mismatch: destinationMismatch === "true",
      };
      const payload = isLogistics ? logisticsData : baseData;
      const res = await decisionApi.evaluate(work, payload);
      setResults(res.data.triggered);
    } catch (err) {
      setError(err.response?.data?.detail || "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Decision Matrix Engine
        </Typography>
        <Typography color="text.secondary">
          Configure and test decision rules for each process. The engine evaluates the selected work/process and the current operating data to return process-specific actions.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Evaluate Conditions
            </Typography>
            <TextField
              label="Work / Process"
              select
              value={work}
              onChange={(e) => setWork(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              SelectProps={{ native: true }}
            >
<option value="Blasting">Blasting</option>
              <option value="Plasma">Plasma</option>
              <option value="HVOF">HVOF</option>
              <option value="TWAS">TWAS</option>
              <option value="Grinding">Grinding</option>
              <option value="Inward">Inward</option>
              <option value="Challan">Challan</option>
              <option value="*">All</option>
            </TextField>
            {isLogistics ? (
              <>
                <TextField
                  label="Challan Number"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Supplier Verified?"
                  select
                  value={supplierVerified}
                  onChange={(e) => setSupplierVerified(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </TextField>
                <TextField
                  label="Documents Verified?"
                  select
                  value={documentsVerified}
                  onChange={(e) => setDocumentsVerified(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </TextField>
                <TextField
                  label="Quantity Mismatch?"
                  select
                  value={quantityMismatch}
                  onChange={(e) => setQuantityMismatch(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </TextField>
                <TextField
                  label="Packing OK?"
                  select
                  value={packingOk}
                  onChange={(e) => setPackingOk(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </TextField>
                <TextField
                  label="Surface Rust / Corrosion?"
                  select
                  value={surfaceRust}
                  onChange={(e) => setSurfaceRust(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </TextField>
                <TextField
                  label="Dimension OK?"
                  select
                  value={dimensionOk}
                  onChange={(e) => setDimensionOk(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </TextField>
                <TextField
                  label="Weight Mismatch?"
                  select
                  value={weightMismatch}
                  onChange={(e) => setWeightMismatch(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </TextField>
                <TextField
                  label="Destination Mismatch?"
                  select
                  value={destinationMismatch}
                  onChange={(e) => setDestinationMismatch(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </TextField>
              </>
            ) : (
              <>
                <TextField
                  label="Humidity (%)"
                  type="number"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Surface Roughness OK?"
                  select
                  value={roughnessOk}
                  onChange={(e) => setRoughnessOk(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">OK</option>
                  <option value="false">NOT OK</option>
                </TextField>
                <TextField
                  label="Coating Thickness"
                  select
                  value={coating}
                  onChange={(e) => setCoating(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="ok">OK</option>
                  <option value="low">LOW</option>
                  <option value="high">HIGH</option>
                </TextField>
                <TextField
                  label="Component Damaged?"
                  select
                  value={damaged}
                  onChange={(e) => setDamaged(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </TextField>
                <TextField
                  label="Torch Ignition OK?"
                  select
                  value={ignitionOk}
                  onChange={(e) => setIgnitionOk(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  SelectProps={{ native: true }}
                >
                  <option value="true">Yes</option>
                  <option value="false">Failed</option>
                </TextField>
              </>
            )}
            <Button variant="contained" color="secondary" onClick={handleEvaluate} disabled={loading} fullWidth>
              {loading ? <CircularProgress size={24} /> : "Evaluate Rules"}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Triggered Actions
            </Typography>
            {results.length === 0 ? (
              <Typography color="text.secondary">No rules triggered. Adjust conditions and evaluate.</Typography>
            ) : (
              <List>
                {results.map((r, i) => (
                  <ListItem key={i} sx={{ px: 0 }}>
                    <Alert
                      severity={
                        r.action_type === "block" ? "error" : r.action_type === "notify" ? "warning" : "info"
                      }
                      sx={{ width: "100%" }}
                    >
                      <strong>{r.rule}:</strong> {r.message}
                    </Alert>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Configured Rules
            </Typography>
            {rules.length === 0 ? (
              <Typography color="text.secondary">No rules configured.</Typography>
            ) : (
              <List>
                {rules.map((rule) => (
                  <ListItem key={rule.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                          {rule.name}
                          <Chip
                            label={rule.action_type}
                            size="small"
                            color={rule.action_type === "block" ? "error" : rule.action_type === "notify" ? "warning" : "info"}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={`IF ${rule.condition_field} ${rule.condition_operator} ${rule.condition_value} THEN ${rule.action_detail}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
}
