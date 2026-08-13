"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
} from "@mui/material";
import {
  Person,
  Lock,
  Visibility,
  VisibilityOff,
  Shield,
  SmartToy,
  Description,
  Analytics,
  CheckCircle,
  ArrowForward,
} from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";

const demoUsers = [
  { label: "Administrator", username: "admin", password: "admin123", color: "#0D47A1", icon: "🔑" },
  { label: "Supervisor", username: "supervisor", password: "Supervisor 123", color: "#2196F3", icon: "👷" },
  { label: "Operator", username: "operator", password: "operator123", color: "#90CAF9", icon: "🔧" },
];

const features = [
  { icon: <Description />, text: "46+ Digital Work Instructions" },
  { icon: <SmartToy />, text: "AI Assistant with Ollama LLM" },
  { icon: <Shield />, text: "Multilingual PDF Viewing" },
  { icon: <CheckCircle />, text: "Role-Based Access Control" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u) => {
    setUsername(u.username);
    setPassword(u.password);
    setError("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#E3F2FD",
      }}
    >
      {/* Left Panel - Branding */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          px: 6,
          background: "linear-gradient(145deg, #0D47A1 0%, #1565C0 50%, #2196F3 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated glow orbs */}
        <Box sx={{
          position: "absolute", width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(144,202,249,0.15) 0%, transparent 70%)",
          top: "10%", left: "-10%", animation: "pulse 4s ease-in-out infinite",
          "@keyframes pulse": { "0%,100%": { transform: "scale(1)", opacity: 0.7 }, "50%": { transform: "scale(1.1)", opacity: 1 } }
        }} />
        <Box sx={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(144,202,249,0.12) 0%, transparent 70%)",
          bottom: "15%", right: "-5%", animation: "pulse 5s ease-in-out infinite 1s",
        }} />

        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 440, textAlign: "center" }}>
          {/* Logo */}
          <Box sx={{
            width: 80, height: 80, borderRadius: 4,
            background: "linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            mx: "auto", mb: 3, fontSize: 36,
            boxShadow: "0 20px 60px rgba(33, 150, 243, 0.4)",
          }}>
            🏭
          </Box>

          <Typography variant="h3" fontWeight={800} color="#ffffff" sx={{ mb: 1, letterSpacing: "-0.5px" }}>
            WI Manager
          </Typography>
          <Typography variant="h6" sx={{ color: "#E3F2FD", mb: 1, fontWeight: 400 }}>
            Digital Manufacturing Platform
          </Typography>
          <Chip
            label="v2.0 — Powered by Ollama AI"
            size="small"
            sx={{ bgcolor: "rgba(144,202,249,0.2)", color: "#E3F2FD", fontWeight: 600, mb: 4, border: "1px solid rgba(144,202,249,0.3)" }}
          />

          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 4 }} />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
            {features.map((f, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: 2, bgcolor: "rgba(144,202,249,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#E3F2FD", flexShrink: 0,
                }}>
                  {f.icon}
                </Box>
                <Typography color="#E3F2FD" fontSize={15} fontWeight={500}>{f.text}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right Panel - Login Form */}
      <Box
        sx={{
          flex: { xs: 1, md: "0 0 480px" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, md: 4 },
          bgcolor: "#E3F2FD",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            width: "100%",
            maxWidth: 420,
            borderRadius: 4,
            border: "1px solid #90CAF9",
            animation: shake ? "shake 0.5s ease" : "none",
            "@keyframes shake": {
              "0%,100%": { transform: "translateX(0)" },
              "20%,60%": { transform: "translateX(-8px)" },
              "40%,80%": { transform: "translateX(8px)" },
            },
          }}
        >
          {/* Mobile logo */}
          <Box sx={{ display: { md: "none" }, textAlign: "center", mb: 3 }}>
            <Typography fontSize={32}>🏭</Typography>
            <Typography variant="h5" fontWeight={800} color="#0D47A1">WI Manager</Typography>
          </Box>

          <Typography variant="h5" fontWeight={800} color="#0D47A1" sx={{ mb: 0.5 }}>
            Welcome back
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, fontSize: 14 }}>
            Sign in to your account to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} autoComplete="off">
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoComplete="off"
              name="username"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: "#2196F3" }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="new-password"
              name="password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: "#2196F3" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              endIcon={!loading && <ArrowForward />}
              sx={{
                mt: 3, py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 16,
                background: "linear-gradient(135deg, #0D47A1 0%, #2196F3 100%)",
                boxShadow: "0 8px 24px rgba(13, 71, 161, 0.3)",
                "&:hover": { boxShadow: "0 12px 32px rgba(13, 71, 161, 0.45)", transform: "translateY(-1px)" },
                transition: "all 0.2s ease",
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>DEMO ACCOUNTS</Typography>
          </Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {demoUsers.map((u) => (
              <Box
                key={u.username}
                onClick={() => fillDemo(u)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.5, borderRadius: 2, cursor: "pointer",
                  border: `1px solid ${u.color}25`,
                  bgcolor: `${u.color}08`,
                  transition: "all 0.2s",
                  "&:hover": { bgcolor: `${u.color}15`, transform: "translateX(4px)", borderColor: `${u.color}50` },
                }}
              >
                <Typography fontSize={20}>{u.icon}</Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} color="#0D47A1" fontSize={13}>
                    {u.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.username} / {u.password}
                  </Typography>
                </Box>
                <Chip
                  label="Click to fill"
                  size="small"
                  sx={{ bgcolor: `${u.color}15`, color: u.color, fontWeight: 600, fontSize: 10, border: `1px solid ${u.color}30` }}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}