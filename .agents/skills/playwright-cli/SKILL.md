---
name: playwright-cli
description: Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.
---

# Browser Automation with playwright-cli

- Prefer simple ref-based commands (`click e15`, `fill e5 "value"`) over `run-code` scripts.
- Use `snapshot` to discover element refs before acting. NEVER guess refs or write DOM queries when a snapshot would reveal the ref directly.

## Quick start

```bash
# open new browser
playwright-cli open
# navigate to a page
playwright-cli goto https://playwright.dev
# interact with the page using refs from the snapshot
playwright-cli click e15
playwright-cli type "page.click"
playwright-cli press Enter
# take a screenshot (rarely used, as snapshot is more common)
playwright-cli screenshot
# close the browser
playwright-cli close
```

## Commands

### Core

```bash
playwright-cli open
# open and navigate right away
playwright-cli open https://example.com/
playwright-cli goto https://playwright.dev
playwright-cli type "search query"
playwright-cli click e3
playwright-cli dblclick e7
playwright-cli fill e5 "user@example.com"
playwright-cli drag e2 e8
playwright-cli hover e4
playwright-cli select e9 "option-value"
playwright-cli upload ./document.pdf
playwright-cli check e12
playwright-cli uncheck e12
playwright-cli snapshot
playwright-cli snapshot --filename=after-click.yaml
playwright-cli eval "document.title"
playwright-cli eval "el => el.textContent" e5
playwright-cli dialog-accept
playwright-cli dialog-accept "confirmation text"
playwright-cli dialog-dismiss
playwright-cli close
```

### Navigation

```bash
playwright-cli go-back
playwright-cli go-forward
playwright-cli reload
```

### Keyboard

```bash
playwright-cli press Enter
playwright-cli press ArrowDown
playwright-cli keydown Shift
playwright-cli keyup Shift
```

### Mouse

```bash
playwright-cli mousemove 150 300
playwright-cli mousedown
playwright-cli mousedown right
playwright-cli mouseup
playwright-cli mouseup right
playwright-cli mousewheel 0 100
```

### Save as

```bash
playwright-cli screenshot
playwright-cli screenshot e5
playwright-cli screenshot --filename=page.png
playwright-cli pdf --filename=page.pdf
```

### Tabs

```bash
playwright-cli tab-list
playwright-cli tab-new https://example.com/page
playwright-cli tab-close
playwright-cli tab-close 2
playwright-cli tab-select 0
```

### Storage

```bash
# Cookies
playwright-cli cookie-list
playwright-cli cookie-list --domain=example.com
playwright-cli cookie-get session_id
playwright-cli cookie-set session_id abc123 --domain=example.com --httpOnly --secure
playwright-cli cookie-delete session_id
playwright-cli cookie-clear
```

### DevTools

```bash
playwright-cli console
playwright-cli console warning
playwright-cli network
playwright-cli run-code "async page => await page.context().grantPermissions(['geolocation'])"
```

## Snapshots

After each command, playwright-cli provides a snapshot of the current browser state.

```bash
> playwright-cli goto https://example.com
### Page
- Page URL: https://example.com/
- Page Title: Example Domain
### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

You can also take a snapshot on demand using `playwright-cli snapshot` command.

If `--filename` is not provided, a new snapshot file is created with a timestamp. Default to automatic file naming, use `--filename=` when artifact is a part of the workflow result.

## Browser Sessions

```bash
playwright-cli open example.com
# same with manually specified profile directory (use when requested explicitly)
playwright-cli open example.com --profile=/path/to/profile
playwright-cli click e6
playwright-cli close  # stop a named browser
```

## Example: Form submission

```bash
playwright-cli open https://example.com/form
playwright-cli snapshot

playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123"
playwright-cli click e3
playwright-cli snapshot
playwright-cli close
```

## Example: Multi-tab workflow

```bash
playwright-cli open https://example.com
playwright-cli tab-new https://example.com/other
playwright-cli tab-list
playwright-cli tab-select 0
playwright-cli snapshot
playwright-cli close
```

## Extract readable content

```bash
playwright-cli eval "document.documentElement.outerHTML" | defuddle parse /dev/stdin --markdown
playwright-cli eval "document.documentElement.outerHTML" | defuddle parse /dev/stdin --json
```

## Resilience: CAPTCHAs and Bot Protection

The browser stack uses camoufox with anti-detection. Most bot protection can be worked through.

### When a CAPTCHA appears:

1. **Wait 10-15 seconds** — many reCAPTCHAs auto-resolve for legitimate-looking sessions.
2. **Reload the page** — `playwright-cli reload` then re-check the snapshot.
3. **Clear cookies and retry** — `playwright-cli cookie-clear` then navigate again. Bot-protection scores often reset.
4. **Try a different entry point** — navigate to the service's main page instead of directly to the login URL. Let the session build browsing context before hitting auth.
5. **Wait longer between actions** — rapid-fire interactions trigger bot detection. Add delays between fills and clicks using `sleep 2` between commands.

### When a page blocks interaction:

1. **Take a snapshot** to verify the actual page state. Don't assume from a URL.
2. **Try `playwright-cli eval`** to inspect the DOM for hidden elements, iframes, or overlays.
3. **Switch to a new browser session** if the current one is burned: `playwright-cli close` then `playwright-cli open`.
4. **Never declare "bot protection" as a terminal excuse** — always try at least two different approaches first.

## Tips & Best Practices

### Command Chaining

Chain related commands with `&&` to reduce round trips and ensure sequential execution:

```bash
# Select answer and submit in one command
playwright-cli click e5 && playwright-cli click e10

# Fill multiple fields and submit
playwright-cli fill e3 "username" && playwright-cli fill e4 "password" && playwright-cli click e6
```

### Working with Element References

Understanding reference patterns helps with debugging and manual snapshot inspection:

- **Frame elements**: `f###` or `f<hash>` (e.g., `f63e71`, `f93e778`)
- **Page elements**: `e###` (e.g., `e15`, `e168`)
- Elements in iframes typically use frame-prefixed refs

Use `grep_search` to quickly find elements in snapshot YAML files:

```bash
# Find submit buttons in the latest snapshot
grep -i "button.*submit" .playwright-cli/page-*.yml | tail -1

# Find all text inputs
grep "type: text" .playwright-cli/page-*.yml | tail -1
```

### Handling Click Interceptions

If `TimeoutError: locator.click: Timeout exceeded` occurs, the click may be intercepted by overlays or z-index issues:

1. Try clicking the **parent container** instead of the direct input/button element
2. Check the snapshot YAML for container elements wrapping your target
3. Use `hover` before `click` to trigger hover states that reveal clickable areas

```bash
# Instead of clicking the radio input directly
playwright-cli click f63e72  # ❌ might be intercepted

# Click its container
playwright-cli click f63e71  # ✅ more reliable
```

### Strategic Snapshot Naming

Use `--filename=` for important checkpoints that document workflow state:

```bash
# Auto-generated timestamp (default)
playwright-cli snapshot

# Named artifact for verification
playwright-cli snapshot --filename=login-success.yml
playwright-cli snapshot --filename=form-submitted.yml
playwright-cli snapshot --filename=final-state.yml
```

Named snapshots are easier to reference later and serve as workflow documentation.

### Console Errors Are Often Normal

Many production websites log numerous console errors and warnings. Don't be alarmed by:

```
Console: 23 errors, 175 warnings
```

Focus on:

- Whether your actions succeeded (check snapshot state)
- Whether expected elements appeared/disappeared
- Whether page navigation occurred as expected

Only investigate console errors if your automation fails unexpectedly.

### Verifying State Between Actions

Take snapshots at key points to verify state transitions:

```bash
# Before action
playwright-cli snapshot --filename=before-submit.yml

# Perform action
playwright-cli click e10

# After action - verify result
playwright-cli snapshot --filename=after-submit.yml
```

Then use `grep_search` to verify expected changes:

```bash
# Check for success message
grep -i "success\|passed\|complete" after-submit.yml

# Verify score or status
grep -i "score\|status" after-submit.yml
```

### Reading Snapshot Files Efficiently

Snapshot YAML files contain the full page structure. Use text tools to extract what you need:

```bash
# Get all button texts
grep "button" page.yml | grep "text:"

# Find elements by label
grep -A 5 "Email Address" page.yml

# Check current URL and title
head -20 page.yml
```

This is faster than reading entire large snapshot files when you know what you're looking for.

## Specific tasks

- **Request mocking** [references/request-mocking.md](references/request-mocking.md)
- **Running Playwright code** [references/running-code.md](references/running-code.md)
- **Browser session management** [references/session-management.md](references/session-management.md)
- **Storage state (cookies, localStorage)** [references/storage-state.md](references/storage-state.md)
- **Test generation** [references/test-generation.md](references/test-generation.md)
- **Tracing** [references/tracing.md](references/tracing.md)
- **Video recording** [references/video-recording.md](references/video-recording.md)
