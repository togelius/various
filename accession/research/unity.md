# Unity (CLI or MCP) instead of the web stack for ACCESSION

Research note, 23 October 2026. The owner asked: "What if we use Unity CLI or MCP instead of Node? Will this impact look, feel, and auto-testability?" The real comparison is D12's web stack (JavaScript in the browser, with the same core in Node for tests and bots) against Unity 6 (C#, with the Editor driven by its command line or an MCP server). Numbers marked **measured** come from this container.

## Bottom line

- **Auto-testability splits in two.**
  - **The core tests as well or better in C#,** if it is a plain .NET library with no UnityEngine reference. Here .NET 10 installed in 18 s with no account. A toy integer grid simulation ran 5–7 M steps/s (Node: 3.5–4 M) and matched the JavaScript port's hashes exactly.
  - **Everything above the core needs the Unity Editor:** rendering, UI, input, saves, screenshots and whole-game bots. The Editor needs:
    - a licence that only the owner's own sign-in can activate;
    - about 6 GB of downloads and 15 GB of disk per fresh container;
    - officially, a GPU desktop.

    The web stack runs all of this headless here, with no account.
- **"Unity CLI or MCP" in practice means the owner's Mac.**
  - Unity's official route is the free `unity` CLI, still in beta. Its MCP mode replaced Unity AI's deprecated MCP server.
  - The CLI drives a *running* Editor through an experimental package. Community MCP servers also need a running Editor.
- **Look:** Unity raises the ceiling: 2D lights and shadows, particles, 3D. The planned look needs little of it: 16×16 palette sprites drawn in code, dithered spotlight pools, an HTML label overlay.
- **Feel on phones gets worse in two places:**
  - **Start-up:** a 2–8 MB engine to reload after each tab kill, against about 70 KB today.
  - **Sound:** Web audio has no mixer effects, so the synthesiser's echo needs JavaScript interop or pre-rendered clips.
- **Autosave** needs a JavaScript plugin to match today's synchronous localStorage writes.
- **Timing:** Unity 7.0 (CoreCLR) is due in Q1 2027, a major upgrade mid-project.
- **Recommendation: keep D12's web stack for the slice.**
  - If Unity is wanted later, port the integer core to a Unity-free C# library (the spike shows this is mechanical) and do presentation work on the Mac.
  - If the look falls short, PixiJS or three.js keep Node testing.

## Checked in this container (about 20 minutes)

