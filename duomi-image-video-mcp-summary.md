---
title: duomi-image-video-mcp Build Summary
source: claude-code
tags: [mcp, duomi, image-generation, video-generation, typescript, npm]
created: 2026-03-21
---

# duomi-image-video-mcp

MCP server wrapping [DuomiAPI](https://duomiapi.com) — AI image generation, image editing, and video generation. Safe to publish on npmjs (API key never in source).

## What It Does

Exposes 5 MCP tools that Claude can call directly:

| Tool | API | Description |
|---|---|---|
| `generate_image` | nano-banana | Text → image, returns `task_id` |
| `edit_image` | nano-banana-edit | Image + prompt → edited image, returns `task_id` |
| `get_image_task` | nano-banana/{id} | Poll image task → state + image URLs |
| `generate_video` | VEO | Text/image → video, returns `task_id` |
| `get_video_task` | /v1/videos/tasks/{id} | Poll video task → state + progress + video URLs |

All submit tools return `task_id` immediately. Claude polls `get_*_task` manually.

---

## Project Location

```
~/ai_workspaces/duomi-image-video-mcp/
├── src/
│   ├── image-client.ts     # nano-banana image API client
│   ├── video-client.ts     # VEO video API client
│   └── index.ts            # MCP server + tool definitions
├── package.json
├── tsconfig.json
└── README.md
```

---

## API Reference

### Image — nano-banana

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/gemini/nano-banana` | POST | Text → image |
| `/api/gemini/nano-banana-edit` | POST | Image → image |
| `/api/gemini/nano-banana/{id}` | GET | Poll task |

**Models:**
- `gemini-3.1-flash-image-preview` — nano-banana-2 (fast, supports 2K/4K)
- `gemini-2.5-flash-image` — nano-banana
- `gemini-3-pro-image-preview` — nano-banana-pro (highest quality)

**Aspect ratios:** `auto`, `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` — **default: `9:16`**

**Resolutions:** `1K`, `2K`, `4K` (nano-banana-2 and pro only) — **default: `1K`**

### Video — VEO

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/videos/generations` | POST | Submit video job |
| `/v1/videos/tasks/{task_id}` | GET | Poll task |

**Models:** `veo3.1-fast`, `veo3.1-pro`

**Generation types:**
- `TEXT` — text-to-video
- `FIRST&LAST` — 1–2 images as first/last frame
- `REFERENCE` — up to 3 images as visual references (16:9 only)

**Quality:** `720p` (default), `1080p`, `4k`

**Duration:** Fixed at `8s` (hardcoded per API spec)

**Task states:** `pending` → `running` → `succeeded` | `error`

---

## API Key

Stored in:
- `~/ai_workspaces/credentials/.env_ckz` → `DUOMI_API_KEY`
- `~/ai_workspaces/feedmob_projs/pdf_conversion/.env_ckz` → `DUOMI_API_KEY`

Never committed to source. Passed at runtime:

```bash
DUOMI_API_KEY=your_key node dist/index.js
# or
node dist/index.js --api-key your_key
```

---

## Setup Instructions

### Register in Claude Code (.mcp.json)

Published on npm as `duomi-image-video-mcp@0.1.1`. Use `npx`:

```json
"duomi-image-video": {
  "command": "npx",
  "args": ["-y", "duomi-image-video-mcp"],
  "env": {
    "DUOMI_API_KEY": "<your key>"
  }
}
```

Configured in:
- `~/ai_workspaces/credentials/.mcp.json`
- per-project `.mcp.json` (e.g. `~/ai_workspaces/feedmob_projs/pdf_conversion/.mcp.json`)

### Local Dev (run from source)

```bash
cd ~/ai_workspaces/duomi-image-video-mcp
npm install && npm run build
# then use "node" instead of "npx" in .mcp.json:
# "args": ["/Users/kenlu/ai_workspaces/duomi-image-video-mcp/dist/index.js"]
```

### Publish to npm

```bash
cd ~/ai_workspaces/duomi-image-video-mcp
npm version patch   # bump version
npm publish --access public
git push https://ckz:<GITHUB_TOKEN>@github.com/ckz/duomi-image-video-mcp.git main
```

---

## Typical Workflow

```
# Image generation
generate_image(model, prompt, aspect_ratio, image_size)
  → { task_id }
  → get_image_task(task_id) every 5s
  → { state: "succeeded", images: [{ url, file_name }] }

# Image editing
edit_image(model, prompt, image_urls, aspect_ratio, image_size)
  → { task_id }
  → get_image_task(task_id) every 5s
  → { state: "succeeded", images: [{ url, file_name }] }

# Video generation
generate_video(model, prompt, generation_type, aspect_ratio, quality, image_urls?)
  → { task_id }
  → get_video_task(task_id) every 10s
  → { state: "succeeded", progress: 100, videos: [{ url }] }
```

---

## Tech Stack

- TypeScript 5, Node.js ≥18
- `@modelcontextprotocol/sdk` — MCP server
- `axios` — HTTP client
- `zod` — input schema validation

## Implementation Plan

Full step-by-step plan at:
`~/ai_workspaces/duomi-image-video-mcp/docs/superpowers/plans/2026-03-21-duomi-image-video-mcp.md`
