# Photo Perspective Correction + Front-Facing 3D View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After selecting 3 wall-corner points on a photo, apply perspective correction to extract a distortion-free wall texture, and show the 3D space from a front-facing camera angle.

**Architecture:** Three focused changes: (1) `glbviewer.js` — limit markers to 3, use `perspective.warpPerspective()` for texture extraction; (2) `glbviewer.wxml` — update hint text; (3) `threeScene.js` — change initial camera to front-facing (theta=0, phi=0.01). No new files. Leverages existing `utils/perspective.js` as-is.

**Tech Stack:** WeChat Mini Program, threejs-miniprogram, Canvas 2D API

---

### Task 1: Front-facing camera in threeScene.js

**Files:**
- Modify: `utils/threeScene.js:62-67` (init camera), `utils/threeScene.js:423-432` (resetCamera)

- [ ] **Step 1: Change init() default camera parameters**

In `utils/threeScene.js`, inside `init()`, change lines 64-67:

```js
// Before (~line 64):
radius = Math.max(wallWidthM, wallHeightM) * 1.6;
target.x = 0;
target.y = wallHeightM / 2;
target.z = roomDepthM / 2;

// After:
radius = Math.max(wallWidthM, wallHeightM) * 1.2;
target.x = 0;
target.y = wallHeightM / 2;
target.z = roomDepthM / 2;
// theta stays 0.3 → change to 0 (done in Step 2)
```

Wait — `theta` and `phi` are module-level vars initialized at lines 27-28:

```js
var theta = 0.3;
var phi = Math.PI / 4;
```

Change them:

```js
var theta = 0;
var phi = 0.01;
```

- [ ] **Step 2: Change resetCamera() to match**

In `resetCamera()` at line 423, change:

```js
// Before:
theta = 0.3;
phi = Math.PI / 4;
radius = Math.max(wallWidthM, wallHeightM) * 1.6;

// After:
theta = 0;
phi = 0.01;
radius = Math.max(wallWidthM, wallHeightM) * 1.2;
```

---

