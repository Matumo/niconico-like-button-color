import { expect, test } from "@playwright/test";

test("ダミー（xvfb）", async () => {
  // xvfb経由の起動経路で最低限のテストが回ることを確認
  expect(true).toBe(true);
});
