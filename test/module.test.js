"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

test("frontend combines screen, page and suspend state and targets its instance", () => {
  let definition;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../MMM-MPlayer-BODK.js"), "utf8"), {
    Module: { register: (name, module) => { assert.equal(name, "MMM-MPlayer-BODK"); definition = module; } }
  });
  const messages = [];
  const app = { ...definition, identifier: "module_1", config: { page: 1, stopOnSuspend: true }, sendSocketNotification: (name, payload) => messages.push({ name, payload }) };
  app.start();
  app.notificationReceived("DOM_OBJECTS_CREATED");
  assert.equal(messages.at(-1).name, "BODK_START");
  app.notificationReceived("MMM_PIR-SCREEN_POWERSTATUS", false);
  app.suspend();
  app.resume();
  assert.equal(messages.at(-1).name, "BODK_STOP");
  app.notificationReceived("MMM_PIR-SCREEN_POWERSTATUS", true);
  assert.equal(messages.at(-1).name, "BODK_START");
  app.notificationReceived("PAGE_CHANGED", 2);
  app.notificationReceived("MMM_PIR-SCREEN_POWERSTATUS", true);
  assert.equal(messages.at(-1).name, "BODK_STOP");
  app.notificationReceived("PAGE_CHANGED", 1);
  assert.equal(messages.at(-1).name, "BODK_START");
  assert.equal(messages.at(-1).payload.id, "module_1");
});

test("helper isolates instances, repeated config is idempotent and shutdown stops all", () => {
  const players = [];
  class FakePlayer {
    constructor(config, report) { this.config = config; this.report = report; this.starts = this.stops = 0; players.push(this); }
    start() { this.starts++; }
    stop() { this.stops++; }
  }
  const context = { module: { exports: {} }, require: name => {
    if (name === "node_helper") return { create: definition => definition };
    if (name === "./lib/player") return FakePlayer;
    return require("../lib/config");
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../node_helper.js"), "utf8"), context);
  const helper = context.module.exports;
  const messages = [];
  helper.sendSocketNotification = (name, payload) => messages.push({ name, payload });
  helper.start();
  const configure = id => helper.socketNotificationReceived("BODK_CONFIG", { id, config: { windows: [{ streams: ["rtsp://camera"] }] } });
  configure("a"); configure("a"); configure("b");
  assert.equal(players.length, 2);
  helper.socketNotificationReceived("BODK_START", { id: "a" });
  assert.equal(players[0].starts, 1);
  assert.equal(players[1].starts, 0);
  players[1].report({ state: "playing" });
  assert.equal(messages.at(-1).payload.id, "b");
  helper.stop();
  assert.equal(players[0].stops, 1);
  assert.equal(players[1].stops, 1);
});
