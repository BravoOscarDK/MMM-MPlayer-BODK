"use strict";

const NodeHelper = require("node_helper");
const { normalize } = require("./lib/config");
const Player = require("./lib/player");

module.exports = NodeHelper.create({
  start() { this.instances = new Map(); },

  socketNotificationReceived(notification, payload) {
    if (!payload || typeof payload.id !== "string") return;
    if (notification === "BODK_CONFIG") {
      // Repeated configuration after a socket reconnect must not duplicate players.
      if (this.instances.has(payload.id)) return;
      try {
        const config = normalize(payload.config);
        const players = config.windows.map((window, index) => new Player(window, status => {
          this.sendSocketNotification("BODK_STATUS", { id: payload.id, window: index, ...status });
        }));
        this.instances.set(payload.id, players);
      } catch (error) {
        this.sendSocketNotification("BODK_STATUS", { id: payload.id, state: "configuration-error", message: error.message });
      }
    }
    const players = this.instances.get(payload.id);
    if (!players) return;
    if (notification === "BODK_START") players.forEach(player => player.start());
    if (notification === "BODK_STOP") players.forEach(player => player.stop());
  },

  stop() {
    for (const players of this.instances.values()) players.forEach(player => player.stop());
    this.instances.clear();
  }
});
