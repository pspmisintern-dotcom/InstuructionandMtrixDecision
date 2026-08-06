"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  Avatar,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import { SmartToy, Person, Send, DeleteOutline, AutoAwesome, CheckCircle } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { aiApi } from "../../lib/api";

const suggestedQuestions = [
  "What PPE is required for Blasting?",
  "What is the shutdown procedure?",
  "What should I do if pinholes are observed?",
  "What is the spray distance for Thermal Spraying?",
  "What pre-start checks are required?",
];

export default function AIPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your AI Assistant powered by Ollama and RAG Knowledge Retrieval. Ask me anything about approved Work Instructions, safety rules, machine parameters, or inspection procedures.",
      mode: "ollama",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await aiApi.ask(question);
      let answer = res.data.answer || "No response received.";
      const sources = res.data.sources || [];
      const mode = res.data.mode || "ollama";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          sources: sources,
          mode: mode,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to contact AI service");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This information is not available in the approved instructions. Please contact your Supervisor.",
          mode: "fallback",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat cleared. Ready to answer any questions grounded strictly in approved Work Instructions.",
        mode: "ollama",
      },
    ]);
  };

  return (
<Layout>
<Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "calc(100vh - 112px)",  // Fits AppBar(64px) + layout padding(48px) exactly
          overflow: "hidden",
          mx: 0,
          px: 0,
        }}
      >
        {/* Compact Top Header Banner */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: "linear-gradient(135deg, #0b1220 0%, #1e3a8a 100%)",
            color: "#ffffff",
            display: "flex",
            justify: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 42, height: 42 }}>
              <SmartToy sx={{ fontSize: 24 }} />
            </Avatar>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.3px" }}>
                  AI Assistant
                </Typography>
                <Chip
                  icon={<AutoAwesome style={{ color: "#f59e0b", fontSize: 14 }} />}
                  label="Ollama LLM + RAG Active"
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#ffffff", fontWeight: 700, fontSize: 11 }}
                />
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.85, fontSize: 13 }}>
                Answers strictly derived from approved Work Instructions with source citations.
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Clear Chat History">
            <IconButton color="inherit" onClick={handleClear} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Quick Suggestion Chips */}
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", py: 0.5, flexShrink: 0, alignItems: "center", "::-webkit-scrollbar": { display: "none" } }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap", mr: 0.5 }}>
            Quick Prompts:
          </Typography>
          {suggestedQuestions.map((q) => (
            <Chip
              key={q}
              label={q}
              onClick={() => handleSend(q)}
              clickable
              color="primary"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600, bgcolor: "#ffffff", whiteSpace: "nowrap" }}
            />
          ))}
        </Box>

        {error && (
          <Paper sx={{ p: 1.5, bgcolor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 2, flexShrink: 0 }}>
            <Typography color="error" variant="caption" fontWeight={600}>
              ⚠️ {error}
            </Typography>
          </Paper>
        )}

        {/* Main Flexible Chat Paper Box */}
<Paper
          elevation={0}
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            bgcolor: "background.paper",
            minHeight: 0, // Critical for flex column nested scrollable child
          }}
        >
          {/* Scrollable Message History Container */}
<Box sx={{ flex: 1, overflowY: "auto", p: 3, bgcolor: "background.default" }}>
            <List disablePadding>
              {messages.map((msg, idx) => (
                <ListItem key={idx} sx={{ alignItems: "flex-start", px: 0, py: 1.25 }}>
                  <Box sx={{ display: "flex", width: "100%", gap: 2, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                    <Avatar sx={{ bgcolor: msg.role === "assistant" ? "#1e3a8a" : "#2563eb", width: 36, height: 36 }}>
                      {msg.role === "assistant" ? <SmartToy fontSize="small" /> : <Person fontSize="small" />}
                    </Avatar>
<Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        maxWidth: "72%",
                        borderRadius: msg.role === "assistant" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                        bgcolor: msg.role === "assistant" ? "background.paper" : "#2563eb",
                        color: msg.role === "assistant" ? "text.primary" : "#ffffff",
                        border: msg.role === "assistant" ? "1px solid" : "none",
                        borderColor: msg.role === "assistant" ? "divider" : "transparent",
                        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>
                        {msg.content}
                      </Typography>

                      {/* Cited Sources Tagging */}
                      {msg.sources && msg.sources.length > 0 && (
                        <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid #f1f5f9" }}>
                          <Typography variant="caption" fontWeight={700} sx={{ color: "#64748b", display: "block", mb: 0.5, fontSize: 10 }}>
                            CITED SOURCES:
                          </Typography>
                          {msg.sources
                            .filter((s, i, arr) => arr.findIndex((x) => x.title === s.title) === i)
                            .map((s, i) => (
                              <Chip
                                key={i}
                                size="small"
                                icon={<CheckCircle style={{ fontSize: 12 }} />}
                                label={`${s.title || "Work Instruction"} (${s.wi_number || "WI"})${s.section ? ` - ${s.section}` : ""}`}
                                sx={{ mr: 0.5, mb: 0.5, bgcolor: "#eff6ff", color: "#1e40af", fontWeight: 600, fontSize: 11 }}
                              />
                            ))}
                        </Box>
                      )}
                    </Paper>
                  </Box>
                </ListItem>
              ))}
              {loading && (
                <ListItem sx={{ px: 0, py: 1.25 }}>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Avatar sx={{ bgcolor: "#1e3a8a", width: 36, height: 36 }}>
                      <SmartToy fontSize="small" />
                    </Avatar>
<Paper elevation={0} sx={{ p: 1.5, px: 2, borderRadius: "4px 16px 16px 16px", bgcolor: "background.paper", border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
                      <CircularProgress size={18} color="primary" />
                      <Typography variant="body2" color="text.secondary" fontSize={13}>
                        Analyzing Work Instructions with Ollama...
                      </Typography>
                    </Paper>
                  </Box>
                </ListItem>
              )}
              <div ref={bottomRef} />
            </List>
          </Box>

          {/* Fixed Bottom Input Controls Bar */}
          <Divider />
<Box sx={{ p: 2, bgcolor: "background.paper", display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>
            <TextField
              fullWidth
              placeholder="Ask a question about procedures, PPE, shutdown, or quality requirements..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={loading}
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              sx={{ py: 1, px: 2.5, borderRadius: 2.5, fontWeight: 700, textTransform: "none", minWidth: 90 }}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Box>
    </Layout>
  );
}
