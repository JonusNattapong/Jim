import { describe, expect, it } from "vitest";
import { pushRecent, toggleFavorite } from "./ui-state.js";

describe("ui-state helpers", () => {
  it("pushRecent keeps latest item first without duplicates", () => {
    expect(pushRecent(["b", "a"], "a")).toEqual(["a", "b"]);
  });

  it("toggleFavorite adds and removes items", () => {
    expect(toggleFavorite([], "x")).toEqual(["x"]);
    expect(toggleFavorite(["x", "y"], "x")).toEqual(["y"]);
  });
});
