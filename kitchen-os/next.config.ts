import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google Images (from your error)
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
};

export default nextConfig;