"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
  Badge,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  SmartToy as AIIcon,
  AccountTree as DecisionIcon,
  FolderOpen as DocumentIcon,
  People as UsersIcon,
  CheckCircle as ChecklistIcon,
  Gavel as InspectionIcon,
  History as AuditIcon,
  Assessment as ReportsIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "./ThemeProvider";
import { notificationApi } from "../lib/api";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Work Instructions", href: "/workinstructions", icon: <DescriptionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "AI Assistant", href: "/ai", icon: <AIIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Decision Matrix", href: "/decision", icon: <DecisionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Documents", href: "/documents", icon: <DocumentIcon />, roles: ["admin"] },
{ label: "Users", href: "/users", icon: <UsersIcon />, roles: ["admin"] },
  { label: "Inspection", href: "/inspection", icon: <InspectionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Audit Logs", href: "/audit", icon: <AuditIcon />, roles: ["admin", "supervisor"] },
{ label: "Reports", href: "/reports", icon: <ReportsIcon />, roles: ["admin", "supervisor"] },
];

export default function Layout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname();
const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    try {
      const res = await notificationApi.list();
      const unread = (res.data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = navItems.filter((item) => hasRole(...item.roles));

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: 1300, bgcolor: "#0b1220" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🏭
            </Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: "#ffffff" }}>
              WI Manager
            </Typography>
            <Chip
              label="🟢 System Active • Ollama Connected"
              size="small"
              sx={{
                ml: 1.5,
                bgcolor: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                fontWeight: 700,
                fontSize: 11,
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: { xs: "none", sm: "inline-flex" },
              }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
<Tooltip title="Notifications">
              <IconButton color="inherit" onClick={() => router.push("/notifications")}>
                <Badge
                  badgeContent={unreadCount}
                  color="error"
                  invisible={unreadCount === 0}
                  max={99}
                >
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={darkMode ? "Light Mode" : "Dark Mode"}>
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.full_name || "User"}>
              <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", color: "#ffffff" }}>
                  {user?.full_name?.[0] || "U"}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                {user?.full_name} ({user?.role})
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: 240,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: 240,
            boxSizing: "border-box",
            mt: 8,
            bgcolor: "#0b1220",
            color: "#94a3b8",
            borderRight: "1px solid #1e293b",
          },
        }}
      >
        <Box sx={{ overflow: "auto", mt: 8 }}>
          <List>
            {visibleItems.map((item) => (
              <ListItem key={item.href} disablePadding>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  selected={pathname === item.href}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    mb: 0.5,
                    color: "#94a3b8",
                    "&:hover": {
                      bgcolor: "rgba(30, 64, 175, 0.15)",
                      color: "#ffffff",
                    },
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "#ffffff",
                      "&:hover": {
                        bgcolor: "primary.main",
                      },
                      "& .MuiListItemIcon-root": {
                        color: "#ffffff",
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, bgcolor: "background.default", minHeight: "100vh" }}>
        {children}
      </Box>
    </Box>
  );
}
