"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Button,
  CardActions,
  Divider,
  useTheme,
} from "@mui/material";
import { Search, Description, OpenInNew, Language as LanguageIcon } from "@mui/icons-material";
import Layout from "../../components/Layout";
import PageHeader from "../../components/PageHeader";
import { workInstructionApi } from "../../lib/api";
import { useLanguage, LANGUAGES } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

function WorkInstructionsContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, languageLabel } = useLanguage();
  const { user } = useAuth();
  const isOperator = user?.role === "operator";
  const [wis, setWis] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(searchParams.get("department") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async (lang) => {
    setLoading(true);
    setError("");
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

  const getLanguageLabel = (lang) => {
    const found = LANGUAGES.find((l) => l.code === lang);
    return found ? found.label : lang === "en" ? "English" : lang === "hi" ? "Hindi" : "Marathi";
  };

  const filtered = wis.filter((wi) => {
    const matchesSearch =
      !search ||
      wi.title?.toLowerCase().includes(search.toLowerCase()) ||
      wi.wi_number?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !department || wi.department === department;
    return matchesSearch && matchesDept;
  });

  const UNASSIGNED = "Unassigned";
  const groupOrder = [...departments, UNASSIGNED];
  const grouped = filtered.reduce((acc, wi) => {
    const key = wi.department || UNASSIGNED;
    if (!acc[key]) acc[key] = [];
    acc[key].push(wi);
    return acc;
  }, {});
  const groupsToRender = groupOrder.filter((dept) => grouped[dept]?.length);

  return (
    <Layout>
      <PageHeader
        icon={Description}
        title="Work Instructions"
        subtitle="Select a language, then open any instruction to view it as a translated PDF in your browser."
      />

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
        {isOperator ? (
          <Chip
            label={`Department: ${user?.department || "Unassigned"}`}
            color="primary"
            variant="outlined"
            sx={{ alignSelf: "center", fontWeight: 600 }}
          />
        ) : (
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
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : (
        <>
          {groupsToRender.map((dept) => (
            <Box key={dept} sx={{ mb: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: theme.palette.primary.main }}>
                  {dept}
                </Typography>
                <Chip label={grouped[dept].length} size="small" />
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {grouped[dept].map((wi) => (
                  <Grid item xs={12} sm={6} md={4} key={wi.id}>
                    <Card
                      sx={{
                        height: "100%",
                        bgcolor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.mode === "dark" ? "#1e3a5f" : "#90CAF9"}`,
                        boxShadow: "0 10px 30px rgba(13, 71, 161, 0.08)",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 18px 36px rgba(13, 71, 161, 0.15)" },
                      }}
                    >
                      <CardContent sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                          <Chip label={wi.wi_number} color="primary" size="small" />
                          <Chip label={wi.revision} size="small" variant="outlined" />
                        </Box>
                        <Typography variant="h6" fontWeight={600} sx={{ mt: 1, color: theme.palette.primary.main, minHeight: 60 }}>
                          {shortenTitle(wi.title)}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
                          <LanguageIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                          <Typography variant="body2" color="text.secondary">
                            {getLanguageLabel(wi.language || language)}
                          </Typography>
                        </Box>
                      </CardContent>
                      <Divider />
                      <CardActions sx={{ p: 1.5, justifyContent: "flex-start" }}>
                        <Button
                          size="small"
                          startIcon={<OpenInNew />}
                          onClick={() => router.push(`/workinstructions/${wi.id}`)}
                          sx={{ color: "#0D47A1", fontWeight: 700 }}
                        >
                          Open
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
          {filtered.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No work instructions found.
            </Typography>
          )}
        </>
      )}
    </Layout>
  );
}

export default function WorkInstructionsPage() {
  return (
    <Suspense fallback={<Layout><Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress color="primary" /></Box></Layout>}>
      <WorkInstructionsContent />
    </Suspense>
  );
}