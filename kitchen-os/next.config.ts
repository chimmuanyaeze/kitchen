import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from your local network IP
  allowedDevOrigins: ["192.168.1.153", "localhost:3000", "http://localhost:3000"],

  images: {
    unoptimized: true,
    remotePatterns: [
      // Google Images & Thumbnails
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },

      // Stock Photo Platforms
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
      { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
      { protocol: "https", hostname: "media.istockphoto.com", pathname: "/**" },
      { protocol: "https", hostname: "image.shutterstock.com", pathname: "/**" },

      // Image Hosting & Cloud Storage (Imgur, Pinterest, Wikimedia, Cloudinary, Supabase)
      { protocol: "https", hostname: "i.imgur.com", pathname: "/**" },
      { protocol: "https", hostname: "i.pinimg.com", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },

      // Major Recipe & Food Blogs (Global & Nigerian/African)
      { protocol: "https", hostname: "**.foodnetwork.com", pathname: "/**" },
      { protocol: "https", hostname: "**.allrecipes.com", pathname: "/**" },
      { protocol: "https", hostname: "**.seriouseats.com", pathname: "/**" },
      { protocol: "https", hostname: "**.simplyrecipes.com", pathname: "/**" },
      { protocol: "https", hostname: "images.immediate.co.uk", pathname: "/**" }, // BBC Good Food
      { protocol: "https", hostname: "**.wp.com", pathname: "/**" }, // WordPress Jetpack CDN (used by most Nigerian food blogs)
      { protocol: "https", hostname: "cheflolaskitchen.com", pathname: "/**" },
      { protocol: "https", hostname: "**.cheflolaskitchen.com", pathname: "/**" },
      { protocol: "https", hostname: "sisijemimah.com", pathname: "/**" },
      { protocol: "https", hostname: "**.sisijemimah.com", pathname: "/**" },
      { protocol: "https", hostname: "allnigerianrecipes.com", pathname: "/**" },
      { protocol: "https", hostname: "**.allnigerianrecipes.com", pathname: "/**" },
    ],
  },

 
};

export default nextConfig;