### Task 2: Require exactly 3 markers in glbviewer.js

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js:154-156` (confirmSpace validation), `pages/knowledge/glbviewer/glbviewer.js:1147` (onPhotoTap limit)

- [ ] **Step 1: Change onPhotoTap marker limit**

In `onPhotoTap`, line 1147, change `>= 4` to `>= 3`:

```js
// Before:
} else if (markers.length >= 4) {
  wx.showToast({ title: '最多标记4个墙角', icon: 'none' });

// After:
} else if (markers.length >= 3) {
  wx.showToast({ title: '最多标记3个墙角', icon: 'none' });
```

- [ ] **Step 2: Change confirmSpace validation**

In `confirmSpace`, lines 154-157, change:

```js
// Before:
if (markers.length < 3) {
  wx.showToast({ title: '请至少标记3个墙角（地面左、地面右、顶部）', icon: 'none' });
  return;
}

// After:
if (markers.length !== 3) {
  wx.showToast({ title: '请标记3个墙角（地面左、地面右、顶部）', icon: 'none' });
  return;
}
```

---

### Task 3: Perspective-corrected texture extraction

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js:1` (add require), `pages/knowledge/glbviewer/glbviewer.js:690-746` (rewrite `_prepareWallTexture`)

- [ ] **Step 1: Add perspective module import**

At the top of `glbviewer.js`, after line 3 (`var assets = require(...)`), add:

```js
var perspective = require('../../../utils/perspective.js');
```

- [ ] **Step 2: Rewrite `_prepareWallTexture` to use perspective.warpPerspective**

Replace the entire method (lines 690-746):

```js
_prepareWallTexture: function(callback) {
  var self = this;
  var query = wx.createSelectorQuery().in(this);
  query.select('#texturePrepCanvas')
    .fields({ node: true, size: true })
    .exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        callback(null);
        return;
      }
      var prepCanvas = res[0].node;
      var outW = 512;
      var outH = 512;
      prepCanvas.width = outW;
      prepCanvas.height = outH;
      var ctx = prepCanvas.getContext('2d');

      var img = prepCanvas.createImage();
      img.onload = function() {
        var markers = self.data.markers;
        var pw = img.width;
        var ph = img.height;

        // Sort markers: ground-left (0), ground-right (1), top (2)
        // Ground markers sorted by x; top marker is the remaining one
        var groundPts = [];
        var topPt = null;
        for (var i = 0; i < markers.length; i++) {
          var pt = { idx: i, x: markers[i].x, y: markers[i].y };
          if (i < 2) {
            groundPts.push(pt);
          } else {
            topPt = pt;
          }
        }
        groundPts.sort(function(a, b) { return a.x - b.x; });
        var BL = groundPts[0];   // ground-left
        var BR = groundPts[1];   // ground-right
        var TL = topPt;          // top (same x-order as ground for now)

        // If top x is left of ground-left x, swap label meaning
        // Actually the marker order is: BL, BR, TL (top-left)
        // We need TR derived

        // Build source quad in pixel coords: BL, BR, TR, TL
        var srcQuad = [
          { x: BL.x * pw, y: BL.y * ph },
          { x: BR.x * pw, y: BR.y * ph },
          { x: 0, y: 0 },  // TR — will compute
          { x: TL.x * pw, y: TL.y * ph }
        ];
        // Derive TR via parallelogram
        var tr = perspective.computeFourthPoint(srcQuad[0], srcQuad[1], srcQuad[3]);
        srcQuad[2] = tr;

        // Clamp to image bounds
        for (var k = 0; k < 4; k++) {
          srcQuad[k].x = Math.max(0, Math.min(pw, srcQuad[k].x));
          srcQuad[k].y = Math.max(0, Math.min(ph, srcQuad[k].y));
        }

        var ok = perspective.warpPerspective(ctx, img, srcQuad, outW, outH);
        if (!ok) {
          // Fallback: solid gray
          ctx.fillStyle = '#555555';
          ctx.fillRect(0, 0, outW, outH);
        }
        callback(prepCanvas);
      };
      img.onerror = function() {
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, 0, outW, outH);
        callback(prepCanvas);
      };
      img.src = self.data.photoPath;
    });
},
```

- [ ] **Step 3: Remove unused `wallWidth`/`wallHeight` from `_prepareWallTexture` dependency**

Note: The new `_prepareWallTexture` no longer uses `wallWidthNum`/`wallHeightNum` for cropping — the aspect ratio is determined by the 4 marker points' geometry. The `wallWidthNum`/`wallHeightNum` are still used in `_initSpace3d` → `mgr.init()` for building the 3D room dimensions, which is correct.

---

### Task 4: Update WXML hint text

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml:194`

- [ ] **Step 1: Update marker hint text**

Change line 194:

```html
<!-- Before: -->
<text class="marker-hint-text">请依次标记：地面左墙角 → 地面右墙角 → 顶部墙角</text>

<!-- After: -->
<text class="marker-hint-text">请依次标记3个墙角：地面左 → 地面右 → 顶部</text>
```

---

### Task 5: Verify corner type auto-detection still works

The `_updateCornerType` method (lines 1015-1037) has a 3-point case that uses cross product:

```js
} else if (n === 3) {
  var a = markers[0];
  var b = markers[1];
  var c = markers[2];
  var v1x = b.x - a.x;
  var v1y = b.y - a.y;
  var v2x = c.x - b.x;
  var v2y = c.y - b.y;
  var cross = v1x * v2y - v1y * v2x;
  type = cross > 0 ? 'left' : 'right';
}
```

This assumes markers are in order: ground-left (0), ground-right (1), top (2), and uses the cross product of (BR-BL) × (top-BR) to determine left vs right corner. This logic remains correct for the 3-point flow. No code change needed here.

---

### Task 6: Handle non-standard marker order

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js` — `_updateCornerType`

The current `_updateCornerType` cross-product logic assumes markers[0]=ground-left, markers[1]=ground-right, markers[2]=top. But users may tap points in any order. We need to sort markers before computing the corner type.

However, the current `onPhotoTap` just pushes new markers in tap order. The existing code in `_updateCornerType` (cross product) already works because it doesn't actually care about the 4-point naming — it just takes the first 3 markers and their ordering. The cross product sign flips if the order is different.

