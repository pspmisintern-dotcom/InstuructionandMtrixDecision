"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  TextField,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  InputAdornment,
  MenuItem,
} from "@mui/material";
import { Search, Description } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { workInstructionApi } from "../../lib/api";
import { useLanguage, LANGUAGES } from "../../context/LanguageContext";

export default function WorkInstructionsPage() {
  const router = useRouter();
  const { language, setLanguage, languageLabel } = useLanguage();
  const [wis, setWis] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async (lang) => {
    setLoading(true);
    setError("");
    setDepartment("");
    try {
      const [wiRes, deptRes] = await Promise.all([
        workInstructionApi.list({ lang }),
        workInstructionApi.departments(lang),
      ]);
      setWis(wiRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load work instructions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(language);
  }, [language]);

  const cleanTitle = (title) => {
    if (!title) return "Untitled";
    let cleaned = (title || "").replace(/(?:Work\s*Instruction\s*(?:for|-|:)?\s*)+/gi, "").trim();
    cleaned = cleaned.replace(/(?:Operations?\/Work\/Job\s*Activity\s*covered\s*by\s*this\s*assessment\s*:\s*)+/gi, "").trim();
    const parts = cleaned.split("|").map(s => s.trim()).filter(Boolean);
    let res = parts[0] || cleaned;
    return res.replace(/^(?:Work\s*Instruction\s*(?:for|-|:)?\s*)+/gi, "").strip ? res.replace(/^(?:Work\s*Instruction\s*(?:for|-|:)?\s*)+/gi, "").trim() : res;
  };

  const shortenTitle = (title, max = 50) => {
    const cleaned = cleanTitle(title);
    return cleaned.length > max ? `${cleaned.slice(0, max).trim()}...` : cleaned;
  };

  const filtered = wis.filter((wi) => {
    const matchesSearch =
      !search ||
      wi.title?.toLowerCase().includes(search.toLowerCase()) ||
      wi.wi_number?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !department || wi.department === department;
    return matchesSearch && matchesDept;
  });

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
          <Description sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Work Instructions
            </Typography>
            <Typography sx={{ opacity: 0.9 }}>
              Select a language, then open any instruction to view it as a translated PDF in your browser.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="View Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {LANGUAGES.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All</MenuItem>
          {departments.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
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
                  border: "1px solid #d9e4ff",
                  boxShadow: "0 10px 30px rgba(15, 57, 108, 0.05)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: "0 18px 36px rgba(15, 57, 108, 0.12)" },
                }}
                onClick={() => router.push(`/workinstructions/${wi.id}`)}
              >
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Chip label={wi.wi_number} color="primary" size="small" />
                    <Chip label={wi.revision} size="small" variant="outlined" />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 2, color: "#0f3b6c" }}>
                    {shortenTitle(wi.title)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 42 }}>
                    {wi.department || "General"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {filtered.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No work instructions found.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </Layout>
  );
}
