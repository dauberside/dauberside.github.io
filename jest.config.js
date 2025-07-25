module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jsdom', // 必要に応じて追加
};