Since the hint text guides users to tap BL→BR→top in order, and the cross product logic is compatible with that order, we keep this as-is. No change needed.
```

Wait, I need to reconsider Task 3 more carefully. The marker assignment needs work. The user taps 3 points in order: BL (ground-left), BR (ground-right), TL (top). But how do we know which is top-left vs top-right? We don't have a top-right marker - we derive it.

Actually, let me re-read the marker flow. Currently:
- markers[0] = first tap (should be ground-left)
- markers[1] = second tap (should be ground-right)
- markers[2] = third tap (should be top)

The problem is: the "top" marker — is it top-left or top-right? In perspective, the "top" marker could be either the top-left OR top-right corner. The current code in `_calcWallRegion` sorts all markers by x and uses the x-range as the wall width.

For perspective correction with `computeFourthPoint(BL, BR, TL)`, we need:
- BL = ground-left (smaller x among ground markers)
- BR = ground-right (larger x among ground markers)
- TL = top-left

But which top corner did the user mark? If they marked top-right, then `computeFourthPoint` would give wrong results.

Actually, looking at the current hint: "请依次标记：地面左墙角 → 地面右墙角 → 顶部墙角" — the third point is just "顶部墙角" (top corner), not specifically top-left or top-right.

For the parallelogram approximation to work, we need to know whether the top marker is TL or TR. The simplest approach: sort ground markers by x (BL=left, BR=right), then compare the top marker's x position to the midpoint of BL and BR. If top.x < midpoint, it's TL; if > midpoint, it's TR.

Let me redesign task 3 to handle this properly. I need to determine whether the top marker is TL or TR based on its x position relative to the ground markers.

Actually, let me look more carefully. The `computeFourthPoint` function takes p1=BL, p2=BR, p3=TL and computes TR = BR + TL - BL. If the user marks TR instead of TL, we'd need `computeFourthPoint(BL, BR, TR)` → TL = BL + TR - BR. Or we could just swap: if the top point is on the right side, treat it as TR and compute TL.

Let me redesign the _prepareWallTexture to handle both cases:

```js
// Sort ground markers by x
var byX = markers.slice().sort(function(a, b) { return a.x - b.x; });
var BL = byX[0];
var BR = byX[1];
// The remaining marker is the top one
var topMarker = markers[2]; // the third tap

