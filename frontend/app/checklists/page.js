"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  InputAdornment,
} from "@mui/material";
import { FactCheck, Search, ArrowForward } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { workInstructionApi } from "../../lib/api";

const cleanTitle = (title) => {
  if (!title) return "Untitled";
  let cleaned = (title || "").replace(/(?:Work\s*Instruction\s*(?:for|-|:)?\s*)+/gi, "").trim();
  cleaned = cleaned.replace(/(?:Operations?\/Work\/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*)+/gi, "").trim();
  const parts = cleaned.split("|").map(s => s.trim()).filter(Boolean);
  let res = parts[0] || cleaned;
  return res.replace(/^(?:Work\s*Instruction\s*(?:for|-|:)?\s*)+/gi, "").trim();
};

const shortenTitle = (title, max = 40) => {
  const cleaned = cleanTitle(title);
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}...` : cleaned;
};

export default function ChecklistsPage() {
  const router = useRouter();
  const [wis, setWis] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWis = async () => {
      try {
        const res = await workInstructionApi.list();
        setWis(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load work instructions");
      } finally {
        setLoading(false);
      }
    };
    fetchWis();
  }, []);

  const filtered = wis.filter(
    (wi) =>
      !search ||
      wi.title?.toLowerCase().includes(search.toLowerCase()) ||
      wi.wi_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <Paper
        sx={{
          mb: 3,
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "#fff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <FactCheck sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Digital Checklists
            </Typography>
            <Typography sx={{ opacity: 0.9 }}>
              Select a work instruction to begin its approved workflow.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search Checklists"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((wi) => (
            <Grid item xs={12} sm={6} md={4} key={wi.id}>
              <Card
                sx={{
                  cursor: "pointer",
                  height: "100%",
                  bgcolor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 30px rgba(30, 58, 138, 0.06)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  borderRadius: 3,
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 18px 40px rgba(30, 58, 138, 0.14)",
                  },
                }}
                onClick={() => router.push(`/workinstructions/${wi.id}`)}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Chip label={wi.wi_number} color="primary" size="small" sx={{ fontWeight: 700 }} />
                    <ArrowForward sx={{ color: "#1e3a8a", fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: "#1e3a8a", minHeight: 44 }}>
                    {shortenTitle(wi.title)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {wi.department || "General"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {filtered.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No checklists found.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </Layout>
  );
}
