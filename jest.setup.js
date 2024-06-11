import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "@jest/globals";

// 各テストケースの後にクリーンアップを実行
afterEach(() => {
  cleanup();
});