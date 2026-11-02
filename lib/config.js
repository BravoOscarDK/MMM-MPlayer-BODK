"use strict";

const defaults = {
  streamInterval: 30000, layout: "", windowGap: 5,
  windowPosition: { x: 5, y: 225 }, windowSize: { width: 640, height: 360 },
  rotate: -1, noBorder: true, noSound: true, rtspStreamOverTcp: true,
  mplayerPath: "mplayer", mplayerArgs: [], display: "",
  pollInterval: 2000, startupTimeout: 30000, stallTimeout: 20000,
  retryDelay: 2000, maxRetryDelay: 30000, stableAfter: 60000, killTimeout: 3000,
  stopOnSuspend: true, page: null, showStatus: false, windows: []
};

function positive(value, name, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${name} must be a ${allowZero ? "non-negative" : "positive"} number`);
  }
}

function normalize(input) {
  const config = { ...defaults, ...input };
  for (const key of ["pollInterval", "startupTimeout", "stallTimeout", "retryDelay", "maxRetryDelay", "stableAfter", "killTimeout"]) positive(config[key], key);
  positive(config.streamInterval, "streamInterval", true);
  positive(config.windowGap, "windowGap", true);
  if (config.maxRetryDelay < config.retryDelay) throw new Error("maxRetryDelay must be >= retryDelay");
  if (!Array.isArray(config.windows) || !config.windows.length) throw new Error("Configure at least one window with streams");
  let previous;
  config.windows = config.windows.map((window, index) => {
    const c = { ...config, ...window };
    delete c.windows;
    for (const key of ["pollInterval", "startupTimeout", "stallTimeout", "retryDelay", "maxRetryDelay", "stableAfter", "killTimeout"]) positive(c[key], key);
    positive(c.streamInterval, "streamInterval", true);
    if (c.maxRetryDelay < c.retryDelay) throw new Error("maxRetryDelay must be >= retryDelay");
    if (!Array.isArray(c.streams) || !c.streams.length || c.streams.some(s => typeof s !== "string" || !s.trim() || s.startsWith("-") || /[\r\n\0]/.test(s))) throw new Error(`Window ${index}: invalid streams`);
    if (!Array.isArray(c.mplayerArgs) || c.mplayerArgs.some(a => typeof a !== "string")) throw new Error("mplayerArgs must be an array of strings");
    if (c.mplayerOption) throw new Error("Replace mplayerOption with mplayerArgs, e.g. ['-flip']");
    if (!Number.isInteger(c.rotate) || c.rotate < -1 || c.rotate > 7) throw new Error("rotate must be -1 through 7");
    for (const key of ["width", "height"]) positive(c.windowSize?.[key], `windowSize.${key}`);
    c.windowPosition = { ...c.windowPosition };
    if (previous && !window.windowPosition) {
      if (config.layout === "row") c.windowPosition = { x: previous.windowPosition.x + previous.windowSize.width + config.windowGap, y: previous.windowPosition.y };
      if (config.layout === "column") c.windowPosition = { x: previous.windowPosition.x, y: previous.windowPosition.y + previous.windowSize.height + config.windowGap };
    }
    for (const key of ["x", "y"]) if (!Number.isFinite(c.windowPosition[key])) throw new Error(`windowPosition.${key} must be a number`);
    previous = c;
    return c;
  });
  return config;
}

function argumentsFor(c, stream) {
  const args = ["-slave", "-idle", "-noconsolecontrols", "-nomouseinput", "-msglevel", "all=4:statusline=0", "-geometry", `${c.windowPosition.x}:${c.windowPosition.y}`, "-x", String(c.windowSize.width), "-y", String(c.windowSize.height)];
  if (c.noBorder) args.push("-noborder");
  if (c.noSound) args.push("-nosound");
  if (c.rotate >= 0) args.push("-vf", `rotate=${c.rotate}`);
  if (c.monitorAspect) args.push("-monitoraspect", String(c.monitorAspect));
  else if (c.noAspect) args.push("-noaspect");
  if (c.rtspStreamOverTcp) args.push("-rtsp-stream-over-tcp");
  else if (c.rtspStreamOverHttp) args.push("-rtsp-stream-over-http");
  if (c.preferIpv4) args.push("-prefer-ipv4");
  if (c.ipv4onlyProxy) args.push("-ipv4-only-proxy");
  if (c.videoOutputDriver) args.push("-vo", c.videoOutputDriver);
  return [...args, ...c.mplayerArgs, stream];
}

module.exports = { defaults, normalize, argumentsFor };