**Unity downloads are reachable.** The [releases API](https://services.api.unity.com/unity/editor/release/v1/releases?stream=LTS&platform=LINUX&architecture=X86_64) lists:
- 6000.3.27f1 LTS (20 Oct 2026);
- 6000.6.7f1, Supported and recommended (21 Oct);
- 6000.7.0b6, beta;
- 7000.0.0a12, alpha (22 Oct).

| Linux, download / installed | Editor | Web Build Support |
|---|---|---|
| 6000.3.27f1 LTS | 4.57 / 8.77 GB | 1.28 / 5.83 GB |
| 6000.6.7f1 | 4.14 / 9.15 GB | 1.62 / 7.39 GB |

- **Download speed (measured):** 24 MB/s, so about 4 minutes for 5.9 GB, plus unpacking (not timed).
- **GameCI image:** `unityci/editor:ubuntu-6000.3.27f1-webgl-3` is 7.56 GB compressed ([Docker Hub](https://hub.docker.com/r/unityci/editor/tags)).

**The Unity CLI runs without an account.**
- The 36 MB binary is 1.0.0-beta.14. There is no stable channel yet: its `latest.json` returns 404.
- `unity license status` reported no licence.
- `unity auth login --help` says: "Service-account sessions cannot activate licenses".
- Activating with `--personal` needs a signed-in user.
- Nothing was activated or accepted.

**.NET works without Unity.**
- **SDK install:** .NET SDK 10.0.402 took 17.9 s (240 MB download).
- **The spike:** a `netstandard2.1`, C# 9 library (the form Unity 6 consumes) holding a toy simulation:
  - a xorshift random generator;
  - sleeping monsters and bump combat;
  - `Step(state, action)` returning events;
  - an FNV state hash.
- **Timings:**
  - build: 8.0 s;
  - edit, then `dotnet test`: 4.7 s;
  - one test: 3.5 s.
- **Cross-language check.** NUnit tests assert golden hashes produced by a line-for-line JavaScript port under Node 22.22, and pass:
  - 2366039937 for seeds 1–1000;
  - 4197054079 for 10,000 runs.
- **Throughput:**
  - .NET console app: 5.1–6.8 M steps/s;
  - Node: 3.5–4.0 M steps/s;
  - a cold first run inside the test host: 1.7 M steps/s.
- **Cleanup.** Large files were deleted. The sources are in [`../prototypes/csharp-spike/`](../prototypes/csharp-spike/).

## 1. Command line, CI and licensing

**Flags** ([6.3 manual](https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html)):
- `-batchmode` runs "without the need for human interaction".
- `-nographics` "doesn't initialize the graphics device".
- `-executeMethod` fails a run on an exception or a non-zero exit.
- One Editor per project at a time.

**Tests:** `-runTests -testPlatform EditMode|PlayMode -testResults` writes NUnit XML. The docs warn: "`-quit` ... is not supported while tests are running" ([test CLI](https://docs.unity3d.com/6000.3/Documentation/Manual/test-framework/reference-command-line.html)).

**The Unity CLI wraps these** ([reference](https://docs.unity.com/en-us/unity-cli/unity-cli-reference), [release notes](https://docs.unity.com/en-us/unity-cli/release-notes)):
- `unity install lts -m webgl`
- `unity build --target WebGL`
- `unity test`: exit code 8 means failures.
- `unity open --batchmode`
- The first beta came out on 4 Apr 2026.
- Since 2 Sep, "`unity test` now runs on a Linux machine without a display server".
- The Hub's headless CLI is deprecated ([Hub CLI](https://docs.unity.com/en-us/hub/hub-cli)).

**The Linux Editor officially needs** ([requirements](https://docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html)):
- Ubuntu 22.04 or 24.04;
- an Nvidia or AMD GPU;
- GNOME;
- no "emulation, container or compatibility layer".

GameCI uses Docker regardless.

**Licensing:**
- Unity Support, updated 1 Sep 2026: "Unity no longer supports manual activation of Personal seats, which require online sign-in" ([Unity Support](https://support.unity.com/hc/en-us/articles/4401914348436)).
- The CLI's reference: "There is no username/password option... a service account cannot activate a license."
- GameCI v4 ([docs](https://game.ci/docs/github/activation)) stores the owner's `.ulf` licence file, email and password as secrets. It runs `-serial -username -password` with a serial taken from the `.ulf`; I read this in its source.

**So an agent in an ephemeral container cannot start the Editor without the owner.** Either the owner signs in through a browser in each new container, or the owner's password sits in the environment's secrets.

**Batch start-up time** was not measured, and Unity publishes no figure. Each `unity test` call starts a full Editor that compiles scripts and refreshes assets before the first test.

## 2. MCP

**Official route.**
- Unity AI's MCP server (`com.unity.ai.assistant`) needed a subscription or trial, a Unity Cloud link and an open Editor ([blog, 11 May 2026](https://unity.com/blog/unity-ai-mcp-how-to-get-started)).
- It "has been deprecated": "The `unity mcp` command in the Unity CLI replaces" it, and "The CLI is free and separate from Unity AI" ([docs](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)).
- The CLI drives a running Editor (Unity 6.0+) through `com.unity.pipeline`. The package registry shows 9 experimental versions since 25 Jun 2026; the latest is 0.9.0-exp.1, from 20 Oct.
- Its tools: scene and GameObject commands, `script eval` (arbitrary C#), game and scene view screenshots, tests, builds and console logs.

**Community servers.** All need a running Editor.
- **[CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp).** MIT; v10.3.0 (4 Oct 2026); about 15.3k stars. Unity 2021.3–6.x; Python 3.10+. About 50 tools covering scenes, scripts, tests, console, screenshots and builds. The old `justinpbarnett/unity-mcp` URL resolves here.
- **[IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP).** Apache-2.0; about 4.5k stars; 70+ tools. Documents use with `-batchmode -nographics`.
- **[CoderGamester/mcp-unity](https://github.com/CoderGamester/mcp-unity).** MIT; about 2.0k stars; Unity 6+.

**Practical workflow:** Claude Code runs on the Mac with the Editor open, using `unity mcp configure claude` or `unity command`. `unity test` refuses a project that is already open in an Editor, so tests then run inside that Editor.

## 3. Phone web and autosave

**Support status.**
- At Unity 6's launch, Unity promised "official support backed by Unity" for mobile browsers ([17 Oct 2024](https://unity.com/blog/unity-6-features-announcement)).
- The docs list iOS Safari 15+ and Android Chrome 58+ ([compatibility](https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-browsercompatibility.html)). They advise iOS Safari 18.2+ "which supports a higher memory limit".
- WebGPU left experimental in 6.6, released 1 Sep 2026 ([What's new](https://docs.unity3d.com/6000.6/Documentation/Manual/WhatsNewUnity66.html)). WebGL 2 stays the default, per [a secondary source](https://alternativeto.net/news/2026/9/unity-6-6-adds-webgpu-build-analysis-and-coreclr-prep/).

**Limits** ([limitations](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/intro/technical-overview.md)):
- No managed threads.
- Physics can differ from other platforms.
- **Audio** is "basic" ([audio](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/audio)):
  - the AudioMixer controls volume only;
  - "The scriptable audio pipeline is not supported";
  - sound waits for a tap;
  - iOS Silent Mode mutes some clips.
- **Memory:** heap growth "can cause your application to crash", so mobile builds must tune the initial memory size ([memory](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/memory)).

**Size.**
- For Unity 6.0.23, Aras Pranckevičius measured these Brotli sizes ([gist](https://gist.github.com/aras-p/740c2d4f9977ce92b7de72b1394dd365)):

  | Configuration | Size |
  |---|---|
  | Empty 2D template | 7.7 MB |
  | Stripped, keeping Input System and UI | 4.8 MB |
  | Stripped, without them | 2.0–2.3 MB |
  | Default 3D URP template | 10.7 MB |

- vanguard-zero's single file is 293 KB, 70 KB gzipped (**measured**).
- I found no figure for load time on a phone.

**Hosting.**
- Chrome and Firefox decode Brotli natively only over HTTPS.
- Where headers cannot be set, "Decompression Fallback" costs "a large loader size and a less efficient loading scheme" ([deploying](https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/building-distribution/deploying)). GitHub Pages is probably such a host (not verified).
- A PWA template is built in ([templates](https://docs.unity3d.com/Manual/web-templates-intro.html)).

**Autosave.**
- `persistentDataPath` lives at `/idbfs/<MD5 of the page's directory URL>` ([API](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-persistentDataPath.html)).
- Writes reach IndexedDB only via the template flag `autoSyncPersistentDataPath` or a manual `JS_FileSystem_Sync()` ([config](https://docs.unity3d.com/6000.3/Documentation/Manual/web-templates-build-configuration.html)).
- No page says how soon a write lands.
- An issue reports the flag causing a start-up error in 6000.0.27f1 ([#17003](https://issuetracker.unity.com/issues/17003/typeerror-cannot-read-properties-of-undefined-reading-length-error-is-thrown-when-starting-the-player-when-configautosyncpersistentdatapath-is-set-to-true)).
- PlayerPrefs keep "up to 1MB" in IndexedDB ([API](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerPrefs.html)).
- **For "lose at most the last action":** write saves synchronously to localStorage from a JavaScript plugin (`.jslib`).
- Safari's 7-day eviction applies equally to both stacks.

## 4. Mac

**Two routes:**
- **The Web build** in a browser.
- **A native build.** It needs the Mac module (0.73 GB), plus a Developer ID signature and notarization to ship outside the App Store ([Unity](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/apple-mac/macos-delivery/macos-building-notarization/macosnotarizationxcode.md)).

**Input.**
- Input System 1.20.1 (5 Oct 2026) handles mouse, keyboard and touch.
- On Web, Unity captures all of the page's keyboard input unless `captureAllKeyboardInput` is false ([input](https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-input.html)).
- Single-button play is a design rule; it costs the same in both stacks.

## 5. Look and feel

| Feature | Unity 6 | Canvas 2D or JavaScript |
|---|---|---|
| Crisp pixels | Pixel Perfect Camera | Integer zoom: trivial |
| Grid, isometric | Tilemap, including isometric ([Grid](https://docs.unity3d.com/Manual/class-Grid.html)) | Square: trivial. Isometric: moderate |
| Spotlights, darkness | URP 2D lights, Shadow Caster 2D ([2D lights](https://docs.unity3d.com/6000.3/Documentation/Manual/urp/Lights-2D-intro.html)) | Tile bands, dithered pools: easy. Light masks: moderate. Soft shadows: hard |
| Particles | Particle System; VFX Graph needs WebGPU | Hand-written: easy to moderate |
| Tweens, camera | Animator, Timeline, Cinemachine 3.1.7 | Easy |
| 3D isometric | Strong | three.js: substantial |

**Unity's real edge is its visual authoring tools,** which need the GUI Editor, exactly what an agent in a container lacks.

**Lighting must stay readable.** The rules have three discrete light bands, so continuous lighting must still show the band. Otherwise the screen implies rules that do not exist.

## 6. Auto-testability and determinism

**(a) A pure C# core is feasible.**
- Unity's default API level is .NET Standard 2.1. ".NET Standard (any version)" plug-ins are supported; ".NET Core" ones are not ([profiles](https://docs.unity3d.com/6000.3/Documentation/Manual/dotnet-profile-support.html)).
- The language is C# 9, with exceptions ([compiler](https://docs.unity3d.com/6000.3/Documentation/Manual/csharp-compiler.html)).
- The core can go in as a DLL, or as source under an assembly definition with `noEngineReferences` ([asmdef](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definition-file-format.html)).
- The spike targets exactly this, but was not compiled in Unity.

**(b) Game-level tests:** `unity test` starts a licensed Editor for each run.

**(c) Thousands of simulations** belong in plain .NET. Running them in Unity's batch mode only adds Editor start-up.

**(d) Screenshot tests.**
- The Graphics Test Framework (9.0.0-pre.26) needs a graphics device, and containers have no GPU.
- So screenshots mean the Mac, or a Unity Web build in headless Chromium (plausible, not verified).

**(e) Replays.** The contract carries over: integer arithmetic, our own random generator, `step` as the only mutator. C# adds traps:
- `string.GetHashCode` "can differ across .NET implementations, across .NET versions", and even between runs ([Microsoft](https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode)).
- The cross-engine hash test becomes .NET 10, Mono, and IL2CPP compiled to WebAssembly in each browser.

**Runtime churn.**
- Unity's June update names 6.7 LTS as the last Mono-based release. Unity 7.0 moves to CoreCLR, .NET 10 and C# 14 ([Unity forum, 16 Jun 2026](https://discussions.unity.com/t/coreclr-scripting-and-serialization-update-june-2026/1723299)).
- Beta is planned for December, release for Q1 2027 ([Inven Global](https://www.invenglobal.com/articles/24003/unity-engine-7-changing-the-development-paradigm-and-the-roadmap-ahead)).

## 7. Terms and cost

**Pricing** ([pricing](https://unity.com/products/pricing-updates), [fee cancellation](https://unity.com/blog/unity-is-canceling-the-runtime-fee)):
- Personal covers up to $200,000 of revenue and funding.
- "Splash screen optional with Unity 6".
- The Runtime Fee was cancelled on 12 Sep 2024.
- Pro costs $2,310 per seat per year from 12 Jan 2026.

**A public MIT repository:**
- **Commit:** `Assets/` with every `.meta` file, `Packages/manifest.json` with its lock file, and `ProjectSettings/`.
- **Ignore:** `Library/`, `Temp/`, `Obj/`, `Logs/`, `UserSettings/`, builds ([Unity.gitignore](https://github.com/github/gitignore/blob/main/Unity.gitignore)).
- A lost `.meta` file means "any reference to that asset is broken" ([metadata](https://docs.unity3d.com/6000.3/Documentation/Manual/AssetMetadata.html)).
- Git LFS is unnecessary for 16×16 art.

**Asset Store content.**
- The licence covers assets "embedded or incorporated into a game".
- Its FAQ is silent on public repositories ([FAQ](https://assetstore.unity.com/browse/eula-faq)).
- Takedowns of repositories containing Asset Store files are on record.
- Keep such content out of the repo.

**Who can build:** building the game needs a Unity ID and the proprietary Editor. Building the core needs only the free .NET SDK.

## 8. AI-assisted development fit

**C# is plain text,** and Claude writes it well.

**Scenes and prefabs are not.** They are YAML files linked by internal IDs (fileIDs) and GUIDs.
- Unity's own agent skill warns: "Never hand-edit `.unity`, `.prefab`, or `.asset` YAML while a live Editor is reachable", because "fileIDs and GUIDs are assigned by hand and easy to get wrong".
- Unity's merge tool, UnityYAMLMerge, handles conflicts in these files ([Smart Merge](https://docs.unity3d.com/6000.3/Documentation/Manual/SmartMerge.html)).

**A code-first project suits agents best:** one bootstrap scene, with everything else built in C# at run time. The Editor is still needed to compile and build.

**Failure modes named in the CLI skill:**
- missing or duplicated `.meta` GUIDs;
- compile errors leaving the Editor in Safe Mode;
- batch scripts where a null reference "still reports success";
- several MonoBehaviours in one file crashing the built player.

## Comparison

| | Web stack (D12) | Unity 6 |
|---|---|---|
| Look | Canvas 2D: enough for 16×16 palette art and an HTML label overlay | Higher ceiling; text drawn in-engine |
| Feel | The repo's synthesiser and echo; quick reload | Better effects tooling; basic Web audio; multi-MB start after each tab kill |
| Core testability | Node, 3.5–4 M steps/s on the toy | `dotnet test`, 5–7 M steps/s, if Unity-free |
| Whole-game testability | Node plus headless browsers in the container, no account | Licensed Editor; screenshots need a GPU (the Mac) |
| Phone web | About 70 KB gzipped | 2–8 MB; heap tuning; iOS Safari 18.2+ advised |
| Mac | Browser | Browser, or a notarized native build |
| Autosave | Synchronous localStorage | Asynchronous IndexedDB sync; a JavaScript plugin gives parity |
| AI work in cloud containers | Everything | The core only, unless the owner signs in each time |
| Cost and terms | MIT; no accounts | Free under $200k; Unity ID; Asset Store care; Unity 7 migration |
| Explainability | One JS core feeds logs, replays and a browser viewer; anyone can re-run it | A C# core gives the same logs and replays; re-running the game needs the proprietary Editor |

## Not verified

- Unity Web load time and memory on real phones; IndexedDB sync latency and what a tab kill loses.
- Personal activation in a container (needs the owner's credentials); how many machines a Personal seat allows.
- Batch start-up time; whether `unity test` and MCP work in this container.
- Rendering under Xvfb with Mesa; screenshots of Unity Web builds in headless Chromium.
- That the spike compiles in Unity (Mono, and IL2CPP compiled to WebAssembly) with the same hashes.
- GitHub Pages compression headers; WebGPU's default and the 6.6 release date (secondary sources only).
- CoplayDev's exact tool list (its catalogue page returned 404); star counts change.
