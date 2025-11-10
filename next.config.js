/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ビルド時に ESLint を実行しない（CI では `pnpm lint` で別途チェックする想定）
    ignoreDuringBuilds: true,
  },
  // 開発時に別オリジン（例: tailscale IP 等）から /_next/* へアクセスする場合の許可リスト
  // 将来の Next.js メジャーで必須になるため、先行定義しておく
  // 形式: 環境変数 NEXT_ALLOWED_DEV_ORIGINS にカンマ区切りで指定
  // 例: NEXT_ALLOWED_DEV_ORIGINS="http://100.102.85.62:3000,http://localhost:3000"
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    // 既定でローカルと tailscale の代表例を緩く許可（必要に応じて環境変数で上書き）
    .concat([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://100.102.85.62:3000",
    ]),
  images: {
    // 外部画像ドメイン許可 (Next Image 用) – Pinterest 画像
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pinimg.com",
      },
    ],
  },
  // 全ページに X-Robots-Tag を付与して検索インデックスを抑止
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  experimental: {},
};

module.exports = nextConfig;
