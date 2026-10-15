# cc-effort-switch

A Claude Code mod that steps the main thread's reasoning effort from the keyboard and shows it in the prompt footer.

- **Option+↑ / Option+↓** (or **Ctrl+↑ / Ctrl+↓**) step the level: low, medium, high, xhigh, max.
- **A colored meter in the footer**: `effort ▰▰▰▱▱ high`, gray at low through green, yellow and orange to red at max. A `*` marks a level picked with the keys.
- **Claude Code's own controls win**: `/effort`, a level change from Alt+P, or switching models drops the pick.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install cc-effort-switch --marketplace HuliLulu46/cc-effort-switch
```

Answer `y` to add the marketplace, then pick a scope (user is first).

From a shell:

```
claude plugin install cc-effort-switch --marketplace HuliLulu46/cc-effort-switch
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `HuliLulu46/cc-effort-switch`, then Add plugin.

## Keys

There is nothing to bind. The mod borrows Claude Code's `app:diffFileListUp` and `app:diffFileListDown` actions, which are bound to Ctrl+↑ / Alt+↑ and Ctrl+↓ / Alt+↓ by default and do nothing at the prompt.

- On macOS, Option+↑ reaches Claude Code as Alt+↑ only when the terminal sends Option as Meta (Ghostty: `macos-option-as-alt = left`; Zed: `"terminal": { "option_as_meta": true }`; iTerm2: Left Option key set to Esc+).
- Ctrl+↑ and Ctrl+↓ belong to Mission Control by default; turn them off in System Settings → Keyboard → Keyboard Shortcuts → Mission Control to use them here.
- To use other keys, bind them to the same two actions in the **Global** context of `~/.claude/keybindings.json` (a binding in another context does not reach the mod):

  ```json
  { "context": "Global", "bindings": { "meta+k": "app:diffFileListUp", "meta+j": "app:diffFileListDown" } }
  ```

- While the `/diff` panel lists more files than it shows, the keys scroll it instead.

## Known limits

- The pick applies to the main thread's requests; subagents keep their own effort.
- A pick lasts for the session: a mod cannot write settings, so it is not saved the way `/effort` saves a level.
- Before the first request the footer shows `CLAUDE_CODE_EFFORT_LEVEL`, else the level saved for the model under `modelSettings`, else `—`.
- Claude Code's own effort indicators show the level they know; the footer meter shows the level requests go out with.

Built against Claude Code 2.1.300. A mod is an early-access API that may change between releases.

## Develop

```
claude plugin validate .
claude plugin test .
tsc -p .
```
