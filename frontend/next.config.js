/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: no modularizeImports for @mui/material — hooks like useTheme /
  // useMediaQuery live under @mui/material/styles/*, so a naive
  // "@mui/material/{{member}}" transform rewrites them to non-existent
  // paths (e.g. "@mui/material/useTheme") and breaks the production build.
  // Next.js 16 + Turbopack already tree-shakes the MUI barrel imports.
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
