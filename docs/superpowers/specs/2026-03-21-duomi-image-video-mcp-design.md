# Design: duomi-image-video-mcp

**Date:** 2026-03-21
**Status:** Approved

## Overview

A TypeScript MCP server that wraps the DuomiAPI (duomiapi.com) image and video generation endpoints. Designed to be published to npmjs. The API key is never stored in code — passed via environment variable or CLI flag at runtime.

## Project Location

`~/ai_workspaces/duomi-image-video-mcp/`

## File Structure

```
duomi-image-video-mcp/
├── src/
│   ├── image-client.ts     # nano-banana image API (generate, edit, poll)
│   ├── video-client.ts     # VEO video API (generate, poll)
│   └── index.ts            # MCP server, tool definitions, tool handlers
├── package.json
├── tsconfig.json
└── README.md
```

## API Key Config

Never hardcoded. Resolved at startup in priority order:

1. `--api-key <value>` CLI flag
2. `DUOMI_API_KEY` environment variable
3. Exit with clear error message if neither provided

## Tools

### Image Tools (nano-banana)

| Tool | Input | Returns |
|---|---|---|
| `generate_image` | `model`, `prompt`, `aspect_ratio?`, `image_size?` | `{ task_id }` |
| `edit_image` | `model`, `prompt`, `image_urls`, `aspect_ratio?`, `image_size?` | `{ task_id }` |
| `get_image_task` | `task_id` | `{ state, images?: [{url}], message }` |

**Endpoints:**
- Submit generate: `POST https://duomiapi.com/api/gemini/nano-banana`
- Submit edit: `POST https://duomiapi.com/api/gemini/nano-banana-edit`
- Poll: `GET https://duomiapi.com/api/gemini/nano-banana/{id}`
- States: `pending | running | succeeded | error`

**Models:**
- `gemini-3.1-flash-image-preview` (nano-banana-2)
- `gemini-2.5-flash-image` (nano-banana)
- `gemini-3-pro-image-preview` (nano-banana-pro)

### Video Tools (VEO)

| Tool | Input | Returns |
|---|---|---|
| `generate_video` | `model`, `prompt`, `aspect_ratio?`, `generation_type?`, `quality?`, `image_urls?` | `{ task_id }` |
| `get_video_task` | `task_id` | `{ state, progress, videos?: [{url}], message }` |

**Endpoints:**
- Submit: `POST https://duomiapi.com/v1/videos/generations`
- Poll: `GET https://duomiapi.com/v1/videos/tasks/{task_id}`
- States: `pending | running | succeeded | error`

**Models:** `veo3.1-fast`, `veo3.1-pro`

**Generation types:** `TEXT`, `FIRST&LAST`, `REFERENCE`

**Note:** `duration` is fixed at `8` (hardcoded, not exposed as a parameter).

## Polling Strategy

Async — submit tools return `task_id` immediately. Claude calls `get_image_task` or `get_video_task` to check status. No internal polling loop in the server.

## Error Handling

- Missing API key at startup → `process.exit(1)` with clear message
- API non-2xx response → throw `DuomiAPIError` with `code` + `message`, surfaced as `isError: true` in MCP response
- `get_*_task` with unknown task_id → return `{ state: "error", message: "task not found" }` (no throw)

## npm Publishing

- Package name: `duomi-image-video-mcp`
- Binary: `duomi-image-video-mcp` → `dist/index.js`
- No API keys or secrets in source
- `engines.node`: `>=18.0.0`
- Dependencies: `@modelcontextprotocol/sdk`, `axios`, `zod`
- devDependencies: `typescript`, `@types/node`

## Claude Code Registration Example

```json
{
  "mcpServers": {
    "duomi-image-video": {
      "command": "npx",
      "args": ["-y", "duomi-image-video-mcp"],
      "env": {
        "DUOMI_API_KEY": "your_key_here"
      }
    }
  }
}
```
