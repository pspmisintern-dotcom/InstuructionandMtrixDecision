"use client";

import React, { useState } from "react";
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

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Work Instructions", href: "/workinstructions", icon: <DescriptionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "AI Assistant", href: "/ai", icon: <AIIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Decision Matrix", href: "/decision", icon: <DecisionIcon />, roles: ["admin", "supervisor", "operator"] },
  { label: "Documents", href: "/documents", icon: <DocumentIcon />, roles: ["admin"] },
  { label: "Users", href: "/users", icon: <UsersIcon />, roles: ["admin"] },
  { label: "Checklists", href: "/checklists", icon: <ChecklistIcon />, roles: ["admin", "supervisor", "operator"] },
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

  const visibleItems = navItems.filter((item) => hasRole(...item.roles));

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: 1300, bgcolor: "primary.main" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
              🏭 WI Manager
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Notifications">
              <IconButton color="inherit" onClick={() => router.push("/notifications")}>
                <NotificationsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={darkMode ? "Light Mode" : "Dark Mode"}>
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={user?.full_name || "User"}>
              <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}>
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
          [`& .MuiDrawer-paper`]: { width: 240, boxSizing: "border-box", mt: 8 },
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
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        {children}
      </Box>
    </Box>
  );
}
