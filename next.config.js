// next.config.js

console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS);

module.exports = {
  env: {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // デバッグ用に環境変数を出力
      console.log('SMTP_HOST:', process.env.SMTP_HOST);
      console.log('SMTP_PORT:', process.env.SMTP_PORT);
      console.log('SMTP_USER:', process.env.SMTP_USER);
      console.log('SMTP_PASS:', process.env.SMTP_PASS);
    }
    return config;
  },
};
