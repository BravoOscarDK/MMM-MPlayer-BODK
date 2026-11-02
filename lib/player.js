"use strict";

const { spawn } = require("node:child_process");
const { argumentsFor } = require("./config");

// One independent supervisor per window. A replacement is never spawned before
// the previous process closes, including when SIGTERM has to become SIGKILL.
class Player {
  constructor(config, report = () => {}, dependencies = {}) {
    this.config = config;
    this.report = report;
    this.spawn = dependencies.spawn || spawn;
    this.now = dependencies.now || Date.now;
    this.index = 0;
    this.failures = 0;
    this.active = false;
    this.child = null;
  }

  status(state, details = {}) { this.report({ state, streamIndex: this.index, ...details }); }

  start() {
    if (this.active) return;
    this.active = true;
    this.launch();
    this.pollTimer = setInterval(() => this.poll(), this.config.pollInterval);
    if (this.config.streams.length > 1 && this.config.streamInterval > 0) {
      this.cycleTimer = setInterval(() => {
        this.index = (this.index + 1) % this.config.streams.length;
        this.failures = 0;
        this.replace();
      }, this.config.streamInterval);
    }
  }

  stop() {
    this.active = false;
    clearInterval(this.pollTimer);
    clearInterval(this.cycleTimer);
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.terminate();
    this.status("stopped");
  }

  launch() {
    if (!this.active || this.child) return;
    this.retryTimer = null;
    this.started = this.lastAdvance = this.now();
    this.position = null;
    this.healthySince = null;
    this.buffer = "";
    this.terminating = false;
    this.replacing = false;
    const env = { ...process.env };
    if (this.config.display) env.DISPLAY = this.config.display;
    else if (!env.DISPLAY) env.DISPLAY = ":0";
    let child;
    try {
      child = this.spawn(this.config.mplayerPath, argumentsFor(this.config, this.config.streams[this.index]), { env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    } catch (_) {
      this.retry("spawn-error");
      return;
    }
    this.child = child;
    this.status("connecting");
    child.stdout.on("data", data => {
      if (this.child !== child || this.terminating) return;
      this.buffer += data.toString();
      const lines = this.buffer.split(/[\r\n]/);
      this.buffer = lines.pop().slice(-4096);
      for (const line of lines) {
        const match = /^ANS_TIME_POSITION=([\d.+-]+)/.exec(line);
        if (match) this.progress(Number(match[1]));
      }
    });
    // Drain output, but never log camera URLs or credentials emitted by MPlayer.
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", () => { this.processError = true; });
    child.once("close", () => {
      if (this.child !== child) return;
      clearTimeout(this.killTimer);
      this.child = null;
      if (!this.active) return;
      if (this.replacing) this.launch();
      else this.retry(this.processError ? "spawn-error" : "player-closed");
    });
    this.processError = false;
  }

  progress(position) {
    if (!Number.isFinite(position)) return;
    if (this.position !== null && position !== this.position) {
      this.lastAdvance = this.now();
      if (this.healthySince === null) {
        this.healthySince = this.now();
        this.status("playing");
      }
      if (this.now() - this.healthySince >= this.config.stableAfter) this.failures = 0;
    }
    this.position = position;
  }

  poll() {
    if (!this.active || !this.child || this.terminating) return;
    const timeout = this.healthySince === null ? this.config.startupTimeout : this.config.stallTimeout;
    if (this.now() - this.lastAdvance >= timeout) {
      this.status("stalled");
      this.terminate();
      return;
    }
    if (this.child.stdin.writable && !this.child.stdin.writableNeedDrain) this.child.stdin.write("get_time_pos\n");
  }

  replace() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.child) {
      this.replacing = true;
      this.terminate();
    } else this.launch();
  }

  terminate() {
    const child = this.child;
    if (!child || this.terminating) return;
    this.terminating = true;
    child.kill("SIGTERM");
    this.killTimer = setTimeout(() => {
      if (this.child === child) child.kill("SIGKILL");
    }, this.config.killTimeout);
  }

  retry(reason) {
    if (!this.active || this.retryTimer) return;
    const delay = Math.min(this.config.maxRetryDelay, this.config.retryDelay * 2 ** Math.min(this.failures++, 20));
    this.status("retrying", { reason, retryIn: delay });
    this.retryTimer = setTimeout(() => this.launch(), delay);
  }
}

module.exports = Player;
