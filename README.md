# duomi-image-video-mcp

MCP server for [DuomiAPI](https://duomiapi.com) — AI image generation, image editing, and video generation.

## Tools

| Tool | Description |
|---|---|
| `generate_image` | Text → image (nano-banana) — returns `task_id` |
| `edit_image` | Image + prompt → edited image (nano-banana) — returns `task_id` |
| `get_image_task` | Poll image task status — returns state + image URLs |
| `generate_video` | Text/image → video (VEO) — returns `task_id` |
| `get_video_task` | Poll video task status — returns state + progress + video URLs |

## Setup

Get an API key from [duomiapi.com](https://duomiapi.com).

### Claude Code

Add to `~/.claude.json`:

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

### CLI

```bash
DUOMI_API_KEY=your_key npx duomi-image-video-mcp
# or
npx duomi-image-video-mcp --api-key your_key
```

## Models

**Image (nano-banana):**

| Model ID | Alias | Notes |
|---|---|---|
| `gemini-3.1-flash-image-preview` | nano-banana-2 | Fast, supports 2K/4K |
| `gemini-2.5-flash-image` | nano-banana | Standard |
| `gemini-3-pro-image-preview` | nano-banana-pro | Highest quality |

**Video (VEO):**

| Model ID | Notes |
|---|---|
| `veo3.1-fast` | Faster, lower cost |
| `veo3.1-pro` | Higher quality |

## Video Generation Types

| Type | Description |
|---|---|
| `TEXT` | Text-to-video (default) |
| `FIRST&LAST` | Use 1–2 images as first/last frame |
| `REFERENCE` | Use up to 3 images as visual references (16:9 only) |

## Workflow

```
generate_image(prompt) → { task_id }
  → get_image_task(task_id) every 5s → { state: "succeeded", images: [{ url }] }
  → edit_image(prompt, image_urls) → { task_id }
  → get_image_task(task_id) every 5s → { state: "succeeded", images: [{ url }] }

generate_video(prompt) → { task_id }
  → get_video_task(task_id) every 10s → { state: "succeeded", progress: 100, videos: [{ url }] }
```

## License

MIT
