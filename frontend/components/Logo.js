"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

export default function Logo({ size = "small", showText = true }) {
  const logoPath = "/images/logo.svg";
  const dimensions = size === "large" ? { width: 60, height: 60 } : { width: 40, height: 40 };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          position: "relative",
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src={logoPath}
          alt="Plasma Spray Logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.textContent = "🏭";
          }}
        />
      </Box>
      {showText && (
        <Box>
          <Typography
            variant={size === "large" ? "h6" : "body2"}
            component="div"
            sx={{ fontWeight: 800, color: "#ffffff" }}
          >
            WI Manager
          </Typography>
          {size === "large" && (
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.7)", display: "block" }}
            >
              Thermal Spray
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
