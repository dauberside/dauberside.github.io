/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'i.pinimg.com', pathname: '/**' }],
  },
};
module.exports = nextConfig;