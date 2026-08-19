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
  CheckCircle,
  ArrowForward,
} from "@mui/icons-material";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo";

const features = [
  { icon: <Description />, text: "46+ Digital Work Instructions" },
  { icon: <SmartToy />, text: "AI Assistant with Ollama LLM" },
  { icon: <Shield />, text: "Multilingual PDF Viewing" },
  { icon: <CheckCircle />, text: "Role-Based Access Control" },
];

const fadeUpKeyframes = {
  "@keyframes fadeUp": {
    "0%": { opacity: 0, transform: "translateY(18px)" },
    "100%": { opacity: 1, transform: "translateY(0)" },
  },
};

const fadeUp = (delay = 0) => ({
  opacity: 0,
  animation: "fadeUp 0.7s ease forwards",
  animationDelay: `${delay}s`,
  ...fadeUpKeyframes,
});

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result?.otpRequired) {
        setOtpRequired(true);
        setOtpMessage(result.message || "Enter the one-time code sent to your email.");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyOtp(username, otp);
      router.push("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect code. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpRequired(false);
    setOtp("");
    setError("");
    setOtpMessage("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "#F5F9FF",
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
          background: "linear-gradient(-45deg, #0D47A1, #1565C0, #2196F3, #1565C0)",
          backgroundSize: "300% 300%",
          animation: "gradientShift 12s ease infinite",
          "@keyframes gradientShift": {
            "0%": { backgroundPosition: "0% 50%" },
            "50%": { backgroundPosition: "100% 50%" },
            "100%": { backgroundPosition: "0% 50%" },
          },
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle dot-grid texture */}
        <Box sx={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.6,
        }} />

        {/* Animated glow orbs */}
        <Box sx={{
          position: "absolute", width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(144,202,249,0.18) 0%, transparent 70%)",
          top: "10%", left: "-10%", animation: "pulse 4s ease-in-out infinite",
          "@keyframes pulse": { "0%,100%": { transform: "scale(1)", opacity: 0.7 }, "50%": { transform: "scale(1.1)", opacity: 1 } }
        }} />
        <Box sx={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(144,202,249,0.14) 0%, transparent 70%)",
          bottom: "15%", right: "-5%", animation: "pulse 5s ease-in-out infinite 1s",
        }} />
        <Box sx={{
          position: "absolute", width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
          top: "55%", left: "60%", animation: "pulse 6s ease-in-out infinite 0.5s",
        }} />

        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 440, textAlign: "center" }}>
          {/* Logo */}
          <Box sx={{ display: "flex", justifyContent: "center", mb: 3, ...fadeUp(0) }}>
            <Box sx={{
              width: 100, height: 100, borderRadius: "50%",
              background: "linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 20px 60px rgba(33, 150, 243, 0.4)",
              overflow: "hidden",
              animation: "float 4s ease-in-out infinite",
              "@keyframes float": { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
            }}>
              <img
                src="/images/logo.svg"
                alt="Plasma Spray Logo"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              {/* Fallback text if image doesn't load */}
              <Typography sx={{ fontSize: 48, display: "none" }}>🏭</Typography>
            </Box>
          </Box>

          <Typography variant="h3" fontWeight={800} color="#ffffff" sx={{ mb: 1, letterSpacing: "-0.5px", ...fadeUp(0.1) }}>
            WI Manager
          </Typography>
          <Typography variant="h6" sx={{ color: "#E3F2FD", mb: 1, fontWeight: 400, ...fadeUp(0.18) }}>
            Digital Manufacturing Platform
          </Typography>
          <Chip
            label="v2.0 — Powered by Ollama AI"
            size="small"
            sx={{ bgcolor: "rgba(144,202,249,0.2)", color: "#E3F2FD", fontWeight: 600, mb: 4, border: "1px solid rgba(144,202,249,0.3)", ...fadeUp(0.26) }}
          />

          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 4, ...fadeUp(0.3) }} />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
            {features.map((f, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex", alignItems: "center", gap: 2,
                  ...fadeUp(0.35 + i * 0.1),
                  transition: "transform 0.25s ease",
                  "&:hover": { transform: "translateX(4px)" },
                }}
              >
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
          bgcolor: "#F5F9FF",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420, ...fadeUp(0.05) }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            width: "100%",
            borderRadius: 4,
            border: "1px solid #90CAF9",
            boxShadow: "0 12px 40px rgba(13, 71, 161, 0.08)",
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
            <Box sx={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              mx: "auto", mb: 2, overflow: "hidden",
              animation: "float 4s ease-in-out infinite",
              "@keyframes float": { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-8px)" } },
            }}>
              <img
                src="/images/logo.svg"
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                onError={(e) => { e.target.style.display = "none"; e.target.parentElement.textContent = "🏭"; }}
              />
            </Box>
            <Typography variant="h5" fontWeight={800} color="#0D47A1">WI Manager</Typography>
          </Box>

          <Typography variant="h5" fontWeight={800} color="#0D47A1" sx={{ mb: 0.5, ...fadeUp(0.12) }}>
            {otpRequired ? "Verify your identity" : "Welcome back"}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, fontSize: 14, ...fadeUp(0.18) }}>
            {otpRequired ? otpMessage : "Sign in to your account to continue"}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, ...fadeUp(0) }}>
              {error}
            </Alert>
          )}

          {otpRequired ? (
            <form onSubmit={handleVerifyOtp} autoComplete="off">
              <Box sx={fadeUp(0.24)}>
                <TextField
                  fullWidth
                  label="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  margin="normal"
                  required
                  autoComplete="one-time-code"
                  name="otp"
                  inputProps={{ inputMode: "numeric", maxLength: 6 }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "box-shadow 0.2s ease, transform 0.2s ease",
                      "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(33,150,243,0.15)", transform: "translateY(-1px)" },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Shield sx={{ color: "#2196F3" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box sx={fadeUp(0.3)}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || otp.length !== 6}
                  endIcon={!loading && <ArrowForward />}
                  sx={{
                    mt: 3, py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 16,
                    background: "linear-gradient(135deg, #0D47A1 0%, #2196F3 100%)",
                    boxShadow: "0 8px 24px rgba(13, 71, 161, 0.3)",
                    "&:hover": { boxShadow: "0 12px 32px rgba(13, 71, 161, 0.45)", transform: "translateY(-1px)" },
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Verify & Sign In"}
                </Button>
              </Box>
              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Button variant="text" size="small" onClick={handleBackToLogin} disabled={loading}>
                  Back to login
                </Button>
              </Box>
            </form>
          ) : (
          <form onSubmit={handleSubmit} autoComplete="off">
            <Box sx={fadeUp(0.24)}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
                required
                autoComplete="off"
                name="username"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                    "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(33,150,243,0.15)", transform: "translateY(-1px)" },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: "#2196F3" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={fadeUp(0.3)}>
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
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                    "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(33,150,243,0.15)", transform: "translateY(-1px)" },
                  },
                }}
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
            </Box>
            <Box sx={fadeUp(0.36)}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                endIcon={!loading && <ArrowForward />}
                sx={{
                  mt: 3, py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 16,
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #0D47A1 0%, #2196F3 100%)",
                  boxShadow: "0 8px 24px rgba(13, 71, 161, 0.3)",
                  transition: "box-shadow 0.25s ease, transform 0.25s ease",
                  "&:hover": { boxShadow: "0 12px 32px rgba(13, 71, 161, 0.45)", transform: "translateY(-1px)" },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: "-75%",
                    width: "50%",
                    height: "100%",
                    background: "linear-gradient(120deg, transparent, rgba(255,255,255,0.45), transparent)",
                    transform: "skewX(-20deg)",
                  },
                  "&:hover::before": { left: "125%", transition: "left 0.6s ease" },
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
              </Button>
            </Box>
          </form>
          )}
        </Paper>
        </Box>
      </Box>
    </Box>
  );
}
