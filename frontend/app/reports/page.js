"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
} from "@mui/material";
import { Assessment } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { reportApi } from "../../lib/api";

const reportTypes = [
  { value: "operator_compliance", label: "Operator Compliance" },
  { value: "ppe_compliance", label: "PPE Compliance" },
  { value: "training_status", label: "Training Status" },
  { value: "inspection_results", label: "Inspection Results" },
  { value: "ai_usage", label: "AI Usage" },
  { value: "faq", label: "Frequently Asked Questions" },
  { value: "wi_usage", label: "Work Instruction Usage" },
  { value: "revision_history", label: "Revision History" },
  { value: "audit_trail", label: "Audit Trail" },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async (type) => {
    setSelected(type);
    setLoading(true);
    setError("");
    try {
      const res = await reportApi.generate(type);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const renderData = () => {
    if (!data) return null;
    if (Array.isArray(data.data)) {
      if (data.data.length === 0) {
        return <Typography color="text.secondary">No data available.</Typography>;
      }
      return (
        <List>
          {data.data.map((item, i) => (
            <ListItem key={i} sx={{ px: 0 }}>
              <ListItemText primary={JSON.stringify(item)} />
            </ListItem>
          ))}
        </List>
      );
    }
    if (typeof data.data === "object") {
      return (
        <Box>
          {Object.entries(data.data).map(([key, val]) => (
            <Box key={key} sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>{key.replace(/_/g, " ")}:</strong>{" "}
                {Array.isArray(val) ? JSON.stringify(val) : String(val)}
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return <Typography>{String(data.data)}</Typography>;
  };

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Reports & Analytics
        </Typography>
        <Typography color="text.secondary">
          Generate compliance, quality, and usage reports.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {reportTypes.map((rt) => (
          <Grid item xs={12} sm={6} md={4} key={rt.value}>
            <Card
              sx={{ cursor: "pointer", "&:hover": { boxShadow: 6 }, border: selected === rt.value ? 2 : 0, borderColor: "primary.main" }}
              onClick={() => generateReport(rt.value)}
            >
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
                  <Assessment color="primary" />
                  <Chip label={rt.value} size="small" variant="outlined" />
                </Box>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  {rt.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click to generate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {data && !loading && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Report: {selected}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Generated at {new Date(data.generated_at).toLocaleString()}
          </Typography>
          {renderData()}
        </Paper>
      )}
    </Layout>
  );
}
