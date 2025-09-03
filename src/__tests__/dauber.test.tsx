import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Sample Test", () => {
  it("renders a simple text", () => {
    render(React.createElement("div", null, "Hello, World!"));
    expect(screen.getByText("Hello, World!")).toBeInTheDocument();
  });
});
