import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from your local network IP
  allowedDevOrigins: ["192.168.1.153","localhost:3000", "http://localhost:3000"],
  
  images: {
    remotePatterns: [
      // Google Images
      { protocol: "https",
         hostname: "encrypted-tbn0.gstatic.com",
          pathname: "/**" },

      // Imgur
      { protocol: "https",
         hostname: "i.imgur.com",
          pathname: "/**" },

      // Pexels
      { protocol: "https",
        hostname: "images.pexels.com", 
        pathname: "/**" },

      // Pixabay
      { protocol: "https", 
        hostname: "cdn.pixabay.com", 
        pathname: "/**" },

      // Wikipedia / Wikimedia Commons
      { protocol: "https", 
        hostname: "upload.wikimedia.org", 
        pathname: "/**" },

      // Food Network ( ** to allow ALL subdomains)
      { protocol: "https", 
        hostname: "**.foodnetwork.com", 
        pathname: "/**" },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
        port: "",
        pathname: "/**", 
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**", 
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/engine/:path*',
        destination: 'http://187.126.7.169:8000/:path*', // Securely routes traffic to your Hostinger VPS
      },
      ]
  },
};

export default nextConfig;