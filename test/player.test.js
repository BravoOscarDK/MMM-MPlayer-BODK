"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const Player = require("../lib/player");
const { normalize, argumentsFor } = require("../lib/config");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture(options = {}) {
  const config = normalize({ windows: [{ streams: ["rtsp://user:secret@camera/live"] }], ...options }).windows[0];
  const children = [];
  const statuses = [];
  let now = 0;
  const player = new Player(config, status => statuses.push(status), {
    now: () => now,
    spawn: () => {
      const child = new EventEmitter();
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.signals = [];
      child.kill = signal => { child.signals.push(signal); return true; };
      children.push(child);
      return child;
    }
  });
  return { player, children, statuses, time: value => { now = value; } };
}

test("single stream reconnects on exit with capped backoff, stop cancels retries", async t => {
  const f = fixture({ retryDelay: 10, maxRetryDelay: 20 });
  t.after(() => { f.player.stop(); f.player.child?.emit("close"); });
  f.player.start();
  f.player.start();
  assert.equal(f.children.length, 1);
  f.children[0].emit("close", 1);
  assert.equal(f.statuses.at(-1).retryIn, 10);
  await wait(25);
  assert.equal(f.children.length, 2);
  f.children[1].emit("close", 1);
  assert.equal(f.statuses.at(-1).retryIn, 20);
  f.player.stop();
  await wait(35);
  assert.equal(f.children.length, 2);
});

test("watchdog requires advancing position, ignores noise and handles split lines", t => {
  const f = fixture({ startupTimeout: 100, stallTimeout: 50 });
  t.after(() => { f.player.stop(); f.player.child?.emit("close"); });
  f.player.start();
  const child = f.children[0];
  child.stdout.write("ANS_TIME_POS");
  child.stdout.write("ITION=1\n");
  f.time(10);
  child.stdout.write("ANS_TIME_POSITION=2\n");
  assert.equal(f.statuses.at(-1).state, "playing");
  f.time(61);
  child.stderr.write("network activity without video");
  child.stdout.write("ANS_TIME_POSITION=2\n");
  f.player.poll();
  assert.deepEqual(child.signals, ["SIGTERM"]);
  assert.equal(f.statuses.at(-1).state, "stalled");
});

test("startup hangs escalate to SIGKILL and wait for close before replacement", async t => {
  const f = fixture({ startupTimeout: 50, killTimeout: 10, retryDelay: 10, maxRetryDelay: 20 });
  t.after(() => { f.player.stop(); f.player.child?.emit("close"); });
  f.player.start();
  f.time(51);
  f.player.poll();
  await wait(25);
  assert.deepEqual(f.children[0].signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(f.children.length, 1);
  f.children[0].emit("close");
  await wait(25);
  assert.equal(f.children.length, 2);
});

test("switching waits for old process and stop never reconnects", t => {
  const f = fixture();
  t.after(() => { f.player.stop(); f.player.child?.emit("close"); });
  f.player.start();
  f.player.replace();
  assert.equal(f.children.length, 1);
  f.children[0].emit("close");
  assert.equal(f.children.length, 2);
  f.player.stop();
  f.children[1].emit("close");
  assert.equal(f.player.retryTimer, null);
  assert.equal(f.children.length, 2);
});

test("missing executable errors are handled and retried", t => {
  const f = fixture();
  t.after(() => f.player.stop());
  f.player.start();
  f.children[0].emit("error", new Error("ENOENT"));
  f.children[0].emit("close", -2);
  assert.equal(f.statuses.at(-1).reason, "spawn-error");
});

test("stable playback resets retry backoff", t => {
  const f = fixture({ stableAfter: 100 });
  t.after(() => { f.player.stop(); f.player.child?.emit("close"); });
  f.player.start();
  f.player.failures = 4;
  f.player.progress(0);
  f.time(10); f.player.progress(1);
  assert.equal(f.player.failures, 4);
  f.time(111); f.player.progress(2);
  assert.equal(f.player.failures, 0);
});

test("false/zero overrides, layout, arguments and validation", () => {
  const config = normalize({ layout: "row", windows: [
    { streams: ["rtsp://one"], windowSize: { width: 100, height: 80 } },
    { streams: ["rtsp://two"], noSound: false, rotate: 0, rtspStreamOverTcp: false }
  ] });
  assert.deepEqual(config.windows[1].windowPosition, { x: 110, y: 225 });
  const args = argumentsFor(config.windows[1], "rtsp://two");
  assert.ok(args.includes("rotate=0"));
  assert.ok(!args.includes("-nosound"));
  assert.ok(!args.includes("-rtsp-stream-over-tcp"));
  assert.ok(!argumentsFor(config.windows[0], "rtsp://one").includes("-vf"));
  assert.throws(() => normalize({ windows: [{ streams: [] }] }));
  assert.throws(() => normalize({ windows: [{ streams: ["-danger"] }] }));
  assert.throws(() => normalize({ windows: [{ streams: ["rtsp://one"] }], pollInterval: 0 }));
});
