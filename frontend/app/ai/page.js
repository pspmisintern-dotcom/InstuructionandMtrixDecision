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
  Stack,
  Collapse,
} from "@mui/material";
import {
  SmartToy,
  Person,
  Send,
  DeleteOutline,
  AutoAwesome,
  CheckCircle,
  ContentCopy,
  QuizOutlined,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { aiApi } from "../../lib/api";

const suggestedQuestions = [
  "What PPE is required for Blasting? List each item with purpose.",
  "Walk me through the complete shutdown procedure step by step.",
  "What should I do if pinholes are observed? Include corrective actions.",
  "What is the correct spray distance and machine parameters for Thermal Spraying?",
  "List all pre-start checks required before beginning a coating operation.",
  "What are the quality requirements and acceptance criteria for coating?",
];

function renderInlineMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return lines.map((line, idx) => {
    const isBullet = /^[\s]*[-•*]\s+/.test(line);
    const isNumbered = /^[\s]*\d+[.)]\s+/.test(line);
    const isHeader =
      /^[A-Za-z\s]{2,}\s*[:：]?$/.test(line.trim()) &&
      line.trim().length < 90 &&
      !isBullet &&
      !isNumbered;

    const numberMatch = line.match(/^[\s]*(\d+[.)])\s+/);
    const content = line
      .replace(/^[\s]*[-•*]\s+/, "")
      .replace(/^[\s]*\d+[.)]\s+/, "");

    const parts = [];
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = boldRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t-${idx}-${key++}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      parts.push(
        <strong key={`b-${idx}-${key++}`} style={{ fontWeight: 700 }}>
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(
        <span key={`e-${idx}-${key++}`}>{content.slice(lastIndex)}</span>
      );
    }

    if (isBullet) {
      return (
        <Box
          key={idx}
          sx={{
            display: "flex",
            gap: 1,
            pl: 1,
            mb: 0.75,
            lineHeight: 1.6,
          }}
        >
          <span aria-hidden="true">•</span>
          <span>{parts}</span>
        </Box>
      );
    }

    if (isNumbered) {
      return (
        <Box
          key={idx}
          sx={{
            display: "flex",
            gap: 1,
            pl: 1,
            mb: 0.75,
            lineHeight: 1.6,
          }}
        >
          <span>{numberMatch ? numberMatch[1] : ""}</span>
          <span>{parts}</span>
        </Box>
      );
    }

    return (
      <Box
        key={idx}
        sx={{
          mb: 0.75,
          lineHeight: 1.6,
          fontWeight: isHeader ? 700 : 400,
        }}
      >
        {parts}
      </Box>
    );
  });
}

