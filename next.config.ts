import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/dashboard/crm",
        destination: "/crm",
      },
      {
        source: "/dashboard/crm/:path*",
        destination: "/crm/:path*",
      },
      {
        source: "/dashboard/admin",
        destination: "/admin",
      },
      {
        source: "/dashboard/admin/:path*",
        destination: "/admin/:path*",
      },
      {
        source: "/dashboard/credit",
        destination: "/credit",
      },
      {
        source: "/dashboard/credit/:path*",
        destination: "/credit/:path*",
      },
      {
        source: "/dashboard/field",
        destination: "/field",
      },
      {
        source: "/dashboard/field/:path*",
        destination: "/field/:path*",
      },
      {
        source: "/dashboard/documents",
        destination: "/documents",
      },
      {
        source: "/dashboard/documents/:path*",
        destination: "/documents/:path*",
      },
    ];
  },
};

export default nextConfig;