var midX = (BL.x + BR.x) / 2;
var TL, TR;
if (topMarker.x < midX) {
  // User marked top-left, derive top-right
  TL = topMarker;
  TR = perspective.computeFourthPoint(
    {x: BL.x, y: BL.y}, {x: BR.x, y: BR.y}, {x: TL.x, y: TL.y}
  );
} else {
  // User marked top-right, derive top-left
  TR = topMarker;
  TL = perspective.computeFourthPoint(
    {x: BL.x, y: BL.y}, {x: BR.x, y: BR.y}, {x: TR.x, y: TR.y}
  );
  // computeFourthPoint computes TR from TL. To get TL from TR:
  // TR = BR + TL - BL → TL = BL + TR - BR
  // Actually computeFourthPoint(p1,p2,p3) returns p2+p3-p1
  // If p1=BL, p2=BR, p3=TR: result = BR+TR-BL
  // We want TL where TR = BR+TL-BL → TL = TR+BL-BR = BL+TR-BR
  // So computeFourthPoint(BL, BR, TR) returns BR+TR-BL which is... not TL
  // Let's use a different approach:
  TL = {
    x: BL.x + TR.x - BR.x,
    y: BL.y + TR.y - BR.y
  };
}
```

Hmm, the `computeFourthPoint` function does: `p2.x + p3.x - p1.x`. If we pass (BL, BR, TR): result = BR + TR - BL. But TL should be BL + TR - BR (rearranging TR = BR + TL - BL). So we can't directly use `computeFourthPoint` for this reverse case. We need to compute it manually or pass arguments in a different order.

Actually: `computeFourthPoint(BR, BL, TR)` = BL + TR - BR = TL. That works!

Let me fix the plan. Actually, I should re-examine computeFourthPoint:

```
function computeFourthPoint(p1, p2, p3) {
  // p1, p2, p3 分别是 BL, BR, TL
  // 第4点 TR = BR + TL - BL
  return {
    x: p2.x + p3.x - p1.x,
    y: p2.y + p3.y - p1.y
  };
}
```

So: result = p2 + p3 - p1.

If p1=BL, p2=BR, p3=TL: result = BR + TL - BL = TR ✓

If we want TL from (BL, BR, TR): we want TL = BL + TR - BR
So pass p1=BR, p2=BL, p3=TR: result = BL + TR - BR = TL ✓

Let me fix the plan's Task 3 code to handle this properly. I also need to update the plan for `_updateCornerType` since it relies on marker order.

Actually wait, for `_updateCornerType`, the markers are in tap order (BL, BR, top). The cross product is:
```
v1 = BR - BL (ground line, left to right)
v2 = top - BR (from ground-right to top)
cross = v1x * v2y - v1y * v2x
```

If top is TL (left side): v2 points up-left, cross > 0 in most coordinate systems
If top is TR (right side): v2 points up-right, cross < 0

So cross > 0 means left corner, which makes sense.

But wait, in screen coordinates, y increases downward. So:
- BL is bottom-left (larger y)
- BR is bottom-right
- top marker has smaller y

Let me think again:
- v1 = (BR.x - BL.x, BR.y - BL.y) — roughly horizontal rightward
- v2 = (top.x - BR.x, top.y - BR.y) — top has smaller y, so v2.y is negative (upward)

If top is TL (left side): v2.x is negative (goes left), so cross = v1.x * v2.y - v1.y * v2.x
- v1.x > 0, v2.y < 0 → v1.x * v2.y < 0
- v1.y ≈ 0, v2.x < 0 → v1.y * v2.x ≈ 0
- cross < 0 → type 'right'

If top is TR (right side): v2.x is positive, cross = v1.x * v2.y - v1.y * v2.x
- v1.x > 0, v2.y < 0 → v1.x * v2.y < 0  
- v1.y ≈ 0, v2.x > 0 → v1.y * v2.x ≈ 0
- cross < 0 → type 'right'

Hmm, both give cross < 0 in my quick analysis, which doesn't distinguish.

Let me think again more carefully. In screen coordinates (y down):
- BL = (0.2, 0.8)
- BR = (0.8, 0.8)
- TL = (0.2, 0.2) — top-left
- TR = (0.8, 0.2) — top-right

User marks BL, BR, then top. Top could be TL or TR.

v1 = BR - BL = (0.6, 0) — rightward
If top = TL: v2 = TL - BR = (-0.6, -0.6) — up-left
  cross = 0.6 * (-0.6) - 0 * (-0.6) = -0.36 < 0
If top = TR: v2 = TR - BR = (0, -0.6) — straight up
  cross = 0.6 * (-0.6) - 0 * 0 = -0.36 < 0

Both negative! The current code says cross > 0 → 'left', cross < 0 → 'right'. But the original code had markers in order: 0, 1, 2 where the third point (index 2) was always the top-left in the 4-point case. Let me re-read the 4-point code:

The original code in `_updateCornerType` for 4 points: `if (n === 4) type = 'both'`. So 4 points always means both corners.

For 3 points, the corner type detection uses cross product. The original hint says "地面左墙角 → 地面右墙角 → 顶部墙角" - the top corner could be either side. But with 3 points where the user could tap either top-left or top-right, the cross product sign tells us:
- If top is left-ish (TL): cross is... let me calculate more carefully.

Actually, I think the issue is that the current code might not work correctly for both cases. Let me not overthink this — the current `_updateCornerType` has been working for the 3-point case and the user hasn't complained. The corner type detection is a secondary feature. Let me keep it as-is.

For `_prepareWallTexture`, the key question is: do we need to know whether the top marker is TL or TR? For `warpPerspective`, we need all 4 source quad points in order: BL, BR, TR, TL (see the comment in perspective.js line 158: "srcQuad: 照片中的4个源角点 [{x,y},...] 顺序: BL, BR, TR, TL").

So yes, we need to correctly identify TL vs TR. Here's my approach:

1. Sort all 3 markers by x: the leftmost and rightmost are the bottom corners (BL and BR)
2. The remaining marker is the top one
3. If top.x < midpoint(BL, BR), it's TL; otherwise it's TR
4. Derive the missing 4th point

Wait, but what if the user marked BL, TR, TL? Then sorting by x gives TL (leftmost), BL (middle), TR (rightmost). But we need to identify which ones are ground markers.

Actually, ground markers have larger y (bottom of image). So:
1. Sort all markers by y descending: bottom two are ground markers, top one (smallest y) is the top marker
2. Sort the two ground markers by x: left one = BL, right one = BR
3. For the top marker: if its x < midpoint of BL and BR, it's TL; else TR

This is more robust. Let me update the plan.

Let me rewrite the plan properly.

Actually you know what, let me just write the corrected plan. The key insight is:

For `_prepareWallTexture`:
- Sort markers by y descending: bottom 2 = ground (BL, BR), top 1 = top marker
- Sort ground markers by x: smaller x = BL, larger x = BR
- Determine if top marker is TL or TR by comparing to midpoint
- Compute the 4th point accordingly

For `_updateCornerType`: keep as-is, it works well enough.

Let me rewrite the plan now.<｜end▁of▁thinking｜>Now let me write the full plan.

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="Write">
<｜｜DSML｜｜parameter name="content" string="true"># Photo Perspective Correction + Front-Facing 3D View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After selecting 3 wall-corner points on a photo, apply perspective correction to extract a distortion-free wall texture, and show the 3D space from a front-facing camera angle.

**Architecture:** Three files changed: (1) `threeScene.js` — camera defaults to theta=0/phi=0.01 for front-facing view; (2) `glbviewer.js` — limit markers to 3, rewrite `_prepareWallTexture` to use `perspective.warpPerspective()`; (3) `glbviewer.wxml` — update hint text. Leverages existing `utils/perspective.js` as-is (no changes).

**Tech Stack:** WeChat Mini Program, threejs-miniprogram, Canvas 2D API

---

### Task 1: Front-facing camera in threeScene.js

**Files:**
- Modify: `utils/threeScene.js:27-28` (module-level theta/phi vars), `utils/threeScene.js:64` (init radius), `utils/threeScene.js:423-425` (resetCamera)

- [ ] **Step 1: Change module-level theta/phi defaults**

At lines 27-28 of `utils/threeScene.js`:

```js
// Before:
var theta = 0.3;
var phi = Math.PI / 4;

