# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LemonTA (柠檬塔定制系统) is a WeChat Mini Program for custom cabinetry design. Users configure wall dimensions, place cabinet modules on a 3D Canvas preview, and get an itemized cost breakdown (materials, hardware, shipping, installation). AppID: `wx43f651068f87d46e`.

## How to run

This is **not** a web app or CLI — it requires **WeChat Developer Tools** (微信开发者工具).

1. Install from https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. Import the project root directory
3. The tool compiles automatically; use the simulator to interact, or "Preview" to run on a real phone

The cloud environment (`cloud1-5gbuna7d27dafeba`) must be provisioned with three database collections — `users`, `designs`, `config` — all set to "only creator can read/write." Cabinet images must exist in cloud storage under `claw-assets/picture/`.

## Architecture

### Login: openid-only (no phone/email)

`app.js` is the data hub. On launch, `ensureLogin()` calls the `login` cloud function to get the WeChat `openid`, which serves as the user's identity. All cloud database queries are automatically scoped to the current user by WeChat's `_openid` mechanism — no manual `where({_openid})` needed. `ensureLogin` uses a singleton `_loginPromise` to de-duplicate concurrent calls across pages. On failure, `_loginPromise` is reset to null so retries work.

### Page routing

Four tab-bar pages live in the **main package**:
- `pages/home/home` — landing page, tutorial carousel
- `pages/design/design` — saved design list (login-gated: shows a login prompt when not authenticated)
- `pages/knowledge/knowledge` — knowledge base (no login required)
- `pages/profile/profile` — account card, edit-profile modal

The design flow lives in the **subpackage** `packageDesign/` (preloaded when `pages/design/design` is visited):
- `register/register` — login page (just calls `ensureLogin`)
- `preset/preset` — wall parameters: name, width (44–1000cm), height (232–400cm), corner type (none/left/right/both)
- `layout/layout` — the Canvas-based module placement engine
- `cost/cost` — configuration picker + itemized cost results

### Data flow

`app.js` `globalData` is the single source of truth for:
- `openid`, `isLoggedIn`, `avatarFileID`, `nickName` — from `login` CF + `users` collection
- `designs[]` — `refreshDesigns()` pulls from `designs` collection (max 30), ordered by `createTime desc`
- `appConfig` — from `config` collection; supports hot-updating operational text/links without re-submitting the mini program
- `currentDesignPreview` — set by `layout.js` on save, consumed by `cost.js` for instant preview

Pages read from `globalData` on `onShow` via their own sync methods (e.g. `profile.js` `_syncLoginState()`, `design.js` `checkLogin()` + `loadDesigns()`).

### Canvas rendering engine (`layout.js`)

The core of the app (~1620 lines). Manages:
- Canvas 2D initialization with retry (up to 8 attempts, 150ms/300ms backoff)
- Image loading pipeline: `cloud://` fileIDs → `getTempFileURL` batch conversion → `canvas.createImage()` → `_imageCache`
- Module placement: standard (50/100cm, types A/B/C/D) and non-standard (e-type, 45–115cm) with gap-fill modules and corner cabinets
- Color overlay via `globalCompositeOperation = 'multiply'` for cream finish
- Draw scheduling via `_scheduleDraw` using `requestAnimationFrame` to merge rapid clicks into a single repaint
- Modal lifecycle: `wx:if` destroys Canvas DOM, so `_reinitCanvasAfterModal` waits 300ms then re-initializes
- Missing image reload: `_scheduleMissingImageReload` batches unloaded images and redraws after loading (max 2 attempts per image)

### Cost engine (`cost.js`)

Mirrors an Excel model. Each module calculates 21 board-part line items and 40+ hardware line items. Five configurable parameters: board brand, door material, door craft, hardware brand, lighting. Corner cabinets are decomposed into two sub-modules (a-100-230 + a-50-230). Results are cached by config hash to avoid recomputation when toggling between config/result views.

### Image assets

`utils/assets.js` (JS) and `utils/assets.wxs` (WXML) mirror each other. Both use `cloud://cloud1-5gbuna7d27dafeba.636c-.../claw-assets/` as the base CDN path. The WXS module is for `<image>` `src` attributes in templates; the JS module is for Canvas `loadImage()` calls and programmatic path generation.

### Sharing

`utils/share.js` centralizes share card title/path/cover for all 16+ pages. Each page delegates `onShareAppMessage` and `onShareTimeline` to it with a page-type key. Some titles are dynamic functions (e.g. knowledge detail includes the article title).

## Key constraints

- **Max 30 designs** per user — enforced in `app.js` `saveDesign()` and `design.js` `startNewDesign()`
- **Wall width**: 44–1000cm; **wall height**: 232–400cm
- **Corner cabinet width constraint**: <114cm forces no corner; <224cm blocks dual-corner
- **Cloud database permissions** must be "only creator can read/write" — the code never passes `_openid` explicitly
- **Knowledge base content** is hardcoded in JS files (budget ratios, inspection checklists, needs questionnaire) — no CMS backend yet. The `detail` page shows placeholder text.
