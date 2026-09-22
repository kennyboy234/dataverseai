/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        { source: "/", destination: "/marketing/home" },
        { source: "/login", destination: "/marketing/login" },
        { source: "/signup", destination: "/marketing/signup" },
        { source: "/pricing", destination: "/marketing/pricing" },
        { source: "/about", destination: "/marketing/about" },
        { source: "/contact", destination: "/marketing/contact" },
      ];
    },
  };
  
  module.exports = nextConfig;