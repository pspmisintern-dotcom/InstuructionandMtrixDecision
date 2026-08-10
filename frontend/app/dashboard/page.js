"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Button,
Avatar,
  LinearProgress,
  Tooltip,
  Skeleton,
} from "@mui/material";
import {
  Description as DescriptionIcon,
  People as PeopleIcon,
  PendingActions as PendingIcon,
  CheckCircle as CheckIcon,
  SmartToy as AIIcon,
  Notifications as NotifIcon,
  AccountTree as RuleIcon,
  ArrowForward,
  Speed,
  TrendingUp,
  FolderSpecial,
  PlayCircleFilled,
  History as HistoryIcon,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi } from "../../lib/api";

const StatCard = ({ title, value, subtitle, icon, gradient, color, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      height: "100%",
      borderRadius: 3,
      border: "1px solid",
      borderColor: "divider",
      background: "background.paper",
      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.04)",
      transition: "transform 0.25s ease, box-shadow 0.25s ease",
      cursor: onClick ? "pointer" : "default",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: "0 18px 35px rgba(15, 23, 42, 0.1)",
      },
      position: "relative",
      overflow: "hidden",
    }}
  >
    <Box
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: gradient,
      }}
    />
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ pr: 2 }}>
          <Typography color="text.secondary" variant="body2" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 12 }}>
            {title}
          </Typography>
          <Typography variant="h3" fontWeight={800} sx={{ mt: 1, color: "text.primary" }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5, fontWeight: 500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar
          sx={{
            background: gradient,
            color: "#ffffff",
            width: 48,
            height: 48,
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
          }}
        >
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardApi.summary();
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

if (loading) {
    return (
      <Layout>
        <Box sx={{ minHeight: "70vh" }}>
          <Skeleton variant="rounded" height={140} sx={{ mb: 3, borderRadius: 4 }} />
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {[0, 1, 2, 3].map((i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
          <Skeleton variant="rounded" height={110} sx={{ mb: 3, borderRadius: 3 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
            </Grid>
            <Grid item xs={12} md={5}>
              <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
            </Grid>
          </Grid>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Modern Header Banner */}
      <Paper
        sx={{
          mb: 4,
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 50%, #1e3a8a 100%)",
          color: "#ffffff",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Chip
                label="LIVE SYSTEM CONTROL"
                size="small"
                sx={{ bgcolor: "rgba(59, 130, 246, 0.25)", color: "#60a5fa", fontWeight: 700, fontSize: 11 }}
              />
              <Chip
                label={`Role: ${user?.role?.toUpperCase() || "OPERATOR"}`}
                size="small"
                sx={{ bgcolor: "rgba(255, 255, 255, 0.15)", color: "#ffffff", fontWeight: 600, fontSize: 11 }}
              />
            </Box>
            <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: "-0.5px" }}>
              Operations Dashboard
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.85, mt: 0.5, maxWidth: 650 }}>
              Welcome back, <strong>{user?.full_name || user?.username || "Operator"}</strong>. Browse digitized work instructions in your preferred language as PDF.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DescriptionIcon />}
              onClick={() => router.push("/workinstructions")}
              sx={{ px: 3, py: 1.2, fontWeight: 700, textTransform: "none", borderRadius: 2.5 }}
            >
              Work Instructions
            </Button>
            <Button
              variant="outlined"
              sx={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)", px: 3, py: 1.2, fontWeight: 700, textTransform: "none", borderRadius: 2.5, "&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.1)" } }}
              startIcon={<AIIcon />}
              onClick={() => router.push("/ai")}
            >
              Ask AI
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {data && (
        <>
          {/* Executive KPI Grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Instructions"
                value={data.total_work_instructions}
                subtitle={`${data.department_distribution?.length || 0} active departments`}
                icon={<DescriptionIcon />}
                gradient="linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                onClick={() => router.push("/workinstructions")}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Operators"
                value={data.active_operators}
                subtitle={`Of ${data.total_users || 0} total system users`}
                icon={<PeopleIcon />}
                gradient="linear-gradient(135deg, #059669 0%, #047857 100%)"
                onClick={() => router.push("/users")}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Today's Activity"
                value={data.today_logs || 0}
                subtitle={`${data.today_checklists || 0} checklist items checked today`}
                icon={<CheckIcon />}
                gradient="linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                onClick={() => router.push("/audit")}
              />
            </Grid>
          </Grid>

          {/* Quick Actions Bar */}
<Paper sx={{ p: 3, mb: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: "text.secondary", mb: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ⚡ Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PlayCircleFilled color="primary" />}
                  onClick={() => router.push("/workinstructions")}
                  sx={{ py: 1.5, justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: "#cbd5e1", color: "#1e293b", "&:hover": { bgcolor: "#f8fafc", borderColor: "#94a3b8" } }}
                >
                  View Work Instructions
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AIIcon color="secondary" />}
                  onClick={() => router.push("/ai")}
                  sx={{ py: 1.5, justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: "#cbd5e1", color: "#1e293b", "&:hover": { bgcolor: "#f8fafc", borderColor: "#94a3b8" } }}
                >
                  Query AI Assistant
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<HistoryIcon color="info" />}
                  onClick={() => router.push("/audit")}
                  sx={{ py: 1.5, justifyContent: "flex-start", textTransform: "none", fontWeight: 700, borderRadius: 2, borderColor: "#cbd5e1", color: "#1e293b", "&:hover": { bgcolor: "#f8fafc", borderColor: "#94a3b8" } }}
                >
                  View Audit Logs
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Core Analytics Grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Top Viewed / Featured Instructions */}
            <Grid item xs={12} md={7}>
<Paper sx={{ p: 3, borderRadius: 3, height: "100%", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.03)" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FolderSpecial color="primary" />
                    <Typography variant="h6" fontWeight={700} sx={{ color: "text.primary" }}>
                      Work Instructions Catalog
                    </Typography>
                  </Box>
                  <Button size="small" endIcon={<ArrowForward />} onClick={() => router.push("/workinstructions")}>
                    View All
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {(!data.most_viewed || data.most_viewed.length === 0) ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                    No procedures accessed yet.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {data.most_viewed.map((item, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          px: 2,
                          py: 1.5,
                          mb: 1.5,
                          borderRadius: 2,
                          bgcolor: "#f8fafc",
                          border: "1px solid #f1f5f9",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          "&:hover": { bgcolor: "#eff6ff", borderColor: "#bfdbfe" },
                        }}
                        onClick={() => router.push(item.id ? `/workinstructions/${item.id}` : "/workinstructions")}
                      >
                        <Avatar sx={{ bgcolor: "#2563eb", width: 32, height: 32, fontSize: 13, fontWeight: 700, mr: 2 }}>
                          {idx + 1}
                        </Avatar>
                        <ListItemText
                          primary={
<Typography variant="body1" fontWeight={700} color="text.primary">
                              {item.wi_number ? `${item.wi_number} — ` : ""}{item.title}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Department: {item.department || "General"}
                            </Typography>
                          }
                        />
                        <Chip label={`${item.views || 1} views`} size="small" color="primary" variant="outlined" />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Department Breakdown & System Activity */}
            <Grid item xs={12} md={5}>
<Paper sx={{ p: 3, borderRadius: 3, height: "100%", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", boxShadow: "0 10px 25px rgba(15, 23, 42, 0.03)" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <TrendingUp color="secondary" />
                  <Typography variant="h6" fontWeight={700} sx={{ color: "text.primary" }}>
                    Department Distribution
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2.5 }} />

                {data.department_distribution && data.department_distribution.length > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {data.department_distribution.map((dept, i) => {
                      const pct = Math.round((dept.count / (data.total_work_instructions || 1)) * 100);
                      return (
                        <Box key={i}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
<Typography variant="body2" fontWeight={600} color="text.primary">
                              {dept.department}
                            </Typography>
                            <Typography variant="caption" fontWeight={700} color="text.secondary">
                              {dept.count} WI ({pct}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{ height: 8, borderRadius: 4, bgcolor: "#f1f5f9", "& .MuiLinearProgress-bar": { borderRadius: 4, background: i % 2 === 0 ? "linear-gradient(90deg, #2563eb, #3b82f6)" : "linear-gradient(90deg, #059669, #10b981)" } }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography color="text.secondary">No department breakdown available.</Typography>
                )}

                <Box sx={{ mt: 4 }}>
<Typography variant="subtitle2" fontWeight={700} sx={{ color: "text.secondary", mb: 1.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Recent AI Assistant Activity
                  </Typography>
                  {(!data.recent_ai_questions || data.recent_ai_questions.length === 0) ? (
                    <Typography variant="body2" color="text.secondary">
                      No AI assistant questions logged yet.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {data.recent_ai_questions.slice(0, 3).map((item, i) => (
                        <ListItem key={i} sx={{ px: 0, py: 0.75 }}>
                          <ListItemText
                            primary={
<Typography variant="body2" fontWeight={500} noWrap sx={{ color: "text.primary" }}>
                                💬 {item.detail?.split("| A:")[0]?.replace("Q: ", "") || "AI Question"}
                              </Typography>
                            }
                            secondary={item.time ? new Date(item.time).toLocaleTimeString() : ""}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* System Notifications Panel */}
<Paper sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <NotifIcon color="warning" />
                <Typography variant="h6" fontWeight={700}>
                  System Notifications & Alerts
                </Typography>
              </Box>
              {data.unread_notifications > 0 && (
                <Chip label={`${data.unread_notifications} Unread`} color="error" size="small" />
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            {(!data.notifications || data.notifications.length === 0) ? (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No active notifications at this time.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                {data.notifications.map((n, i) => (
                  <Chip
                    key={i}
                    label={`${n.title}${n.message ? `: ${n.message}` : ""}`}
                    color={n.severity === "danger" ? "error" : n.severity === "warning" ? "warning" : "info"}
                    variant={n.is_read ? "outlined" : "filled"}
                    sx={{ fontWeight: 600, py: 2, px: 1, borderRadius: 2 }}
                  />
                ))}
              </Box>
            )}
</Paper>

          {/* Recent Activity Feed */}
          <Paper sx={{ p: 3, borderRadius: 3, mt: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <HistoryIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Recent System Activity
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {(!data.recent_activities || data.recent_activities.length === 0) ? (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No recent activity logged.
              </Typography>
            ) : (
              <List disablePadding>
                {data.recent_activities.map((act, i) => (
                  <ListItem key={i} sx={{ px: 0, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                          <Chip
                            label={act.action}
                            size="small"
                            color={act.action === "BLOCKED" ? "error" : act.action === "LOGIN" ? "success" : act.action === "AI_QUESTION" ? "secondary" : "primary"}
                            sx={{ fontWeight: 700, fontSize: 10 }}
                          />
                          <Typography variant="body2" fontWeight={600} color="text.primary" component="span">
                            {act.detail || "Activity"}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        act.timestamp ? new Date(act.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}
    </Layout>
  );
}
