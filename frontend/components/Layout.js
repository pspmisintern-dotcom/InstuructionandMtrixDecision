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
  FormControl,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  SmartToy as AIIcon,
  People as UsersIcon,
  History as AuditIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Language as LanguageIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "./ThemeProvider";
import { useLanguage, LANGUAGES } from "../context/LanguageContext";
import { notificationApi } from "../lib/api";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Work Instructions", href: "/workinstructions", icon: <DescriptionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "AI Assistant", href: "/ai", icon: <AIIcon />, roles: ["admin", "supervisor", "operator"], requiresAiAccess: true },
  { label: "Users", href: "/users", icon: <UsersIcon />, roles: ["admin"] },
  { label: "Audit Logs", href: "/audit", icon: <AuditIcon />, roles: ["admin", "supervisor"] },
];

export default function Layout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const { darkMode, toggleDarkMode } = useThemeMode();
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);

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

  // Check if current path is allowed for the user's role
  useEffect(() => {
    if (user && pathname) {
      const currentItem = navItems.find((item) => pathname.startsWith(item.href));
      if (currentItem && !hasRole(...currentItem.roles)) {
        setAccessDenied(true);
      }
      // AI Assistant requires admin role OR admin-granted access
      if (currentItem?.requiresAiAccess && user?.role !== "admin" && !user?.ai_assistant_enabled) {
        setAccessDenied(true);
      }
    }
  }, [pathname, user]);

  const visibleItems = navItems.filter((item) => {
    if (!hasRole(...item.roles)) return false;
    // AI Assistant requires admin role OR admin-granted access
    if (item.requiresAiAccess && user?.role !== "admin" && !user?.ai_assistant_enabled) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleAccessDeniedClose = () => {
    setAccessDenied(false);
    router.push("/dashboard");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: 1300, bgcolor: "#0D47A1" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: "#2196F3",
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
              label="🟢 System Active"
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
            <FormControl size="small" sx={{ minWidth: 160, display: { xs: "none", md: "block" } }}>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                displayEmpty
                sx={{
                  color: "#ffffff",
                  ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.5)" },
                  ".MuiSvgIcon-root": { color: "#ffffff" },
                  fontSize: 13,
                  height: 36,
                }}
                startAdornment={<LanguageIcon sx={{ color: "#90CAF9", mr: 0.5, fontSize: 18 }} />}
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                <Avatar sx={{ width: 32, height: 32, bgcolor: "#2196F3", color: "#ffffff" }}>
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
            bgcolor: "#0D47A1",
            color: "#90CAF9",
            borderRight: "1px solid #1565C0",
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
                    color: "#90CAF9",
                    "&:hover": {
                      bgcolor: "rgba(33, 150, 243, 0.2)",
                      color: "#ffffff",
                    },
                    "&.Mui-selected": {
                      bgcolor: "#2196F3",
                      color: "#ffffff",
                      "&:hover": {
                        bgcolor: "#2196F3",
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
          <Box sx={{ px: 2, mt: 2, display: { xs: "block", md: "none" } }}>
            <FormControl fullWidth size="small">
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                sx={{ fontSize: 13, color: "#ffffff" }}
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, bgcolor: "background.default", minHeight: "100vh" }}>
        {children}
      </Box>

      {/* Access Denied Dialog */}
      <Dialog
        open={accessDenied}
        onClose={handleAccessDeniedClose}
        aria-labelledby="access-denied-title"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "#0D47A1" }}>
          <LockIcon sx={{ color: "#ef4444" }} />
          Access Denied
        </DialogTitle>
        <DialogContent>
          <Typography>
            Access Denied: You do not have permission to access this page or feature.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAccessDeniedClose} color="primary" variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}