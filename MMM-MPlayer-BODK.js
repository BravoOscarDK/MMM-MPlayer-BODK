/* global Module */
Module.register("MMM-MPlayer-BODK", {
  defaults: {
    windows: [], streamInterval: 30000, stopOnSuspend: true,
    page: null, showStatus: false
  },

  start() {
    this.ready = false;
    this.suspended = false;
    this.screenOn = true;
    this.pageAllowed = true;
    this.statuses = new Map();
  },

  sync() {
    if (!this.ready) return;
    const payload = { id: this.identifier };
    this.sendSocketNotification("BODK_CONFIG", { ...payload, config: this.config });
    const play = this.screenOn && this.pageAllowed && !(this.config.stopOnSuspend && this.suspended);
    this.sendSocketNotification(play ? "BODK_START" : "BODK_STOP", payload);
  },

  notificationReceived(notification, payload) {
    if (notification === "DOM_OBJECTS_CREATED") this.ready = true;
    if (notification === "MMM_PIR-SCREEN_POWERSTATUS" && typeof payload === "boolean") this.screenOn = payload;
    if (["NEW_PAGE", "PAGE_CHANGED"].includes(notification) && this.config.page !== null) this.pageAllowed = Number(payload) === Number(this.config.page);
    this.sync();
  },

  suspend() { this.suspended = true; this.sync(); },
  resume() { this.suspended = false; this.sync(); },

  socketNotificationReceived(notification, payload) {
    if (notification !== "BODK_STATUS" || payload.id !== this.identifier) return;
    this.statuses.set(payload.window ?? -1, payload);
    if (this.config.showStatus || payload.state === "configuration-error") this.updateDom();
  },

  getDom() {
    const wrapper = document.createElement("div");
    for (const status of this.statuses.values()) {
      if (!this.config.showStatus && status.state !== "configuration-error") continue;
      const line = document.createElement("div");
      line.className = "small dimmed";
      line.textContent = status.state === "configuration-error" ? status.message : `Camera ${status.window + 1}: ${status.state}`;
      wrapper.appendChild(line);
    }
    return wrapper;
  }
});
