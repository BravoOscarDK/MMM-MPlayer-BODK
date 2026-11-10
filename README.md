# MMM-MPlayer-BODK

A MagicMirror² module for RTSP cameras and video files with automatic reconnection.
Based on [evroom/MMM-MPlayer](https://github.com/evroom/MMM-MPlayer).
The frontend and backend have been rewritten. The original MIT license is preserved in LICENSE.

## Requirements

- Linux with MPlayer and a graphical X11 session, such as a Raspberry Pi running MagicMirror.
- Node.js 20 or newer, also meeting your MagicMirror installation's Node.js requirements.
- A working RTSP URL for each camera.

MPlayer displays **separate video windows on the desktop**. Video is not embedded
in MagicMirror's HTML. Window coordinates are screen pixels and do not automatically
follow the module's MagicMirror position. Remote browsers do not show these windows.
Wayland requires working XWayland and display access; native Wayland is unverified.
No additional npm packages are required.

## Installation

### 1. Install MPlayer

Run on your Raspberry Pi or other Linux host:

```bash
sudo apt update
sudo apt install mplayer
```

### 2. Install the module

Clone this repository into your MagicMirror modules directory:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/BravoOscarDK/MMM-MPlayer-BODK.git
cd MMM-MPlayer-BODK
npm install
```

Alternatively, copy this project folder to:

```text
~/MagicMirror/modules/MMM-MPlayer-BODK
```

Include `MMM-MPlayer-BODK.js`, `node_helper.js`, `package.json`, `LICENSE`,
`README.md` and the complete `lib` directory. The `test` directory is optional
for running tests. Do not copy the development directories `.upstream` or `.tools`.
Keep the folder name exactly `MMM-MPlayer-BODK`. Run `npm install` after updating.

### 3. Configure MagicMirror

Add the following entry to the `modules` array in `~/MagicMirror/config/config.js`.
Disable the original MMM-MPlayer module if installed.

```javascript
{
  module: "MMM-MPlayer-BODK",
  position: "top_left",
  config: {
    language: "en",
    showStatus: true,
    rtspStreamOverTcp: true,
    noSound: true,
    windows: [
      {
        windowPosition: { x: 10, y: 220 },
        windowSize: { width: 640, height: 360 },
        streams: ["rtsp://USERNAME:PASSWORD@192.168.1.100:554/STREAM_PATH"]
      }
    ]
  }
},
```

Replace the complete RTSP URL with your camera's actual address. URL-encode special
characters in the username and password. Do not share files containing credentials.

### 4. Restart MagicMirror

Use your existing startup method. For PM2, find the actual process name:

```bash
pm2 list
```

Then replace `YOUR_MAGICMIRROR_PROCESS_NAME` below with that name:

```bash
pm2 restart YOUR_MAGICMIRROR_PROCESS_NAME
```

If you run MagicMirror manually, stop it with Ctrl+C in its terminal and run your
usual startup command again from `~/MagicMirror`.

## Updating

Keep camera settings in `~/MagicMirror/config/config.js`, outside the module folder.
Keep custom changes separate from the module source to make updates easier.

### Update a Git installation

1. Back up your MagicMirror configuration:

   ```bash
   cp ~/MagicMirror/config/config.js ~/MagicMirror/config/config.js.backup-$(date +%Y%m%d-%H%M%S)
   ```

2. Check for local changes:

   ```bash
   cd ~/MagicMirror/modules/MMM-MPlayer-BODK
   git status --short
   ```

   If modified files are listed, save or commit your changes before updating.

3. Pull the latest version from your configured upstream branch:

   ```bash
   git pull --ff-only
   ```

   If Git reports diverging branches or conflicting local changes, resolve them
   before continuing. This command does not create a merge commit.

4. Read the updated README for configuration changes. Run `npm install` after updating
   for the current version. If the test directory is included, optionally run:

   ```bash
   npm test
   npm run check
   ```

5. Restart MagicMirror using your existing startup method, for example:

   ```bash
   pm2 restart YOUR_MAGICMIRROR_PROCESS_NAME
   ```

   Replace the process name as described in Installation. Verify playback and
   automatic recovery after a network interruption.

### Update a manually copied or ZIP installation

1. Back up `~/MagicMirror/config/config.js` and copy the installed module folder
   to a backup location outside `~/MagicMirror/modules`.
2. Stop MagicMirror using your existing startup method. For PM2, use
   `pm2 stop YOUR_MAGICMIRROR_PROCESS_NAME` with the actual process name.
3. Download or copy the new project version. Replace the module files and the
   complete `lib` directory in `~/MagicMirror/modules/MMM-MPlayer-BODK`.
4. Read the new README for configuration changes. Keep your camera settings in
   MagicMirror's `config/config.js`.
5. Start MagicMirror again. For PM2, use
   `pm2 restart YOUR_MAGICMIRROR_PROCESS_NAME`. Verify playback and recovery.

`git pull` only works for a Git clone. Use the manual procedure for a copied folder
or ZIP installation.

## Automatic reconnection

- Unexpected MPlayer exits and launch failures trigger automatic retries.
- Every 2 seconds the module requests MPlayer's playback position. Missing or
  unchanged positions indicate stalled playback. Log activity is not video progress.
- Startup allows 30 seconds without progress. After playback advances, a stall
  is allowed to last up to 20 seconds.
- The module sends SIGTERM before restarting and escalates to SIGKILL after
  3 seconds. A replacement starts only after the old process closes.
- Retries continue indefinitely with delays of 2, 4, 8, 16 and then at most
  30 seconds. After 60 seconds of advancing playback, the retry delay resets.
- A healthy single stream is not restarted periodically. Multiple streams in one
  window rotate according to `streamInterval`.
- Windows and module instances are supervised independently. Stop, suspend and
  shutdown cancel retries and stop the corresponding players.

Recovery takes time: the failure must be detected, the old process must close, and
any retry delay must expire. Monitoring checks MPlayer's playback position. It cannot
detect a camera sending a frozen image with continuously advancing timestamps.

## Configuration options

Options can be set globally under `config` and overridden per window unless marked
as global. Explicit `false` values and rotation `0` are respected.

| Option | Default | Description |
| --- | --- | --- |
| `windows` | `[]` | Required windows, each with a non-empty `streams` array |
| `windowPosition` | `{x:5,y:225}` | Screen position in pixels |
| `windowSize` | `{width:640,height:360}` | Video window size |
| `layout` | `""` | Global: `row` or `column` calculates subsequent positions |
| `windowGap` | `5` | Global: spacing in pixels for automatic layout |
| `streamInterval` | `30000` | Milliseconds between streams in one window; `0` disables switching |
| `rtspStreamOverTcp` | `true` | RTP/RTCP over TCP; takes precedence over HTTP |
| `rtspStreamOverHttp` | `false` | MPlayer HTTP tunneling when TCP is disabled |
| `noSound` / `noBorder` | `true` | Disable audio / remove window borders |
| `rotate` | `-1` | No rotation; `0` through `7` select MPlayer rotate filter modes |
| `monitorAspect` | unset | For example `"16:9"`; takes precedence over `noAspect` |
| `noAspect` | `false` | Disable automatic aspect compensation |
| `videoOutputDriver` | unset | MPlayer chooses automatically; override with e.g. `"xv,x11,"` |
| `preferIpv4` / `ipv4onlyProxy` | `false` | MPlayer IPv4 options |
| `display` | `""` | Inherit `DISPLAY`, falling back to `:0` |
| `mplayerPath` | `"mplayer"` | Executable name or absolute path |
| `mplayerArgs` | `[]` | Extra arguments, e.g. `["-cache", "1024"]` |
| `pollInterval` | `2000` | Monitoring interval, ms |
| `startupTimeout` | `30000` | Maximum startup time without progress, ms |
| `stallTimeout` | `20000` | Maximum playback stall, ms |
| `retryDelay` / `maxRetryDelay` | `2000` / `30000` | Minimum/maximum retry delay, ms |
| `stableAfter` | `60000` | Stable playback period before resetting retries, ms |
| `killTimeout` | `3000` | Time before escalating to SIGKILL, ms |
| `stopOnSuspend` | `true` | Global: stop when MagicMirror suspends the module |
| `page` | `null` | Global: optional page for `NEW_PAGE` / `PAGE_CHANGED` |
| `showStatus` | `false` | Global: display each camera's status in MagicMirror |

An explicit per-window `windowPosition` overrides automatic layout. Add entries to
`windows` for multiple simultaneous cameras. Use a camera substream or lower resolution
if CPU usage is high. Hardware acceleration depends on your MPlayer installation and
is not configured automatically.

`MMM_PIR-SCREEN_POWERSTATUS` accepts boolean `true`/`false`. Screen state, page
selection and MagicMirror suspend/resume are combined so a notification cannot start
video while another condition requires it to remain stopped.

## Migrating from MMM-MPlayer

Change the module name to `MMM-MPlayer-BODK`. The basic `windows` and `streams`
structure is retained. Use `windowSize` instead of the old `windowWidth`,
`windowWidthNoNewAspect` and `windowHeightNoNewAspect` options.
Replace `mplayerOption: "-cache 1024"` with `mplayerArgs: ["-cache", "1024"]`.
The hardcoded dependency on page 0 is removed; set `page: 0` if needed.
TCP and muted audio are now the defaults. Do not add arguments that disable slave
mode, output or watchdog commands. Arguments are passed directly without a shell.

## Troubleshooting and verification

First test the camera in a terminal inside the same graphical session as MagicMirror:

```bash
mplayer -rtsp-stream-over-tcp 'YOUR_RTSP_URL'
```

If this fails, check the URL, credentials, display access and video driver.
For `spawn-error`, check the MPlayer installation and `mplayerPath`.
The module does not forward raw MPlayer output or camera URLs to the log.

Then test in MagicMirror:

1. Confirm stable playback.
2. Disconnect the camera network for at least one minute, then reconnect it.
3. Confirm the status passes through retries and returns to `playing` without a manual restart.
4. Repeat with a longer outage and check that only one MPlayer process exists per window.
5. Hide/show the module or turn the screen off/on through PIR and check stop/resume.

Run automated tests with `npm test` and syntax checks with `npm run check`.
Tests simulate processes and playback positions. They cover retries, stalls, forced
termination, configuration and MagicMirror notifications. Physical cameras, MPlayer,
Raspberry Pi, X11 and PIR hardware require testing in your installation.

## Language

English is the default, independently of the MagicMirror global language. Set `language: "da"` in this module's `config` for Danish, or `language: "en"` for English. Unsupported languages fall back to English. Custom labels and device names retain their configured values. Technical logs and diagnostic errors are in English.
