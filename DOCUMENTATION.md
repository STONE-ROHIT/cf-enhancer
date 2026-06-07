# CF Enhancer — Complete Codebase Documentation

> Written for someone who wants to understand every decision, every line, and every reason behind this project. No prior Chrome extension experience assumed.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [How Chrome Extensions Work](#2-how-chrome-extensions-work)
3. [Project Structure](#3-project-structure)
4. [The Build System](#4-the-build-system)
5. [manifest.json](#5-manifestjson)
6. [background.js](#6-backgroundjs)
7. [content.js](#7-contentjs)
8. [dashboard.css](#8-dashboardcss)
9. [popup.html](#9-popuphtml)
10. [popup.js](#10-popupjs)
11. [popup.css](#11-popupcss)
12. [generate-icons.js](#12-generate-iconsjs)
13. [Data Flow — End to End](#13-data-flow--end-to-end)
14. [Key Technical Decisions](#14-key-technical-decisions)
15. [Problems We Solved](#15-problems-we-solved)
16. [Interview Q&A](#16-interview-qa)

---

## 1. What This Project Is

CF Enhancer is a Chrome extension that completely replaces the Codeforces profile page with a better one. When you visit `codeforces.com/profile/anyuser`, the extension:

- Hides the original Codeforces profile content
- Fetches the user's data from the public Codeforces API
- Injects a custom-built analytics dashboard in its place

The dashboard shows:
- Hero section with avatar, rating, rank, max rating, contest count, contribution
- User details — country, city, organization, registration date, friend count
- Social links scraped from the original page
- Rating history as an interactive line chart
- Problems solved grouped by difficulty as a bar chart
- Recent contests table
- Weakness detection — topics with the lowest solve rate, shown as a horizontal bar chart
- Submission activity heatmap — GitHub-style contribution graph for the past year
- Recent submissions table with verdict badges
- Blog posts list

The extension also has a popup — the small UI that appears when you click the extension icon in the Chrome toolbar. The popup lets you search any Codeforces handle and jump to their enhanced profile.

**Why this is technically interesting:**
- It injects a full UI into someone else's website without breaking anything
- It scrapes data from the DOM before hiding it, then replaces the page with API-fetched data
- It uses a correct Chrome extension architecture with separation between content scripts, background scripts, and popup
- The data processing functions (especially weakness detection) require real thinking about deduplication and accuracy

---

## 2. How Chrome Extensions Work

Before reading the code, you need to understand how Chrome extensions are structured. There are three distinct environments that run separately and can only communicate through Chrome's message passing API.

### The Three Environments

**Content Script**
Runs inside the webpage you're visiting. It can read and modify the DOM — the HTML structure of the page. In this project, `content.js` runs inside `codeforces.com/profile/*` and is responsible for detecting the profile page, scraping social links from the original DOM, hiding the original content, and injecting the dashboard.

Limitation: content scripts cannot make certain API calls directly and should not contain business logic. They should focus on UI.

**Background Script (Service Worker)**
Runs in the background, completely separate from any webpage. It has no access to the DOM. In this project, `background.js` is responsible for making all API calls to the Codeforces API. It listens for messages from the content script, fetches the data, and sends it back.

Think of the background script as the backend of the extension. The content script is the frontend.

**Popup**
A small HTML page that appears when you click the extension icon in the Chrome toolbar. It has its own JavaScript and CSS. In this project, the popup lets you search any handle and navigate to their enhanced profile. It can also detect if you're currently on a Codeforces profile and show a contextual button.

### How They Communicate

The content script and background script cannot call each other's functions directly. They communicate through Chrome's message passing system.

Content script sends a message:
```javascript
chrome.runtime.sendMessage({ type: 'FETCH_USER_DATA', handle }, (response) => {
  // do something with response
})
```

Background script listens for it:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_USER_DATA') {
    fetchUserData(message.handle).then(sendResponse)
    return true  // critical — keeps channel open for async response
  }
})
```

The `return true` at the end of the listener is critical. Without it, Chrome closes the message channel before the async `fetchUserData` call completes, and the response never arrives.

### The Build Process

We write source code in `src/`. Vite compiles and bundles it into `dist/`. Chrome loads the `dist/` folder as the extension. Every time you change source code you need to run `npm run build` and then reload the extension in `chrome://extensions`.

---

## 3. Project Structure

```
cf-enhancer/
├── public/                     ← Files copied as-is to dist/
│   ├── manifest.json           ← The brain of the extension
│   ├── popup.html              ← The popup UI
│   └── icons/                  ← Extension icons (16, 32, 48, 128px)
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
├── src/                        ← Source code (compiled by Vite)
│   ├── background/
│   │   └── background.js       ← Fetches API data
│   ├── content/
│   │   ├── content.js          ← Injects dashboard into Codeforces
│   │   └── dashboard.css       ← All styles for the dashboard
│   └── popup/
│       ├── popup.js            ← Popup logic
│       └── popup.css           ← Popup styles
├── generate-icons.js           ← Script that generates the PNG icons
├── vite.config.js              ← Tells Vite how to build for Chrome
├── package.json                ← Dependencies and scripts
└── dist/                       ← Built output — what Chrome loads
    ├── manifest.json
    ├── popup.html
    ├── background.js
    ├── content.js
    ├── popup.js
    ├── assets/popup.css
    └── icons/
```

**Why `public/` vs `src/`?**

Files in `public/` are copied directly to `dist/` without any processing. This is where we put files that don't need to be compiled — `manifest.json`, `popup.html`, and the icons.

Files in `src/` are processed by Vite — imports are resolved, dependencies are bundled, and the output is written to `dist/`.

---

## 4. The Build System

**File: `vite.config.js`**

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.js'),
        content: resolve(__dirname, 'src/content/content.js'),
        background: resolve(__dirname, 'src/background/background.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
```

**Why Vite?**

We use Vite because our project uses third-party npm packages (Chart.js). Without a bundler, we couldn't import npm packages. Vite takes our source files, resolves all imports, and bundles everything into files that Chrome can run.

**Why three entry points?**

By default, Vite expects a single-page app with one entry point. A Chrome extension has three separate environments — background, content, and popup — each needing its own bundled output file. We tell Vite explicitly about all three via `rollupOptions.input`.

**Why `entryFileNames: '[name].js'`?**

By default, Vite adds a hash to output filenames like `content-a3f9bc.js`. This is useful for web apps (prevents browser caching stale files) but breaks Chrome extensions because `manifest.json` must reference exact filenames. This option tells Vite to use clean names like `content.js`, `background.js`, `popup.js`.

**Why `chunkFileNames` and `assetFileNames`?**

Same reason — predictable filenames. If Vite splits code into shared chunks or generates CSS files, we need to know their names in advance. The `assets/[name].[ext]` pattern puts all assets (like CSS) into an `assets/` folder with their original names.

**Why is `popup.html` in `public/` and not `src/`?**

When an HTML file is used as a Vite entry point, Vite tries to control its output path and embeds a module script tag. This caused the HTML to end up at `dist/src/popup/popup.html` instead of `dist/popup.html`, breaking the manifest reference.

The solution was to put `popup.html` in `public/` — files there are copied as-is to the root of `dist/` without any processing. The JS and CSS are still compiled from `src/` and referenced from the HTML.

---

## 5. manifest.json

**File: `public/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "CF Enhancer",
  "version": "1.0.0",
  "description": "A better Codeforces experience",
  "permissions": [
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://codeforces.com/*",
    "https://codeforces.com/api/*"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["https://codeforces.com/*"],
      "js": ["content.js"]
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "CF Enhancer",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**`manifest_version: 3`**
The current standard Chrome requires. Manifest V2 is being phased out. V3 introduced Service Workers as background scripts (replacing persistent background pages) and tightened security around what extensions can do.

**`permissions: ["storage", "tabs"]`**
- `storage` — allows the extension to use Chrome's local storage API to save data. We declare it even though we haven't used it yet, as it's needed for future features like saving preferences.
- `tabs` — required by the popup to call `chrome.tabs.query` (to detect the current tab's URL) and `chrome.tabs.create` (to open a new tab to a profile). Without this permission, those calls fail silently.

**`host_permissions`**
Tells Chrome which external websites the extension is allowed to interact with and make requests to. We need two:
- `https://codeforces.com/*` — to inject our content script into Codeforces pages
- `https://codeforces.com/api/*` — to allow the background script to fetch from the Codeforces API

**`content_scripts`**
Tells Chrome to automatically inject `content.js` into every page matching `https://codeforces.com/*`. The injection happens automatically when the page loads — no user action needed. The `matches` field is a URL pattern. `/*` means any path on that domain.

The path `content.js` refers to `dist/content.js`, the built output.

**`background.service_worker`**
Registers the background script. In Manifest V3, background scripts must be service workers — they can't run persistently and are started on demand when messages arrive. `background.js` refers to `dist/background.js`.

**`action`**
Defines what happens when the user clicks the extension icon in the Chrome toolbar. `default_popup` points to the HTML file that opens. `default_icon` sets the icon images at each size. Chrome uses different sizes in different contexts — the toolbar uses 16 or 32, the extensions management page uses 48, and the Chrome Web Store uses 128.

**`icons`**
These are the extension's identity icons used in places like `chrome://extensions` and the Chrome Web Store listing. Separate from `action.default_icon` though in our case they point to the same files.

---

## 6. background.js

**File: `src/background/background.js`**

```javascript
async function fetchUserData(handle) {
  try {
    const [infoRes, ratingRes, statusRes, blogRes] = await Promise.all([
      fetch(`https://codeforces.com/api/user.info?handles=${handle}`),
      fetch(`https://codeforces.com/api/user.rating?handle=${handle}`),
      fetch(`https://codeforces.com/api/user.status?handle=${handle}&count=1000`),
      fetch(`https://codeforces.com/api/user.blogEntries?handle=${handle}`)
    ])

    const [info, rating, status, blog] = await Promise.all([
      infoRes.json(),
      ratingRes.json(),
      statusRes.json(),
      blogRes.json()
    ])

    return { info, rating, status, blog }
  } catch (error) {
    return { error: error.message }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_USER_DATA') {
    fetchUserData(message.handle).then(sendResponse)
    return true
  }
})
```

### Why the background script handles all API calls

This is a core architectural decision. We could have fetched the API directly from the content script, but we didn't. The reasons:

1. **Separation of concerns.** Content scripts should handle UI. Business logic and network requests belong in the background script. This is the correct Chrome extension architecture.
2. **Reliability.** Background service workers have a consistent network context. Content scripts run in the context of the webpage and can be affected by the page's own network policies.
3. **Interview value.** Being able to explain this separation clearly is a mark of someone who understands the architecture rather than just making it work.

### `Promise.all` — two rounds

Notice there are two `Promise.all` calls, not one. The first fires all four HTTP requests simultaneously:

```javascript
const [infoRes, ratingRes, statusRes, blogRes] = await Promise.all([...])
```

The second parses all four responses simultaneously:

```javascript
const [info, rating, status, blog] = await Promise.all([
  infoRes.json(), ratingRes.json(), statusRes.json(), blogRes.json()
])
```

Why two rounds? Because `.json()` is also asynchronous. We can't call `.json()` until we have the response object, but once we have all four response objects we can parse them all at the same time instead of sequentially.

If we had done this sequentially (fetch info, parse info, fetch rating, parse rating...) it would take roughly 4x longer. `Promise.all` makes them all run in parallel.

### `&count=1000` on the status endpoint

The Codeforces `user.status` endpoint returns all submissions by default. For a user like `tourist` who has been competing since 2009, this is tens of thousands of submissions. Sending that much data over Chrome's message passing system caused the response to silently fail.

We limit to the 1000 most recent submissions, which is more than enough for all our analytics (weakness detection, activity heatmap, recent submissions table) and prevents the message passing from breaking.

### The Codeforces API — four endpoints used

**`user.info?handles={handle}`**
Returns basic profile data: handle, rating, maxRating, rank, maxRank, titlePhoto (avatar URL), country, city, organization, registrationTimeSeconds, friendOfCount, contribution.

**`user.rating?handle={handle}`**
Returns the full contest history as an array of rating change objects. Each object contains: contestId, contestName, rank, oldRating, newRating, ratingUpdateTimeSeconds. Sorted oldest first.

**`user.status?handle={handle}&count=1000`**
Returns up to 1000 most recent submissions. Each submission contains: problem (name, contestId, index, rating, tags), verdict, programmingLanguage, creationTimeSeconds.

**`user.blogEntries?handle={handle}`**
Returns all blog posts written by the user. Each entry contains: id, title, creationTimeSeconds.

### Error handling

The entire fetch is wrapped in a `try/catch`. If anything fails (network error, invalid handle, API down), we return `{ error: error.message }` instead of throwing. The content script checks for this and either shows an error message or restores the original Codeforces content.

### `return true` in the message listener

This is the most important line in `background.js`. Chrome's `onMessage` listener is synchronous by default. If you don't return anything, Chrome assumes the response has been sent and closes the message channel immediately. Because `fetchUserData` is async, by the time it resolves, the channel is already closed and `sendResponse` has no effect.

Returning `true` tells Chrome: "I know the response is coming asynchronously, keep the channel open." Without this single line, the content script would call `chrome.runtime.sendMessage` and never receive a response, causing the dashboard to stay stuck at "Loading CF Enhancer..." forever.

---

## 7. content.js

**File: `src/content/content.js`**

This is the largest and most complex file. It is responsible for everything that appears on the page. We'll go through it function by function.

### Imports

```javascript
import dashboardCSS from './dashboard.css?inline'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)
```

**`?inline` suffix**
This is a Vite feature. Normally, when you import a CSS file in JavaScript, Vite extracts it as a separate `.css` file. The `?inline` suffix tells Vite to give us the CSS content as a plain JavaScript string instead. We then inject this string as a `<style>` tag into the page's `<head>`.

Why do we need this? Because content scripts can't link to external CSS files — Chrome would need to know the file's path ahead of time, and the path depends on the extension ID which changes. The correct approach is to inject CSS programmatically as a string.

**`Chart.register(...registerables)`**
Chart.js is modular — you only load the chart types you need. `registerables` is a convenience array that contains all chart types, scales, and plugins. By registering all of them, we can use any chart type without importing individual components. The spread `...` unpacks the array so each item is registered individually.

---

### `getHandleFromURL()`

```javascript
function getHandleFromURL() {
  const match = window.location.pathname.match(/^\/profile\/(.+)/)
  if (match) return match[1]
  return null
}
```

`window.location.pathname` gives us just the path part of the current URL, stripping the domain. So for `https://codeforces.com/profile/tourist`, it gives us `/profile/tourist`.

The regex `/^\/profile\/(.+)/` breaks down as:
- `^` — must start at the beginning of the string
- `\/profile\/` — literal `/profile/`
- `(.+)` — capture group: one or more of any character (the username)

`match[1]` is the first capture group — the username. If the URL doesn't match the pattern, `match` is `null` and we return `null`. The caller checks for `null` and does nothing if the page isn't a profile.

---

### `getRankColor(rank)`

```javascript
function getRankColor(rank) {
  if (!rank) return '#808080'
  const map = {
    'newbie': '#808080',
    'pupil': '#008000',
    'specialist': '#03a89e',
    'expert': '#0070ff',
    'candidate master': '#aa00aa',
    'master': '#ff8c00',
    'international master': '#ff8c00',
    'grandmaster': '#ff3333',
    'international grandmaster': '#ff1111',
    'legendary grandmaster': '#ff0000'
  }
  return map[rank.toLowerCase()] || '#808080'
}
```

Maps each Codeforces rank to its official color. These exact colors are what Codeforces uses on their own site. Using the same colors makes the dashboard feel authentic to CP users who immediately recognize them.

The `.toLowerCase()` call handles inconsistencies in capitalization from the API. We fall back to grey (`#808080`) for any unrecognized rank.

---

### `scrapeSocialLinks()`

```javascript
function scrapeSocialLinks() {
  const links = []
  const seen = new Set()
  const anchors = document.querySelectorAll('.info a[href], .userbox a[href]')
  for (const a of anchors) {
    const href = a.href
    if (!href || seen.has(href)) continue
    if (!href.startsWith('http')) continue
    if (href.includes('codeforces.com')) continue
    seen.add(href)
    let label = a.textContent.trim()
    if (!label) {
      try { label = new URL(href).hostname.replace('www.', '') }
      catch { label = href }
    }
    links.push({ href, label })
  }
  return links
}
```

This function is called at the very beginning of `init()`, before we hide the original Codeforces content. That timing is critical — once we set `display: none` on the original elements, we can no longer read from them. So we scrape first, hide second.

`.info` and `.userbox` are CSS class names from Codeforces' own HTML structure where they render the user's profile information including social links.

The filtering logic:
- Skip empty hrefs
- Skip duplicate URLs (a Set is used for O(1) lookup)
- Skip non-HTTP links (like `mailto:` or `javascript:`)
- Skip any link back to Codeforces itself — we only want external social links

For the label, we first try the link's text content. If the link has no text (icon-only links), we extract the hostname from the URL. `new URL(href).hostname` gives us `www.twitter.com` and `.replace('www.', '')` gives us `twitter.com`.

---

### `processSubmissions(submissions)`

```javascript
function processSubmissions(submissions) {
  if (!submissions || !Array.isArray(submissions)) return {
    totalSolved: 0,
    groups: { '<1000': 0, '1000': 0, ... }
  }
  const solved = new Map()
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const key = `${sub.problem.contestId}-${sub.problem.index}`
      if (!solved.has(key)) solved.set(key, sub.problem)
    }
  }
  const groups = { '<1000': 0, '1000': 0, '1100': 0, ... }
  for (const problem of solved.values()) {
    const r = problem.rating
    if (!r) continue
    else if (r < 1000) groups['<1000']++
    // ... etc
  }
  return { totalSolved: solved.size, groups }
}
```

This function counts how many unique problems the user has solved, grouped by difficulty rating.

**The deduplication Map:**
A user might attempt the same problem 50 times. We only want to count it once when they finally solve it. We use a Map keyed by `${contestId}-${problemIndex}` — a unique identifier for each problem. For example, problem A from contest 1234 becomes the key `"1234-A"`.

We only add a problem to the map when its verdict is `'OK'` (accepted). This means a problem only appears in `solved` when it has actually been solved at least once.

**The difficulty groups:**
The 13 groups follow Codeforces' problem rating system starting at less than 1000 and going up to 2000+. Each group maps to Codeforces' color scheme used in the bar chart.

**Null check at the start:**
If `submissions` is not an array (which can happen if the API call failed or the data was malformed), we return an empty structure instead of throwing an error. This defensive pattern is repeated throughout the codebase.

---

### `processWeaknesses(submissions)`

```javascript
function processWeaknesses(submissions) {
  if (!submissions || !Array.isArray(submissions)) return []
  const problemMap = new Map()
  for (const sub of submissions) {
    const key = `${sub.problem.contestId}-${sub.problem.index}`
    const tags = sub.problem.tags || []
    if (!problemMap.has(key)) problemMap.set(key, { tags, solved: false })
    if (sub.verdict === 'OK') problemMap.get(key).solved = true
  }
  const tagStats = new Map()
  for (const { tags, solved } of problemMap.values()) {
    for (const tag of tags) {
      if (!tagStats.has(tag)) tagStats.set(tag, { attempted: 0, solved: 0 })
      const stat = tagStats.get(tag)
      stat.attempted++
      if (solved) stat.solved++
    }
  }
  const results = []
  for (const [tag, { attempted, solved }] of tagStats.entries()) {
    if (attempted < 5) continue
    const solveRate = Math.round((solved / attempted) * 100)
    results.push({ tag, attempted, solved, solveRate })
  }
  results.sort((a, b) => a.solveRate - b.solveRate)
  return results.slice(0, 8)
}
```

This is the most algorithmically interesting function in the project. It answers the question: "Which topics does this user struggle with most?"

**Why two passes instead of one:**

The naive approach would be: loop through submissions, and for each accepted submission, increment `solved` for each of its tags. But this is wrong.

Consider: a user submits a `dp` problem 10 times before finally solving it. In the naive approach, the `dp` tag gets 1 solved and 10 attempted — but that's the same problem counted 10 times in attempted. The solve rate would be artificially low (1/10 = 10%), but really it's 1 unique problem solved out of 1 unique problem attempted (100%).

**The correct two-pass approach:**

Pass 1 — build `problemMap` of unique problems.
- Key: `contestId-problemIndex` (e.g., `"1234-A"`)
- Value: `{ tags: [...], solved: false }`
- Every submission gets added on first encounter, regardless of verdict
- If any submission for this problem has verdict `OK`, we set `solved: true`

This gives us a map where each unique problem appears exactly once, with an accurate "was it ever solved" flag.

Pass 2 — aggregate tag statistics from unique problems.
- For each unique problem, loop through its tags
- Increment `attempted` for each tag
- If the problem was solved, also increment `solved` for each tag

Now `attempted` counts unique problems per tag, not submissions. The solve rate is honest.

**The `attempted < 5` filter:**
If a user has only tried 2 problems tagged `bitmasks`, a 50% solve rate (1 solved out of 2 attempted) is statistically meaningless. We require at least 5 attempts before including a tag in the results. This prevents noise from tags the user barely touched.

**`results.slice(0, 8)`:**
We return only the 8 weakest topics. More than 8 makes the horizontal bar chart crowded and harder to read at 12px font size.

---

### `processActivity(submissions)`

```javascript
function processActivity(submissions) {
  if (!submissions || !Array.isArray(submissions)) return new Map()
  const activityMap = new Map()
  for (const sub of submissions) {
    const date = new Date(sub.creationTimeSeconds * 1000)
    const key = date.toISOString().split('T')[0]
    activityMap.set(key, (activityMap.get(key) || 0) + 1)
  }
  return activityMap
}
```

Converts the submissions array into a Map where each key is a date string like `"2024-06-15"` and each value is the count of submissions on that day.

`creationTimeSeconds * 1000` — Unix timestamps are in seconds, but JavaScript's `new Date()` expects milliseconds. We multiply by 1000 to convert.

`toISOString().split('T')[0]` — `toISOString()` gives us `"2024-06-15T10:30:00.000Z"`. Splitting on `'T'` and taking index `[0]` gives us just the date part `"2024-06-15"`. This format is consistent regardless of timezone and sorts lexicographically in date order.

`(activityMap.get(key) || 0) + 1` — if the key doesn't exist yet, `get` returns `undefined`, which `|| 0` converts to `0`. We add 1 and set the new count. This is the standard pattern for counting with a Map.

---

### `getHeatmapColor(count)`

```javascript
function getHeatmapColor(count) {
  if (count === 0) return '#1a1a2e'
  if (count <= 2) return 'rgba(0, 212, 170, 0.3)'
  if (count <= 5) return 'rgba(0, 212, 170, 0.55)'
  if (count <= 9) return 'rgba(0, 212, 170, 0.75)'
  return 'rgba(0, 212, 170, 1.0)'
}
```

Returns the background color for a heatmap cell based on how many submissions happened that day. Five levels — empty, light, medium-light, medium-dark, and full — create a visual gradient from inactive to very active. All levels use the same cyan color (`0, 212, 170`) at increasing opacity, creating a cohesive look.

More than 5 levels would be difficult to distinguish at a 12px cell size. Fewer levels would lose nuance. Five is the right balance, same as GitHub's contribution graph.

---

### `buildHeatmapHTML(submissions)`

This function builds the full GitHub-style activity heatmap as HTML. The key logic:

**Start date calculation:**
```javascript
const startDate = new Date(today)
startDate.setDate(startDate.getDate() - 52 * 7 + 1)
startDate.setDate(startDate.getDate() - startDate.getDay())
```

We go back 52 weeks and then snap back to the nearest Sunday. This ensures every column of the heatmap starts on Sunday, making the grid columns align consistently. `getDay()` returns 0 for Sunday, 1 for Monday, etc. Subtracting it snaps back to Sunday.

**53 weeks loop:**
We iterate 53 weeks rather than 52 because depending on where the year starts, the last partial week might extend into a 53rd column to reach today. This is the same approach used by GitHub.

**Future cells:**
`const isFuture = current > today`
We mark cells in the future as transparent (not dark grey) to avoid user confusion about why those days show zero activity.

**Month labels:**
We track when the month changes at the start of a new week column and position labels using absolute CSS positioning with `left: ${week * 15}px`. Each cell is 12px wide plus 3px gap = 15px per column.

---

### `buildUserDetails(user, socialLinks)`

Builds the user details card below the hero section. Shows country, organization, member since date, friend count, and social links.

Each detail is built from the `user.info` API response. `registrationTimeSeconds` is converted from Unix timestamp to a human-readable date using `toLocaleDateString`.

If there are no details to show (user has no location, no organization, no social links), the function returns an empty string and the card is not rendered at all, avoiding a visually empty card.

---

### `getVerdictClass(verdict)` and `getVerdictLabel(verdict)`

```javascript
function getVerdictClass(verdict) {
  const map = { 'OK': 'cfe-verdict-ac', 'WRONG_ANSWER': 'cfe-verdict-wa', ... }
  return map[verdict] || 'cfe-verdict-other'
}

function getVerdictLabel(verdict) {
  const map = { 'OK': 'AC', 'WRONG_ANSWER': 'WA', ... }
  return map[verdict] || (verdict ? verdict.slice(0, 4) : '?')
}
```

The Codeforces API returns verdicts as long strings like `'TIME_LIMIT_EXCEEDED'`. These functions convert them to:
- Short labels for display: `TLE`, `WA`, `AC` etc.
- CSS class names for color coding: `cfe-verdict-tle`, `cfe-verdict-wa`, `cfe-verdict-ac` etc.

For unknown verdicts, `getVerdictLabel` takes the first 4 characters as a reasonable abbreviation. `getVerdictClass` falls back to a neutral grey `cfe-verdict-other` class.

---

### `buildRecentSubmissions(submissions)`

Builds a table of the 15 most recent submissions. Each row shows the problem name (as a clickable link to the problem), verdict badge, programming language, and date.

The problem URL is constructed as `https://codeforces.com/contest/{contestId}/problem/{index}`. This is the correct Codeforces URL format.

`sub.programmingLanguage.split(' ')[0]` — Codeforces returns language strings like `"GNU G++17 7.3.0"`. We take only the first word to keep the table clean.

---

### `buildBlogPosts(blog)`

Builds a list of up to 10 blog posts with their titles as links and creation dates. Blog post URLs follow the pattern `https://codeforces.com/blog/entry/{id}`.

---

### `buildRatingChartData(ratingHistory)`

Converts the raw rating history array into the format Chart.js expects:
- `labels` — an array of date strings for the X axis
- `data` — an array of rating numbers for the Y axis

Dates are formatted as `"Jun '24"` style using `toLocaleDateString`.

---

### `buildRecentContests(ratingHistory)`

```javascript
function buildRecentContests(ratingHistory) {
  if (!ratingHistory || ratingHistory.length === 0) return []
  return [...ratingHistory].reverse().slice(0, 15)
}
```

The `[...ratingHistory]` spread creates a copy before reversing. This is important — `Array.reverse()` mutates the original array in place. If we reversed `ratingHistory` directly, we would destroy the ordering that `buildRatingChartData` depends on (oldest to newest for the chart). Creating a copy lets us reverse for the table without affecting the chart data.

---

### `buildDashboardHTML(info, ratingHistory, submissions, blog, socialLinks)`

Assembles all the dashboard sections into a single HTML string. This function doesn't contain logic — it just composes the HTML output from the results of other functions.

Notable: `${userDetailsHTML ? `<div ...>${userDetailsHTML}</div>` : ''}` — if `buildUserDetails` returned an empty string (user has no location/social data), the entire card is skipped. This prevents rendering visually empty cards.

---

### `renderCharts(ratingHistory, submissions)`

Creates all three Chart.js visualizations after the HTML has been injected into the DOM. Charts can only be created after their `<canvas>` elements exist in the DOM, which is why this is called after `root.innerHTML` is set.

**Rating History Chart — Line Chart:**
- `fill: true` — fills the area under the line with a semi-transparent color (8% opacity)
- `tension: 0.3` — slight curve to the line, less jagged than straight segments
- `pointRadius: 2` — small dots at each data point, large enough to be hovered
- `pointHoverRadius: 5` — dots enlarge on hover for better interactivity
- `maxTicksLimit: 12` — prevents the X axis from showing every single contest for users with hundreds of contests

**Problems by Difficulty Chart — Bar Chart:**
Colors follow Codeforces' own rating color scheme: grey for under 1000, green for 1000-1300, cyan for 1200-1400, blue for 1400-1600, purple for 1600-1800, orange for 1800-2000, red for 2000+. Users familiar with Codeforces instantly recognize the meaning.

**Weakness Detection Chart — Horizontal Bar Chart:**
`indexAxis: 'y'` — this single Chart.js option flips the chart horizontal. Topic names go on the Y axis, solve rate percentage on the X axis. This is better than vertical because topic names (like `"dynamic programming"`) are too long to display comfortably on a vertical X axis.

Color coding by solve rate:
- Red (`rgba(255, 77, 109, 0.8)`) — below 40%. Critical weakness.
- Orange (`rgba(255, 140, 0, 0.8)`) — 40% to 65%. Moderate weakness.
- Green (`rgba(0, 212, 170, 0.8)`) — above 65%. Reasonable performance.

Custom tooltip callback:
```javascript
label: (ctx) => {
  const w = weaknesses[ctx.dataIndex]
  return ` ${w.solveRate}% solve rate (${w.solved}/${w.attempted})`
}
```
Shows both the percentage and the raw numbers on hover. `8/10 (80%)` is more meaningful than just `80%` because it tells you how many problems the data is based on.

---

### `init()` — The Entry Point

```javascript
async function init() {
  const handle = getHandleFromURL()
  if (!handle) return

  const socialLinks = scrapeSocialLinks()

  const style = document.createElement('style')
  style.textContent = dashboardCSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'cf-enhancer-root'
  root.innerHTML = `<div style="...">Loading CF Enhancer...</div>`

  const target = document.querySelector('#pageContent')
  if (!target) return
  target.prepend(root)

  Array.from(target.children).forEach(child => {
    if (child.id !== 'cf-enhancer-root') child.style.display = 'none'
  })

  chrome.runtime.sendMessage({ type: 'FETCH_USER_DATA', handle }, (response) => {
    if (response.error) {
      Array.from(target.children).forEach(child => {
        if (child.id !== 'cf-enhancer-root') child.style.display = ''
      })
      root.innerHTML = `<div style="color: #ff4d6d; ...">Error: ${response.error}</div>`
      return
    }

    root.innerHTML = buildDashboardHTML(response.info, response.rating, response.status, response.blog, socialLinks)
    renderCharts(response.rating, response.status)
  })
}
```

The execution sequence is deliberate:

**Step 1:** Check if we're on a profile page. If not, exit immediately. The content script runs on all Codeforces pages due to `"matches": ["https://codeforces.com/*"]`, but we only want to do anything on profile pages.

**Step 2:** Scrape social links from the original DOM while it still exists.

**Step 3:** Inject our CSS into `<head>`. This must happen before we inject HTML, otherwise elements would briefly appear unstyled.

**Step 4:** Create and prepend our root div with a loading message. The user sees "Loading CF Enhancer..." immediately — this is important UX. Without it, the space would be empty during the API fetch.

**Step 5:** Hide all other children of `#pageContent`. This is how we do the full page replacement — we don't delete the original elements, we just hide them. `#pageContent` is the Codeforces div that contains the profile content. `target.prepend(root)` makes our dashboard the first child. Then we loop through all other children and set `display: none`.

We hide rather than delete for two reasons: first, it's easier to restore if something goes wrong. Second, we already scraped the social links, so we no longer need to read from the original DOM — just hide it.

**Step 6:** Fetch data from the background script via message passing.

**Step 7 (on error):** Restore the original content by removing `display: none` and show a red error message. The user sees the original Codeforces page instead of a broken one.

**Step 8 (on success):** Replace the loading message with the full dashboard HTML, then render the charts.

---

## 8. dashboard.css

**File: `src/content/dashboard.css`**

### CSS Scoping

```css
#cf-enhancer-root * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

This resets box model and spacing, but only inside our root element. We do NOT apply these resets globally because that would break Codeforces' own CSS. Similarly, all our CSS variables and styles are defined on `#cf-enhancer-root` rather than `:root` or `body`.

Every class we define is prefixed with `cfe-` (CF Enhancer). This is critical. If we named a class `.table`, it would conflict with any Codeforces class named `.table`. The prefix guarantees our styles only affect our own elements.

### CSS Custom Properties (Variables)

```css
#cf-enhancer-root {
  --bg-primary: #0d0d14;    /* Near-black background */
  --bg-card: #13131f;       /* Slightly lighter card background */
  --bg-hover: #1a1a2e;      /* Hover state background */
  --border: #1e1e2e;        /* Subtle border color */
  --accent: #00d4aa;        /* The cyan accent used throughout */
  --text-primary: #e8e8f0;  /* Main text — slightly cool white */
  --text-secondary: #8888aa; /* Muted text for labels */
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Sora', sans-serif;
}
```

Defining variables on `#cf-enhancer-root` rather than `:root` keeps them scoped. They can be used anywhere inside our dashboard without affecting the rest of the page.

### Typography Choices

**JetBrains Mono** for all numbers, handles, and data values. Monospaced fonts make numeric data easier to read — digits align vertically in tables, and the mechanical precision matches the technical context of a competitive programming dashboard.

**Sora** for all prose text, labels, and UI elements. It's a clean, modern geometric sans-serif that's distinctive without being distracting. It's not a default system font (Arial, Inter) or an overused tech font, which gives the dashboard a more intentional, designed feel.

### The Fade-In Animation

```css
@keyframes cfe-fadein {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Applied to `#cf-enhancer-root` with `animation: cfe-fadein 0.4s ease`. The dashboard slides in from slightly above with a fade. A 10px upward offset is subtle enough to feel natural but visible enough to create a sense of arrival. 0.4 seconds is fast enough to feel responsive, slow enough to be perceived.

### Verdict Badge Colors

```css
.cfe-verdict-ac  { background: rgba(0, 200, 150, 0.15); color: #00c896; }
.cfe-verdict-wa  { background: rgba(255, 77, 109, 0.15); color: #ff4d6d; }
.cfe-verdict-tle { background: rgba(255, 140, 0, 0.15);  color: #ff8c00; }
```

Each verdict type gets a colored badge. The background is a very low opacity (15%) version of the same color as the text. This creates a "pill" appearance that's colorful but not overwhelming. Green for accepted, red for wrong answer, orange for time/memory limits.

### Heatmap Cell Hover

```css
.cfe-heatmap-cell:hover {
  transform: scale(1.3);
}
```

Cells scale up slightly on hover, giving feedback that they're interactive. The `title` attribute on each cell shows the exact date and submission count as a tooltip on hover.

---

## 9. popup.html

**File: `public/popup.html`**

The popup HTML contains two sections:

**Search section:** An input field and an arrow button to search any Codeforces handle. Pressing Enter in the input or clicking the button opens that user's enhanced profile in a new tab.

**Current tab section:** A button that shows contextual text. If you're currently on a Codeforces profile page, it shows "View [handle]'s Profile". If you're not on a profile page, it shows "Not on a Codeforces profile" and is disabled.

Note: `popup.html` is in `public/` not `src/`. See the build system section for why.

The CSS link `<link rel="stylesheet" href="assets/popup.css" />` in the HTML is not the source CSS — it was left as a placeholder. The actual CSS is injected programmatically via `popup.js` using the `?inline` import pattern. The `<link>` tag does nothing in practice because Vite doesn't extract the popup CSS to `assets/popup.css` (it's bundled into `popup.js` via the `?inline` import).

---

## 10. popup.js

**File: `src/popup/popup.js`**

```javascript
import popupCSS from './popup.css?inline'

const style = document.createElement('style')
style.textContent = popupCSS
document.head.appendChild(style)
```

CSS is injected the same way as in the content script — as a string via `?inline`. This is the correct approach for extension HTML pages since Vite bundles the CSS into the JS file rather than generating a separate CSS file that the HTML can link to.

```javascript
function navigateToProfile(handle) {
  const trimmed = handle.trim()
  if (!trimmed) {
    errorMsg.classList.remove('hidden')
    return
  }
  errorMsg.classList.add('hidden')
  chrome.tabs.create({ url: `https://codeforces.com/profile/${trimmed}` })
  window.close()
}
```

`chrome.tabs.create` opens a new tab. `window.close()` closes the popup. Both happen together — after searching, the popup dismisses itself and the new tab opens, which is the natural expected behavior.

`.trim()` removes leading and trailing whitespace. If a user accidentally types a space, we still navigate correctly rather than sending `" tourist"` as the handle.

```javascript
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  const match = tab.url && tab.url.match(/codeforces\.com\/profile\/(.+)/)
  if (match) {
    currentBtn.textContent = `View ${match[1]}'s Profile`
    currentBtn.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true })
      window.close()
    })
  } else {
    currentBtn.disabled = true
    currentBtn.style.opacity = '0.4'
    currentBtn.style.cursor = 'not-allowed'
    currentBtn.textContent = 'Not on a Codeforces profile'
  }
})
```

`chrome.tabs.query` checks the current tab's URL. If it matches a Codeforces profile URL, the button text is personalized with the handle name and clicking it focuses that tab (`chrome.tabs.update` with `{ active: true }`).

If the current tab is not a Codeforces profile, the button is disabled visually (`opacity: 0.4`, `cursor: not-allowed`) and the `disabled` attribute prevents click events.

This makes the popup context-aware — its behavior adapts to where you are.

---

## 11. popup.css

**File: `src/popup/popup.css`**

The popup CSS does not use scoped variables or the `cfe-` prefix because the popup is a completely isolated HTML page — it has no contact with Codeforces' CSS. Global resets and unscoped class names are safe here.

The popup is fixed at `width: 300px` — the standard width for Chrome extension popups. Chrome will size the popup to fit its content up to the viewport width, but 300px is a comfortable reading width that prevents the popup from feeling too wide or too narrow.

`.hidden { display: none }` is a utility class toggled by JavaScript to show/hide the error message.

The active state of the search button:
```css
.search-btn:active {
  transform: scale(0.95);
}
```
The button shrinks slightly when clicked, giving tactile feedback that the click registered.

---

## 12. generate-icons.js

**File: `generate-icons.js`**

This is a one-time utility script run with `node generate-icons.js`. It is not part of the extension itself — it only generates the icon PNG files.

```javascript
import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

`__filename` and `__dirname` are built-in variables in CommonJS Node.js but don't exist in ES modules. This project uses `"type": "module"` in `package.json`, making all JS files ES modules by default. We reconstruct `__dirname` using `import.meta.url` and `fileURLToPath`.

```javascript
for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Draw rounded rectangle background
  const radius = size * 0.18
  ctx.fillStyle = '#0d0d14'
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ...
  ctx.closePath()
  ctx.fill()

  // Draw cyan border
  ctx.strokeStyle = '#00d4aa'
  ctx.lineWidth = size * 0.06
  ctx.stroke()

  // Draw "CF" text
  ctx.fillStyle = '#00d4aa'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${size * 0.42}px monospace`
  ctx.fillText('CF', size / 2, size / 2 + size * 0.03)
```

All measurements are proportional to `size` (`size * 0.18`, `size * 0.06`, etc.). This ensures the icon looks visually identical at 16px and 128px — the proportions scale correctly rather than being hardcoded pixel values that would look different at different sizes.

The rounded rectangle is drawn using quadratic Bezier curves at each corner. Canvas doesn't have a built-in `roundRect` method in older versions, so we construct it manually with `moveTo`, `lineTo`, and `quadraticCurveTo`.

`canvas.toBuffer('image/png')` encodes the canvas as PNG binary data. `fs.writeFileSync` writes it to disk.

---

## 13. Data Flow — End to End

This is what happens from the moment you navigate to `https://codeforces.com/profile/tourist`:

```
Browser loads codeforces.com/profile/tourist
        |
        v
Chrome reads manifest.json
        |
        v
Chrome injects content.js into the page (because URL matches pattern)
        |
        v
init() runs
        |
        ├── getHandleFromURL() → "tourist"
        |
        ├── scrapeSocialLinks() → reads original Codeforces DOM
        |
        ├── Injects dashboardCSS into <head>
        |
        ├── Creates #cf-enhancer-root with "Loading CF Enhancer..."
        |
        ├── target.prepend(root) → dashboard appears at top of page
        |
        ├── Hides all other children of #pageContent
        |
        └── chrome.runtime.sendMessage({ type: 'FETCH_USER_DATA', handle: 'tourist' })
                |
                v
        background.js wakes up (service worker)
                |
                v
        fetchUserData("tourist") fires 4 API calls in parallel:
                |
                ├── user.info?handles=tourist
                ├── user.rating?handle=tourist
                ├── user.status?handle=tourist&count=1000
                └── user.blogEntries?handle=tourist
                |
                v
        All 4 responses arrive and are parsed
                |
                v
        sendResponse({ info, rating, status, blog })
                |
                v
        content.js callback receives the response
                |
                v
        buildDashboardHTML() assembles HTML string
                |
                v
        root.innerHTML = dashboard HTML
                |
                v
        renderCharts() creates 3 Chart.js visualizations
```

---

## 14. Key Technical Decisions

### Why Vite and not plain JS?
We need Chart.js as a dependency. Without a bundler, importing npm packages in a browser extension is either impossible or requires loading separate script files. Vite lets us `import { Chart } from 'chart.js'` and handles bundling everything into a single file.

### Why separate background and content scripts?
This is the correct Chrome extension architecture. Content scripts interact with the page. Background scripts handle network and logic. Keeping them separate makes the code easier to reason about, easier to debug (each has its own DevTools console), and more secure.

### Why `?inline` for CSS?
CSS imported normally would be extracted as a separate `.css` file and linked via a `<link>` tag. Chrome extension content scripts can inject `<style>` tags but can't reliably link to external CSS files (the path includes the unpredictable extension ID). The `?inline` approach gives us the CSS as a string we can inject programmatically.

### Why hide original content instead of deleting it?
Hiding with `display: none` is reversible. If the API call fails, we can restore the original content immediately by setting `display: ''`. Deleting DOM nodes is permanent — if something goes wrong, the user would see a broken empty page.

We also scraped social links from the original DOM before hiding it. If we deleted the original content, those links would be gone.

### Why `Promise.all` for the API calls?
Four sequential API calls would take roughly 4x longer. `Promise.all` fires them all simultaneously and waits for all to complete. Network time is the bottleneck; doing things in parallel is the standard solution.

### Why a two-pass algorithm for weakness detection?
The naive single-pass approach would count multiple submissions of the same problem as multiple attempts, artificially lowering solve rates for topics where users retry problems. The two-pass approach first deduplicates problems, then aggregates per tag. This gives accurate, meaningful data.

### Why `[...ratingHistory].reverse()` instead of `ratingHistory.reverse()`?
`Array.reverse()` mutates the original array. The same `ratingHistory` data is used for both the rating chart (which needs oldest-first order) and the recent contests table (which needs newest-first order). Making a copy before reversing preserves the original array's order for the chart.

---

## 15. Problems We Solved

### Problem: Build output path for popup.html
When popup.html was used as a Vite entry point, it ended up at `dist/src/popup/popup.html` because Vite preserves the source directory structure for HTML entries. The manifest expected it at `dist/popup.html`.

Solution: Moved popup.html to `public/`. Files in `public/` are copied directly to the root of `dist/` without processing.

### Problem: Node.js version incompatibility
Running `npm create vite@latest` failed with `SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`. The machine had Node.js v18.19.1 but Vite v8 requires Node.js v20+.

Solution: Installed nvm (Node Version Manager) and upgraded to Node.js v20 with `nvm install 20 && nvm use 20`.

### Problem: Message passing failing for large data
When testing with `tourist` (who has tens of thousands of submissions), the dashboard got stuck at "Loading CF Enhancer...". The API call was succeeding but the response was too large for Chrome's message passing to serialize.

Solution: Added `&count=1000` to the `user.status` API endpoint to limit submissions to the 1000 most recent.

### Problem: Heatmap showing empty despite existing submissions
After adding the heatmap, it displayed entirely empty even for users with many submissions. The bug was passing `submissions` (the full API response object `{ status: 'OK', result: [...] }`) instead of `submissions.result` (the array) to `buildHeatmapHTML`.

Solution: Changed `buildHeatmapHTML(submissions)` to `buildHeatmapHTML(submissions.result)`.

### Problem: CSS not loading in popup
The popup appeared with white background and plain unstyled text. The `<link>` tag in popup.html pointed to `assets/popup.css` but Vite was bundling the CSS into `popup.js` rather than extracting it as a separate file.

Solution: Imported CSS using the `?inline` pattern and injected it as a `<style>` tag, same as the content script. Removed the `<link>` tag from popup.html.

---

## 16. Interview Q&A

These are the questions you should be able to answer confidently.

---

**Q: Walk me through the architecture of this extension.**

A: The extension has three separate environments. The content script runs inside Codeforces pages — it detects when we're on a profile page, scrapes social links from the original DOM, hides the original content, and injects the dashboard UI. The background script acts as a service layer — it receives messages from the content script, makes all four Codeforces API calls in parallel using Promise.all, and sends the data back. The popup is a small standalone HTML page that lets you search any handle. They communicate through Chrome's message passing API.

---

**Q: Why don't you fetch the API directly from the content script?**

A: Two reasons. First, separation of concerns — content scripts should handle UI, not network requests. It makes the code easier to reason about and debug. Second, the background script is the correct place for network requests in Chrome extensions architecturally. If we needed to add caching or rate limiting in the future, there's one clear place to do it.

---

**Q: Why does `background.js` return `true` from the message listener?**

A: Chrome's message listener is synchronous by default. If you don't return anything, Chrome closes the message channel as soon as the listener function returns. Since `fetchUserData` is async, it hasn't resolved yet when the listener returns. Returning `true` tells Chrome to keep the channel open until `sendResponse` is called. Without it, the callback in the content script never fires.

---

**Q: How does the weakness detection work? Why two passes?**

A: The goal is to find topics where the user has a low solve rate. The naive approach — loop through submissions and count per tag — would inflate attempt counts because a user might submit the same problem 10 times. We'd count that as 10 attempts for that tag when it's really just one problem.

The two-pass approach first builds a Map of unique problems using `contestId-problemIndex` as the key. Each problem appears once regardless of how many submissions it has, and we track whether it was ever solved. Then in the second pass, we iterate those unique problems and aggregate per tag. Now `attempted` counts unique problems, not submissions. The solve rate is honest.

We also filter out tags with fewer than 5 attempts to remove noise from tags barely tried, and return only the 8 weakest to keep the chart readable.

---

**Q: Why does the heatmap snap the start date to a Sunday?**

A: The heatmap is a grid of columns representing weeks. Each column contains 7 cells for the 7 days of the week. If we started on an arbitrary day like Wednesday, the first column would only have 5 cells and the grid columns wouldn't represent full weeks. Snapping to Sunday ensures every column is exactly 7 days and the grid is visually consistent — same as GitHub's contribution graph.

---

**Q: How do you prevent your CSS from breaking Codeforces and vice versa?**

A: Three ways. First, all our styles are scoped to `#cf-enhancer-root` — Codeforces can't have an element with that ID. Second, we scope the global reset (`* { margin: 0; padding: 0; }`) to `#cf-enhancer-root *` instead of applying it globally. Third, every CSS class we define is prefixed with `cfe-` to prevent any collision with Codeforces class names.

---

**Q: Why do you use `[...ratingHistory].reverse()` instead of just `.reverse()`?**

A: `Array.reverse()` mutates the original array in place. The same `ratingHistory` data is used in two places — the rating chart needs it in oldest-first order (left to right on the time axis), and the recent contests table needs newest-first order. Creating a copy with the spread operator before reversing means the chart data is unaffected.

---

**Q: What happens if the API fails?**

A: The background script wraps everything in a try/catch. If any fetch throws, it returns `{ error: error.message }`. In the content script, we check for `response.error` first. If there's an error, we restore the original Codeforces content by removing `display: none` from the hidden elements, and show a red error message. The user sees the original Codeforces page instead of a broken empty one. Graceful degradation.

---

*This documentation covers every meaningful decision in the CF Enhancer codebase. If you can speak confidently to all of it, you can defend this project in any interview.*
