/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Faster client-side navigation: tree-shake MUI barrel imports so each
  // page ships a smaller JS bundle (the old bundle loaded the whole
  // @mui/material + @mui/icons-material libraries on every page).
  modularizeImports: {
    "@mui/material": { transform: "@mui/material/{{member}}" },
    "@mui/icons-material": { transform: "@mui/icons-material/{{member}}" },
  },
  async rewrites() {
    // NEXT_PUBLIC_API_URL (or API_URL at build time) points at the deployed
    // backend in production; fall back to local dev backend otherwise.
    const apiDest =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiDest}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
