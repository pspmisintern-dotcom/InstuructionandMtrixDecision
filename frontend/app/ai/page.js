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
} from "@mui/material";
import { SmartToy, Person, Send } from "@mui/icons-material";
import Layout from "../../components/Layout";
import { aiApi } from "../../lib/api";

const suggestedQuestions = [
  "What PPE is required?",
  "What is the shutdown procedure?",
  "What should I do if pinholes are observed?",
  "What is the spray distance?",
  "How do I perform Blasting?",
];

export default function AIPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI work instruction assistant. Ask me anything about the approved work instructions, such as PPE requirements, procedures, parameters, or inspections.",
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
      let answer = res.data.answer;
      if (res.data.sources?.length > 0) {
        const sources = res.data.sources
          .map((s) => `📄 ${s.title} (${s.wi_number})${s.section ? ` - ${s.section}` : ""}`)
          .filter((v, i, a) => a.indexOf(v) === i);
        answer += "\n\n_Sources:_\n" + sources.join("\n");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to get AI response");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This information is not available in the approved Work Instructions. Please contact your Supervisor.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          AI Assistant
        </Typography>
        <Typography color="text.secondary">
          Ask questions about approved work instructions — answers cite sources and never hallucinate.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {suggestedQuestions.map((q) => (
          <Chip key={q} label={q} onClick={() => handleSend(q)} clickable color="primary" variant="outlined" />
        ))}
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Paper sx={{ height: "60vh", display: "flex", flexDirection: "column" }}>
        <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
          <List>
            {messages.map((msg, idx) => (
              <ListItem key={idx} sx={{ alignItems: "flex-start", px: 0 }}>
                <Box sx={{ display: "flex", width: "100%", gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: msg.role === "assistant" ? "primary.main" : "secondary.main" }}>
                    {msg.role === "assistant" ? <SmartToy /> : <Person />}
                  </Avatar>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      flex: 1,
                      bgcolor: msg.role === "assistant" ? "background.default" : "primary.light",
                      color: msg.role === "assistant" ? "text.primary" : "white",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <Typography variant="body2">{msg.content}</Typography>
                  </Paper>
                </Box>
              </ListItem>
            ))}
            {loading && (
              <ListItem sx={{ px: 0 }}>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                  <Avatar sx={{ bgcolor: "primary.main" }}>
                    <SmartToy />
                  </Avatar>
                  <CircularProgress size={24} />
                </Box>
              </ListItem>
            )}
            <div ref={bottomRef} />
          </List>
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Ask about PPE, procedures, parameters, inspections..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
          />
          <Button variant="contained" color="secondary" onClick={() => handleSend()} disabled={loading}>
            <Send />
          </Button>
        </Box>
      </Paper>
    </Layout>
  );
}