function AIBubbleMessage({ content, sources, mode, onCopy }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        gap: 1.5,
        flexDirection: "row",
      }}
    >
      <Avatar sx={{ bgcolor: "#0D47A1", width: 36, height: 36, flexShrink: 0 }}>
        <SmartToy fontSize="small" />
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          maxWidth: "calc(100% - 52px)",
          p: 2,
          borderRadius: "4px 14px 14px 14px",
          bgcolor: "background.paper",
          color: "text.primary",
          border: "1px solid",
          borderColor: "#90CAF9",
          boxShadow: "0 2px 10px rgba(13, 71, 161, 0.06)",
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            opacity: 0.6,
            transition: "opacity 0.2s",
            "&:hover": { opacity: 1 },
          }}
        >
          <Tooltip title="Copy answer">
            <IconButton size="small" onClick={() => onCopy(content)}>
              <ContentCopy sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            label={mode === "openai" ? "GPT" : mode === "ollama" ? "Ollama" : "RAG"}
            sx={{
              height: 18,
              fontSize: 9,
              fontWeight: 700,
              bgcolor: mode === "fallback" ? "#fef9c3" : "#E3F2FD",
              color: mode === "fallback" ? "#854d0e" : "#0D47A1",
            }}
          />
        </Box>
        <Box sx={{ pr: 8 }}>{renderInlineMarkdown(content)}</Box>

        {sources && sources.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px dashed #90CAF9" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <CheckCircle sx={{ color: "#10b981", fontSize: 13 }} />
              <Typography
                variant="caption"
                fontWeight={800}
                sx={{ color: "#475569", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}
              >
                Sourced From Approved Work Instructions
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
              {sources
                .filter(
                  (s, i, arr) =>
                    arr.findIndex((x) => x.title === s.title && x.section === s.section) === i
                )
                .slice(0, 6)
                .map((s, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={
                      <>
                        <strong>{s.wi_number || "WI"}</strong>
                        {s.title ? ` · ${s.title}` : ""}
                        {s.section ? ` · ${s.section}` : ""}
                      </>
                    }
                    sx={{
                      bgcolor: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #86efac",
                      fontWeight: 600,
                      fontSize: 10,
                      height: 22,
                      "& .MuiChip-label": { px: 1 },
                    }}
                  />
                ))}
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function UserBubbleMessage({ content }) {
  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        gap: 1.5,
        flexDirection: "row-reverse",
      }}
    >
      <Avatar sx={{ bgcolor: "#2196F3", width: 36, height: 36, flexShrink: 0 }}>
        <Person fontSize="small" />
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          maxWidth: "70%",
          p: 1.5,
          borderRadius: "14px 4px 14px 14px",
          bgcolor: "#2196F3",
          color: "#ffffff",
          boxShadow: "0 2px 10px rgba(33, 150, 243, 0.25)",
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 13.5, color: "#ffffff" }}>
          {content}
        </Typography>
      </Paper>
    </Box>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your **AI Work Instruction Assistant**. I have access to every approved Work Instruction document in the system.\n\n**What I can help you with:**\n• **Procedures & Step-by-Step Instructions** — full operating workflows for any WI number or process\n• **PPE Requirements** — complete list of required personal protective equipment with justification\n• **Machine Parameters** — exact temperature, pressure, distance, speed and material specifications\n• **Pre-Start & Shutdown Checklists** — complete list of actions before or after operations\n• **Quality & Acceptance Criteria** — inspection requirements, pass/fail rules and standards\n• **Safety Notes / Corrective Actions** — what to do in case of defects, pinholes, contamination or process deviations\n\nClick any prompt below or type your question.",
      mode: "ollama",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scrollAreaHeight, setScrollAreaHeight] = useState(480);
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  useEffect(() => {
    const recalc = () => {
      if (!containerRef.current || !scrollRef.current) return;
      const scrollRect = scrollRef.current.getBoundingClientRect();
      const available = window.innerHeight - scrollRect.top - 80;
      if (available > 200) setScrollAreaHeight(available);
    };
    recalc();
    window.addEventListener("resize", recalc);
    const t = setTimeout(recalc, 50);
    return () => {
      window.removeEventListener("resize", recalc);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text.replace(/\*\*/g, "")).catch(() => {});
  };

  const handleSend = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await aiApi.ask(question);
      const answer = res.data.answer || "No response received.";
      const sources = res.data.sources || [];
      const mode = res.data.mode || "ollama";

      setMessages((prev) => [...prev, { role: "assistant", content: answer, sources, mode }]);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to contact AI service");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This information is not available in the approved instructions. **Please contact your Supervisor for clarification.**",
          sources: [],
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
          "Chat cleared. I am ready to answer any question grounded strictly in approved Work Instructions. Ask me about procedures, PPE, machine parameters, quality requirements, or shutdown steps.",
        sources: [],
        mode: "ollama",
      },
    ]);
    setError("");
  };

  return (
    <Layout>
      <Box ref={containerRef} sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%", overflow: "hidden" }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            background: "linear-gradient(135deg, #0D47A1 0%, #1565C0 60%, #2196F3 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: "rgba(255,255,255,0.18)", width: 40, height: 40 }}>
              <SmartToy sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: "-0.3px" }}>
                  AI Work Instruction Assistant
                </Typography>
                <Chip
                  icon={<AutoAwesome style={{ color: "#fbbf24", fontSize: 13 }} />}
                  label="RAG Verified"
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "#ffffff", fontWeight: 700, fontSize: 10 }}
                />
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: 13, mt: 0.25 }}>
                Answers drawn directly from approved Work Instructions.
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Clear Chat History">
            <IconButton
              color="inherit"
              onClick={handleClear}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.1)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                p: 1,
              }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            py: 0.25,
            flexShrink: 0,
            alignItems: "stretch",
            scrollbarWidth: "none",
            "::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Chip
            icon={<QuizOutlined sx={{ fontSize: 14 }} />}
            label="Suggested:"
            size="small"
            sx={{
              fontWeight: 800,
              color: "#0D47A1",
              bgcolor: "#E3F2FD",
              border: "1px solid #90CAF9",
              flexShrink: 0,
            }}
          />
          {suggestedQuestions.map((q) => (
            <Chip
              key={q}
              label={q}
              onClick={() => handleSend(q)}
              clickable
              variant="outlined"
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: "#ffffff",
                borderColor: "#90CAF9",
                color: "#0D47A1",
                whiteSpace: "normal",
                minWidth: 220,
                maxWidth: 360,
                textAlign: "left",
                "& .MuiChip-label": { display: "block", lineHeight: 1.3, py: 0.3 },
                "&:hover": {
                  bgcolor: "#E3F2FD",
                  borderColor: "#2196F3",
                  color: "#0D47A1",
                },
              }}
            />
          ))}
        </Box>

        {error && (
          <Paper sx={{ p: 1, bgcolor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 2, flexShrink: 0 }}>
            <Typography color="error" variant="caption" fontWeight={700} fontSize={12}>
              ⚠️ {error}
            </Typography>
          </Paper>
        )}

        <Paper
          elevation={0}
          sx={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            bgcolor: "background.paper",
            flexShrink: 0,
          }}
          style={{ height: scrollAreaHeight }}
        >
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              p: 2.5,
              bgcolor: "#E3F2FD",
              scrollbarGutter: "stable",
            }}
          >
            <List disablePadding sx={{ width: "100%" }}>
              {messages.map((msg, idx) => (
                <ListItem
                  key={idx}
                  sx={{
                    alignItems: "flex-start",
                    px: 0,
                    py: 1,
                    width: "100%",
                    display: "block",
                  }}
                >
                  {msg.role === "assistant" ? (
                    <AIBubbleMessage
                      content={msg.content}
                      sources={msg.sources}
                      mode={msg.mode}
                      onCopy={handleCopy}
                    />
                  ) : (
                    <UserBubbleMessage content={msg.content} />
                  )}
                </ListItem>
              ))}
              {loading && (
                <ListItem sx={{ px: 0, py: 1, display: "block" }}>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Avatar sx={{ bgcolor: "#0D47A1", width: 36, height: 36, flexShrink: 0 }}>
                      <SmartToy fontSize="small" />
                    </Avatar>
                    <Paper
                      elevation={0}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: "4px 14px 14px 14px",
                        bgcolor: "background.paper",
                        border: "1px solid #90CAF9",
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                      }}
                    >
                      <CircularProgress size={18} color="primary" thickness={5} />
                      <Box>
                        <Typography variant="body2" fontWeight={700} color="text.primary" fontSize={13}>
                          Retrieving and analyzing approved Work Instructions...
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontSize={11}>
                          Cross-referencing RAG knowledge base
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                </ListItem>
              )}
              <div ref={bottomAnchorRef} style={{ height: 6, flexShrink: 0 }} />
            </List>
          </Box>

          <Divider />
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#ffffff",
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexShrink: 0,
              borderTop: "1px solid #E3F2FD",
            }}
          >
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder="Ask a detailed question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13, py: 0.25 },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              startIcon={loading ? <CircularProgress size={14} style={{ color: "#fff" }} /> : <Send />}
              sx={{
                py: 1.2,
                px: 2.5,
                borderRadius: 2,
                fontWeight: 800,
                textTransform: "none",
                minWidth: 100,
                alignSelf: "stretch",
              }}
            >
              {loading ? "Thinking" : "Ask AI"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Layout>
  );
}