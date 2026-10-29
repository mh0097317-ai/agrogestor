import test from "node:test";
import assert from "node:assert/strict";
import {
  openingSessionKey,
  shouldPlayIntro,
  markIntroSeen,
} from "../src/lib/booking-intro-visit";

function browser(reduced = false, blocked = false) {
  const values = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: reduced }) },
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        if (blocked) throw new Error("blocked");
        return values.get(key) || null;
      },
      setItem: (key: string, value: string) => {
        if (blocked) throw new Error("blocked");
        values.set(key, value);
      },
    },
  });
  return {
    values,
    restore: () => {
      if (previousWindow)
        Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (previousStorage)
        Object.defineProperty(globalThis, "sessionStorage", previousStorage);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    },
  };
}

test("the signature does not replay between the public page, booking and another establishment in the same visit", () => {
  const context = browser();
  try {
    assert.equal(shouldPlayIntro("casa-a"), true);
    markIntroSeen("casa-a");
    assert.equal(context.values.get(openingSessionKey), "1");
    assert.equal(context.values.get("studioflow:intro:casa-a"), "1");
    assert.equal(shouldPlayIntro("casa-a"), false);
    assert.equal(shouldPlayIntro("casa-b"), false);
  } finally {
    context.restore();
  }
});

test("reduced motion suppresses the signature and existing business visit markers remain respected", () => {
  const reduced = browser(true);
  try {
    assert.equal(shouldPlayIntro("casa-a"), false);
  } finally {
    reduced.restore();
  }
  const legacy = browser();
  try {
    legacy.values.set("studioflow:intro:casa-a", "1");
    assert.equal(shouldPlayIntro("casa-a"), false);
    assert.equal(shouldPlayIntro("casa-b"), true);
  } finally {
    legacy.restore();
  }
});

test("blocked storage cannot prevent booking from opening", () => {
  const context = browser(false, true);
  try {
    assert.doesNotThrow(() => markIntroSeen("casa-a"));
    assert.equal(shouldPlayIntro("casa-a"), true);
  } finally {
    context.restore();
  }
});
