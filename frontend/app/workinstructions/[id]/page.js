"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  ArrowBack,
  SmartToy,
  PictureAsPdf,
  Language as LanguageIcon,
} from "@mui/icons-material";
import Layout from "../../../components/Layout";
import { workInstructionApi } from "../../../lib/api";
import { useLanguage, LANGUAGES } from "../../../context/LanguageContext";
import { useAuth } from "../../../context/AuthContext";

function cleanTitle(title) {
  if (!title) return title;
  return title.replace(/^Work Instruction(s)? for /i, "").replace(/^Work Instruction(s)?:?\s*/i, "").trim();
}

export default function WorkInstructionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { language, setLanguage, languageLabel } = useLanguage();
  const [wi, setWi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);

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

  const loadPdf = useCallback(async () => {
    if (!wi) return;
    setPdfLoading(true);
    setError("");
    try {
      const res = await workInstructionApi.pdf(wi.id, language);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to convert document to PDF. Ensure the source file exists in the data folder.");
    } finally {
      setPdfLoading(false);
    }
  }, [wi, language]);

  useEffect(() => {
    if (wi) {
      loadPdf();
    }
  }, [wi, language, loadPdf]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push("/workinstructions")}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Back to Work Instructions
        </Button>
        {user?.role === "admin" || user?.ai_assistant_enabled ? (
          <Button
            variant="outlined"
            color="info"
            startIcon={<SmartToy />}
            onClick={() => router.push(`/ai?wi=${wi.id}`)}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
          >
            Ask AI Assistant
          </Button>
        ) : null}
      </Box>

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
                <Chip label={`Rev: ${wi.revision || "Rev 1"}`} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700 }} />
                <Chip
                  icon={<LanguageIcon sx={{ color: "#fff !important" }} />}
                  label={languageLabel}
                  sx={{ bgcolor: "rgba(16, 185, 129, 0.3)", color: "#fff", fontWeight: 700 }}
                />
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: "-0.5px" }}>
                {cleanTitle(wi.title)}
              </Typography>
              <Typography sx={{ opacity: 0.9, maxWidth: 800, lineHeight: 1.7 }}>
                {wi.scope || "Work instruction document converted to PDF in your selected language."}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
                <InputLabel sx={{ color: "rgba(255,255,255,0.7)" }}>View Language</InputLabel>
                <Select
                  value={language}
                  label="View Language"
                  onChange={(e) => setLanguage(e.target.value)}
                  sx={{
                    color: "#fff",
                    ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                    ".MuiSvgIcon-root": { color: "#fff" },
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          minHeight: "75vh",
          position: "relative",
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 1.5,
            bgcolor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <PictureAsPdf color="error" />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            {pdfLoading
              ? `Converting document to ${languageLabel} PDF...`
              : `Viewing: ${cleanTitle(wi.title)} (${languageLabel})`}
          </Typography>
        </Box>

        {pdfLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 12, gap: 2 }}>
            <CircularProgress size={48} />
            <Typography color="text.secondary">
              Translating and converting DOCX to PDF. This may take a moment...
            </Typography>
          </Box>
        ) : pdfUrl ? (
          <Box
            component="iframe"
            src={pdfUrl}
            title={`${wi.wi_number} PDF`}
            sx={{
              width: "100%",
              height: "75vh",
              border: "none",
              display: "block",
            }}
          />
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
            <Typography color="text.secondary">No PDF available.</Typography>
          </Box>
        )}
      </Paper>
    </Layout>
  );
}
