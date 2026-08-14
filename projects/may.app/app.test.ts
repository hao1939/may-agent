import { describe, expect, test } from "bun:test";
import app from "./app.ts";

describe("May conversation App", () => {
  test("is one bounded conversation address without background authority", () => {
    expect(app).toMatchObject({
      id: "may",
      version: 1,
      owner: "may",
      inbox: { batch: "single" },
    });
    expect(app.schedules).toBeUndefined();
    expect(app.observers).toBeUndefined();
    expect(app.tasks).toBeUndefined();
  });
});
