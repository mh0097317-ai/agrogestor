import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("ops/evolution/configure.mjs");
const valid = [
  "evolution.example.test",
  "admin@example.test",
  "https://studioflow.example.test",
];

test("Evolution setup creates independent strong secrets without printing or replacing an existing configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "studioflow-evolution-"));
  try {
    const output = execFileSync(process.execPath, [script, ...valid], {
      cwd: directory,
      encoding: "utf8",
    });
    const configuration = readFileSync(join(directory, ".env"), "utf8");
    const key = configuration.match(
      /^AUTHENTICATION_API_KEY=([a-f0-9]{64})$/m,
    )?.[1];
    const password = configuration.match(
      /^POSTGRES_PASSWORD=([a-f0-9]{64})$/m,
    )?.[1];
    assert.ok(key);
    assert.ok(password);
    assert.notEqual(key, password);
    assert.ok(!output.includes(key));
    assert.ok(!output.includes(password));
    const second = spawnSync(process.execPath, [script, ...valid], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.notEqual(second.status, 0);
    assert.equal(readFileSync(join(directory, ".env"), "utf8"), configuration);
  } finally {
    for (const name of readdirSync(directory))
      unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});

test("Evolution setup rejects insecure origins and environment-file injection before writing secrets", () => {
  const directory = mkdtempSync(join(tmpdir(), "studioflow-evolution-"));
  try {
    for (const args of [
      ["https://evolution.example.test/path", valid[1], valid[2]],
      [valid[0], "admin$SECRET@example.test", valid[2]],
      [valid[0], valid[1], "http://studioflow.example.test"],
      [valid[0], valid[1], "https://user:password@studioflow.example.test"],
      [valid[0], valid[1], "https://studioflow.example.test/path"],
    ]) {
      assert.notEqual(
        spawnSync(process.execPath, [script, ...args], {
          cwd: directory,
          encoding: "utf8",
        }).status,
        0,
      );
      assert.deepEqual(readdirSync(directory), []);
    }
  } finally {
    rmdirSync(directory);
  }
});