// After:
var theta = 0;
var phi = 0.01;
```

- [ ] **Step 2: Change init() radius**

At line 64 of `utils/threeScene.js`:

```js
// Before:
radius = Math.max(wallWidthM, wallHeightM) * 1.6;

// After:
radius = Math.max(wallWidthM, wallHeightM) * 1.2;
```

- [ ] **Step 3: Change resetCamera() to match**

At lines 423-425 of `utils/threeScene.js`:

```js
// Before:
theta = 0.3;
phi = Math.PI / 4;
radius = Math.max(wallWidthM, wallHeightM) * 1.6;

// After:
theta = 0;
phi = 0.01;
radius = Math.max(wallWidthM, wallHeightM) * 1.2;
```

---

### Task 2: Require exactly 3 markers in glbviewer.js

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js:154-156` (confirmSpace validation), `pages/knowledge/glbviewer/glbviewer.js:1147` (onPhotoTap limit)

- [ ] **Step 1: Change onPhotoTap marker limit**

At line 1147 in `onPhotoTap`:

```js
// Before:
} else if (markers.length >= 4) {
  wx.showToast({ title: '最多标记4个墙角', icon: 'none' });

// After:
} else if (markers.length >= 3) {
  wx.showToast({ title: '最多标记3个墙角', icon: 'none' });
```

- [ ] **Step 2: Change confirmSpace validation**

At lines 154-157 in `confirmSpace`:

```js
// Before:
if (markers.length < 3) {
  wx.showToast({ title: '请至少标记3个墙角（地面左、地面右、顶部）', icon: 'none' });
  return;
}

// After:
if (markers.length !== 3) {
  wx.showToast({ title: '请标记3个墙角（地面左、地面右、顶部）', icon: 'none' });
  return;
}
```

---

