# MMM-MPlayer-BODK

## Description

A MagicMirror² module for RTSP cameras and video files with automatic reconnection.
Based on [evroom/MMM-MPlayer](https://github.com/evroom/MMM-MPlayer).
The frontend and backend have been rewritten. The original MIT license is preserved in LICENSE.

## Requirements

- Linux with MPlayer and a graphical X11 session, such as a Raspberry Pi running MagicMirror².
- Node.js 20 or newer, also meeting your MagicMirror² installation's Node.js requirements.
- A working RTSP URL for each camera.

MPlayer displays **separate video windows on the desktop**. Video is not embedded
in MagicMirror²'s HTML. Window coordinates are screen pixels and do not automatically
follow the module's MagicMirror² position. Remote browsers do not show these windows.
Wayland requires working XWayland and display access; native Wayland is unverified.
No additional npm packages are required.

Install MPlayer on your Linux host before starting the module:

```sh
sudo apt update
sudo apt install mplayer
```

## Installation

Run these commands on the device running MagicMirror²:

```sh
cd ~/MagicMirror/modules
git clone https://github.com/BravoOscarDK/MMM-MPlayer-BODK.git
cd MMM-MPlayer-BODK
npm install
```

Keep the folder name `MMM-MPlayer-BODK` unchanged. Complete the configuration below, then restart MagicMirror² using your usual startup method.

## Configuration

Add the following entry to the `modules` array in `~/MagicMirror/config/config.js`.
Disable the original MMM-MPlayer module if installed.

```js
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

Options can be set globally under `config` and overridden per window unless marked
as global. Explicit `false` values and rotation `0` are respected.

| Option | Default | Description |
| --- | --- | --- |
| `language` | `"en"` | Display language: English (`en`) or Danish (`da`). |
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
| `stopOnSuspend` | `true` | Global: stop when MagicMirror² suspends the module |
| `page` | `null` | Global: optional page for `NEW_PAGE` / `PAGE_CHANGED` |
| `showStatus` | `false` | Global: display each camera's status in MagicMirror² |

An explicit per-window `windowPosition` overrides automatic layout. Add entries to
`windows` for multiple simultaneous cameras. Use a camera substream or lower resolution
if CPU usage is high. Hardware acceleration depends on your MPlayer installation and
is not configured automatically.

`MMM_PIR-SCREEN_POWERSTATUS` accepts boolean `true`/`false`. Screen state, page
selection and MagicMirror² suspend/resume are combined so a notification cannot start
video while another condition requires it to remain stopped.

### Automatic reconnection

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

### Migration from MMM-MPlayer

Change the module name to `MMM-MPlayer-BODK`. The basic `windows` and `streams`
structure is retained. Use `windowSize` instead of the old `windowWidth`,
`windowWidthNoNewAspect` and `windowHeightNoNewAspect` options.
Replace `mplayerOption: "-cache 1024"` with `mplayerArgs: ["-cache", "1024"]`.
The hardcoded dependency on page 0 is removed; set `page: 0` if needed.
TCP and muted audio are now the defaults. Do not add arguments that disable slave
mode, output or watchdog commands. Arguments are passed directly without a shell.

## Language

English is the default, independently of the MagicMirror² global language. Set the language in this module's `config`:

```js
language: "en" // English (default); use "da" for Danish.
```

Unsupported languages fall back to English. Custom labels, device names and upstream data retain their configured or reported values. Technical logs and diagnostic errors are in English.

## Updating

For an installation created with `git clone`:

```sh
cd ~/MagicMirror/modules/MMM-MPlayer-BODK
git pull --ff-only
npm install
```

Restart MagicMirror² using your usual startup method. Keep your module settings in `~/MagicMirror/config/config.js`. If Git reports local changes or diverging branches, preserve those changes and resolve the issue before updating. A ZIP download or copied folder must be replaced manually or migrated to a Git clone before using `git pull`.

## Troubleshooting

First test the camera in a terminal inside the same graphical session as MagicMirror²:

```sh
mplayer -rtsp-stream-over-tcp 'YOUR_RTSP_URL'
```

If this fails, check the URL, credentials, display access and video driver.
For `spawn-error`, check the MPlayer installation and `mplayerPath`.
The module does not forward raw MPlayer output or camera URLs to the log.

Then test in MagicMirror²:

1. Confirm stable playback.
2. Disconnect the camera network for at least one minute, then reconnect it.
3. Confirm the status passes through retries and returns to `playing` without a manual restart.
4. Repeat with a longer outage and check that only one MPlayer process exists per window.
5. Hide/show the module or turn the screen off/on through PIR and check stop/resume.

## Validation

```sh
npm test
npm run check
```

Automated tests do not establish hardware compatibility. Verify the module on your own MagicMirror² installation.

Tests simulate processes and playback positions. Physical cameras, MPlayer, Raspberry Pi, X11 and PIR hardware require testing in your installation.

## License

MIT. See [LICENSE](LICENSE) for license terms and attribution.
