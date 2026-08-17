"use client";

import React from "react";
import { Box, Paper, Typography, useTheme } from "@mui/material";

export default function PageHeader({ icon: Icon, title, subtitle }) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        mb: 3,
        p: 3,
        borderRadius: 3,
        background: theme.palette.mode === "dark"
          ? "linear-gradient(135deg, #0D1B2A 0%, #16233F 100%)"
          : "linear-gradient(135deg, #0D47A1 0%, #2196F3 100%)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          right: 0,
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
          transform: "translate(50%, -50%)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, position: "relative", zIndex: 1 }}>
        {Icon && <Icon sx={{ fontSize: 40 }} />}
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ opacity: 0.9, mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
