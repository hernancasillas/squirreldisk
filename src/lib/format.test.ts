import { describe, expect, it } from "vitest";
import {
  breadcrumbs,
  compareVersions,
  formatBytes,
  formatPercent,
  joinPath,
  parentPath,
  splitPath,
} from "./format";

describe("formatBytes", () => {
  it("formats decimal units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1500)).toBe("1.50 kB");
    expect(formatBytes(123_400_000_000)).toBe("123 GB");
  });
  it("formats binary units", () => {
    expect(formatBytes(1024, 1024)).toBe("1.00 KB");
    expect(formatBytes(15.5 * 1024 ** 3, 1024)).toBe("15.5 GB");
  });
});

describe("formatPercent", () => {
  it("handles edge cases", () => {
    expect(formatPercent(1, 0)).toBe("0%");
    expect(formatPercent(1, 10_000)).toBe("<0.1%");
    expect(formatPercent(1, 4)).toBe("25%");
  });
});

describe("paths", () => {
  it("splits unix and windows paths", () => {
    expect(splitPath("/Users/me/file.txt")).toEqual({ parent: "/Users/me/", name: "file.txt" });
    expect(splitPath("C:\\Users\\me")).toEqual({ parent: "C:\\Users\\", name: "me" });
  });
  it("builds breadcrumbs", () => {
    expect(breadcrumbs("/", "/Users/me").map((c) => c.path)).toEqual(["/", "/Users", "/Users/me"]);
    expect(breadcrumbs("C:\\", "C:\\Windows\\System32").map((c) => c.path)).toEqual([
      "C:\\",
      "C:\\Windows",
      "C:\\Windows\\System32",
    ]);
    expect(breadcrumbs("/home/me", "/home/me/a").map((c) => c.name)).toEqual(["/home/me", "a"]);
  });
  it("joins and finds parents", () => {
    expect(joinPath("/", "Users")).toBe("/Users");
    expect(joinPath("/Users", "me")).toBe("/Users/me");
    expect(joinPath("C:\\", "Windows")).toBe("C:\\Windows");
    expect(parentPath("/", "/Users/me")).toBe("/Users");
    expect(parentPath("/", "/Users")).toBe("/");
    expect(parentPath("/", "/")).toBeNull();
    expect(parentPath("C:\\", "C:\\Windows")).toBe("C:\\");
    expect(parentPath("/home/me", "/home/me/a")).toBe("/home/me");
  });
});

describe("compareVersions", () => {
  it("orders versions", () => {
    expect(compareVersions("v0.4.1", "0.4.0")).toBe(1);
    expect(compareVersions("0.4.0", "0.4.0")).toBe(0);
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });
});