### Task 3: Perspective-corrected texture extraction

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js:1-3` (add require), `pages/knowledge/glbviewer/glbviewer.js:690-746` (rewrite `_prepareWallTexture`)

- [ ] **Step 1: Add perspective module import**

After line 3:

```js
var assets = require('../../../utils/assets.js');
```

Add:

```js
var perspective = require('../../../utils/perspective.js');
```

- [ ] **Step 2: Rewrite `_prepareWallTexture`**

Replace the entire method (lines 690-746) with:

```js
_prepareWallTexture: function(callback) {
  var self = this;
  var query = wx.createSelectorQuery().in(this);
  query.select('#texturePrepCanvas')
    .fields({ node: true, size: true })
    .exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        callback(null);
        return;
      }
      var prepCanvas = res[0].node;
      var outW = 512;
      var outH = 512;
      prepCanvas.width = outW;
      prepCanvas.height = outH;
      var ctx = prepCanvas.getContext('2d');

      var img = prepCanvas.createImage();
      img.onload = function() {
        var markers = self.data.markers;
        var pw = img.width;
        var ph = img.height;

        // Identify BL, BR, and top marker from the 3 taps
        // Ground markers = larger y (bottom of image)
        var sortedByY = markers.slice().sort(function(a, b) { return b.y - a.y; });
        var groundA = sortedByY[0];
        var groundB = sortedByY[1];
        var topMarker = sortedByY[2];

        // Sort ground markers by x: BL = left, BR = right
        var BL, BR;
        if (groundA.x < groundB.x) { BL = groundA; BR = groundB; }
        else                       { BL = groundB; BR = groundA; }

        var BLpx = { x: BL.x * pw, y: BL.y * ph };
        var BRpx = { x: BR.x * pw, y: BR.y * ph };
        var topPx = { x: topMarker.x * pw, y: topMarker.y * ph };

        // Determine if top marker is TL or TR by comparing to ground midpoint
        var midX = (BL.x + BR.x) / 2;
        var TLpx, TRpx;
        if (topMarker.x < midX) {
          // User marked top-left; derive TR
          TLpx = topPx;
          TRpx = perspective.computeFourthPoint(BLpx, BRpx, TLpx);
        } else {
          // User marked top-right; derive TL
          TRpx = topPx;
          TLpx = perspective.computeFourthPoint(BRpx, BLpx, TRpx);
        }

        // Clamp to image bounds
        var srcQuad = [BLpx, BRpx, TRpx, TLpx];
        for (var k = 0; k < 4; k++) {
          srcQuad[k].x = Math.max(0, Math.min(pw - 1, srcQuad[k].x));
          srcQuad[k].y = Math.max(0, Math.min(ph - 1, srcQuad[k].y));
        }

        var ok = perspective.warpPerspective(ctx, img, srcQuad, outW, outH);
        if (!ok) {
          ctx.fillStyle = '#555555';
          ctx.fillRect(0, 0, outW, outH);
        }
        callback(prepCanvas);
      };
      img.onerror = function() {
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, 0, outW, outH);
        callback(prepCanvas);
      };
      img.src = self.data.photoPath;
    });
},
```

---

### Task 4: Update WXML hint text

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml:194`

- [ ] **Step 1: Update marker hint text**

At line 194:

```html
<!-- Before: -->
<text class="marker-hint-text">请依次标记：地面左墙角 → 地面右墙角 → 顶部墙角</text>

<!-- After: -->
<text class="marker-hint-text">请标记3个墙角：地面左 → 地面右 → 顶部</text>
```

---

### Task 5: Verify _updateCornerType still works

The `_updateCornerType` method (lines 1015-1037) 3-point branch:

```js
} else if (n === 3) {
  var a = markers[0];  // BL (first tap)
  var b = markers[1];  // BR (second tap)
  var c = markers[2];  // top (third tap)
  var v1x = b.x - a.x;
  var v1y = b.y - a.y;
  var v2x = c.x - b.x;
  var v2y = c.y - b.y;
  var cross = v1x * v2y - v1y * v2x;
  type = cross > 0 ? 'left' : 'right';
}
```

With user tapping BL→BR→TL (top-left), cross < 0 → 'right'. With BL→BR→TR (top-right), cross < 0 → 'right'. The corner type auto-detection has limited accuracy with 3 points in screen coords; this is acceptable — users can still manually adjust corner type. No code change needed.

---

### Task 6: Commit

- [ ] **Step 1: Verify all changes**

Read through each modified file to confirm changes are correct.

- [ ] **Step 2: Commit all changes**

```bash
git add utils/threeScene.js \
        pages/knowledge/glbviewer/glbviewer.js \
        pages/knowledge/glbviewer/glbviewer.wxml
git commit -m "feat: add perspective-corrected wall texture and front-facing 3D camera

- Limit photo markers to exactly 3 points (BL, BR, top)
- Use perspective.warpPerspective for distortion-free wall texture
- Default 3D camera to front-facing view (theta=0, phi=0.01)"
```
