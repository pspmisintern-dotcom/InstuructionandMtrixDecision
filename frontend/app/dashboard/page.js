"use client";

import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import {
  Description as DescriptionIcon,
  People as PeopleIcon,
  PendingActions as PendingIcon,
  CheckCircle as CheckIcon,
  SmartToy as AIIcon,
  Notifications as NotifIcon,
} from "@mui/icons-material";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi } from "../../lib/api";

const StatCard = ({ title, value, icon, color }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography color="text.secondary" variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
            {value}
          </Typography>
        </Box>
        <Box sx={{ color, fontSize: 40 }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardApi.summary();
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Dashboard
        </Typography>
        <Typography color="text.secondary">
          Welcome back, {user?.full_name} ({user?.role})
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {data && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Work Instructions"
                value={data.total_work_instructions}
                icon={<DescriptionIcon />}
                color="#1e3a8a"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Operators"
                value={data.active_operators}
                icon={<PeopleIcon />}
                color="#16a34a"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Pending Approvals"
                value={data.pending_approvals}
                icon={<PendingIcon />}
                color="#f97316"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Today's Checklists"
                value={data.today_checklists}
                icon={<CheckIcon />}
                color="#0ea5e9"
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  📊 Most Viewed Work Instructions
                </Typography>
                {data.most_viewed.length === 0 ? (
                  <Typography color="text.secondary">No views yet.</Typography>
                ) : (
                  <List>
                    {data.most_viewed.map((item, i) => (
                      <ListItem key={i} sx={{ px: 0 }}>
                        <ListItemText primary={item.title} secondary={`${item.views} views`} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  🧠 Recent AI Questions
                </Typography>
                {data.recent_ai_questions.length === 0 ? (
                  <Typography color="text.secondary">No AI questions yet.</Typography>
                ) : (
                  <List>
                    {data.recent_ai_questions.map((item, i) => (
                      <ListItem key={i} sx={{ px: 0 }}>
                        <ListItemText
                          primary={item.detail?.split("| A:")[0]?.replace("Q: ", "") || "Question"}
                          secondary={new Date(item.time).toLocaleString()}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 2, mt: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <NotifIcon color="primary" />
              <Typography variant="h6">Notifications</Typography>
            </Box>
            {data.notifications.length === 0 ? (
              <Typography color="text.secondary">No notifications.</Typography>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {data.notifications.map((n, i) => (
                  <Chip
                    key={i}
                    label={n.title}
                    color={n.severity === "danger" ? "error" : n.severity === "warning" ? "warning" : "info"}
                    variant={n.is_read ? "outlined" : "filled"}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </>
      )}
    </Layout>
  );
}
