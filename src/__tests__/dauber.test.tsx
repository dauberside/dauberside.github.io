/// <reference types="@testing-library/jest-dom" />
// CommonJS-style to avoid ESM parsing issues in Jest v30
require("@testing-library/jest-dom");
const { render, screen: rtlScreen } = require("@testing-library/react");
const ReactLib = require("react");

describe("Sample Test", () => {
  it("renders a simple text", () => {
    render(ReactLib.createElement("div", null, "Hello, World!"));
    expect(rtlScreen.getByText("Hello, World!")).toBeInTheDocument();
  });
});
