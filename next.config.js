/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Ensure webpack handles paths with spaces correctly
    config.resolve = {
      ...config.resolve,
    };
    return config;
  },
}

module.exports = nextConfig

