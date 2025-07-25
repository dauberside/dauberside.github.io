module.exports = {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "embla-carousel-react": "<rootDir>/__mocks__/embla-carousel-react.js",
  },
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  semi: true,
  singleQuote: true,
  trailingComma: "es5",
  printWidth: 80,
  tabWidth: 2,
};
