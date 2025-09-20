/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ビルド時に ESLint を実行しない（CI では `pnpm lint` で別途チェックする想定）
    ignoreDuringBuilds: true,
  },
  images: {
    // 外部画像ドメイン許可 (Next Image 用) – Pinterest 画像
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pinimg.com",
      },
    ],
  },
};

module.exports = nextConfig;
