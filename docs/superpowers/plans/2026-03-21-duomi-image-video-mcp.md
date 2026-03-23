# duomi-image-video-mcp Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server exposing 5 tools for DuomiAPI image generation, image editing, and video generation — safe to publish on npmjs (no API keys in source).

**Architecture:** Three-file `src/` layout — `image-client.ts` owns nano-banana HTTP calls, `video-client.ts` owns VEO HTTP calls, `index.ts` wires both into the MCP server. API key resolved from `--api-key` flag or `DUOMI_API_KEY` env var at startup. All tools are async: submit returns `task_id`, a separate `get_*_task` tool polls status.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk`, `axios`, `zod` (input schemas), Node.js ≥18

---

## Chunk 1: Project Scaffold

### Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create project directory and init git**

```bash
cd ~/ai_workspaces/duomi-image-video-mcp
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "duomi-image-video-mcp",
  "version": "0.1.0",
  "description": "MCP server for DuomiAPI — image generation, image editing, and video generation",
  "main": "dist/index.js",
  "bin": {
    "duomi-image-video-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "prepare": "npm run build"
  },
  "keywords": ["mcp", "duomi", "image", "video", "ai", "gemini", "veo", "nano-banana"],
  "author": "ckz",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.7.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
*.env
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: initialize duomi-image-video-mcp project scaffold"
```

---

## Chunk 2: Image Client

### Task 2: Implement DuomiImageClient

**Files:**
- Create: `src/image-client.ts`

- [ ] **Step 1: Create `src/image-client.ts`**

```typescript
import axios, { AxiosInstance } from "axios";

const BASE_URL = "https://duomiapi.com";

// ─── Shared error ─────────────────────────────────────────────────────────────

export class DuomiAPIError extends Error {
  constructor(
    public readonly code: number,
    public readonly reason: string,
    message: string
  ) {
    super(message);
    this.name = "DuomiAPIError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImageModel =
  | "gemini-3.1-flash-image-preview"
  | "gemini-2.5-flash-image"
  | "gemini-3-pro-image-preview";

export type AspectRatio =
  | "auto" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3"
  | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

export type ImageSize = "1K" | "2K" | "4K";
export type ImageTaskState = "pending" | "running" | "succeeded" | "error";

export interface GenerateImageReq {
  model: ImageModel;
  prompt: string;
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
}

export interface EditImageReq {
  model: ImageModel;
  prompt: string;
  image_urls: string[];
  aspect_ratio?: AspectRatio;
  image_size?: ImageSize;
}

export interface ImageTaskResult {
  task_id: string;
  state: ImageTaskState;
  images?: Array<{ url: string; file_name: string }>;
  message?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class DuomiImageClient {
  private http: AxiosInstance;

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: apiKey },
    });
  }

  async generateImage(req: GenerateImageReq): Promise<{ task_id: string }> {
    const res = await this.http.post("/api/gemini/nano-banana", req);
    this.assertOk(res.data);
    return { task_id: res.data.data.task_id };
  }

  async editImage(req: EditImageReq): Promise<{ task_id: string }> {
    const res = await this.http.post("/api/gemini/nano-banana-edit", req);
    this.assertOk(res.data);
    return { task_id: res.data.data.task_id };
  }

  async getImageTask(taskId: string): Promise<ImageTaskResult> {
    const res = await this.http.get(`/api/gemini/nano-banana/${taskId}`);
    if (res.data.code === 400) {
      return { task_id: taskId, state: "error", message: res.data.msg };
    }
    const d = res.data.data;
    return {
      task_id: d.task_id,
      state: d.state,
      images: d.data?.images,
      message: d.msg || undefined,
    };
  }

  private assertOk(body: { code: number; msg: string }) {
    if (body.code !== 200) {
      throw new DuomiAPIError(
        body.code,
        body.msg,
        `DuomiAPI error ${body.code}: ${body.msg}`
      );
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit image client**

```bash
git add src/image-client.ts
git commit -m "feat: add DuomiImageClient for nano-banana image API"
```

---

## Chunk 3: Video Client

### Task 3: Implement DuomiVideoClient

**Files:**
- Create: `src/video-client.ts`

- [ ] **Step 1: Create `src/video-client.ts`**

```typescript
import axios, { AxiosInstance } from "axios";
import { DuomiAPIError } from "./image-client.js";

const BASE_URL = "https://duomiapi.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoModel = "veo3.1-fast" | "veo3.1-pro";
export type VideoAspectRatio = "16:9" | "9:16";
export type VideoQuality = "720p" | "1080p" | "4k";
export type VideoGenerationType = "TEXT" | "FIRST&LAST" | "REFERENCE";
export type VideoTaskState = "pending" | "running" | "succeeded" | "error";

export interface GenerateVideoReq {
  model: VideoModel;
  prompt: string;
  aspect_ratio?: VideoAspectRatio;
  generation_type?: VideoGenerationType;
  quality?: VideoQuality;
  image_urls?: string[];
}

export interface VideoTaskResult {
  task_id: string;
  state: VideoTaskState;
  progress: number;
  videos?: Array<{ url: string }>;
  message?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class DuomiVideoClient {
  private http: AxiosInstance;

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: apiKey },
    });
  }

  async generateVideo(req: GenerateVideoReq): Promise<{ task_id: string }> {
    // duration is fixed at 8 per API spec — not exposed as a parameter
    const body = { ...req, duration: 8 };
    const res = await this.http.post("/v1/videos/generations", body);
    this.assertOk(res.data);
    // response may use task_id or id depending on API version
    const taskId = res.data.data?.task_id ?? res.data.data?.id ?? res.data.task_id;
    return { task_id: taskId };
  }

  async getVideoTask(taskId: string): Promise<VideoTaskResult> {
    const res = await this.http.get(`/v1/videos/tasks/${taskId}`);
    const d = res.data;
    if (!d.state) {
      return { task_id: taskId, state: "error", progress: 0, message: "task not found" };
    }
    return {
      task_id: d.id ?? taskId,
      state: d.state,
      progress: d.progress ?? 0,
      videos: d.data?.videos,
      message: d.message || undefined,
    };
  }

  private assertOk(body: { code?: number; msg?: string; message?: string }) {
    if (body.code !== undefined && body.code !== 200) {
      throw new DuomiAPIError(
        body.code,
        body.msg ?? body.message ?? "",
        `DuomiAPI error ${body.code}: ${body.msg ?? body.message}`
      );
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit video client**

```bash
git add src/video-client.ts
git commit -m "feat: add DuomiVideoClient for VEO video API"
```

---

## Chunk 4: MCP Server

### Task 4: Implement `index.ts`

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
#!/usr/bin/env node
/**
 * duomi-image-video-mcp — MCP server for DuomiAPI image & video generation
 *
 * Usage:
 *   DUOMI_API_KEY=your_key node dist/index.js
 *   node dist/index.js --api-key your_key
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { DuomiImageClient, DuomiAPIError } from "./image-client.js";
import { DuomiVideoClient } from "./video-client.js";

// ─── Config ───────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const flagIdx = process.argv.indexOf("--api-key");
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    return process.argv[flagIdx + 1];
  }
  const envKey = process.env.DUOMI_API_KEY;
  if (envKey) return envKey;
  console.error(
    "Error: API key required. Set DUOMI_API_KEY env var or pass --api-key <key>"
  );
  process.exit(1);
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "generate_image",
    description:
      "Generate an image from a text prompt using nano-banana. Returns task_id immediately — call get_image_task to poll for the result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: {
          type: "string",
          enum: [
            "gemini-3.1-flash-image-preview",
            "gemini-2.5-flash-image",
            "gemini-3-pro-image-preview",
          ],
          description:
            "nano-banana-2 (gemini-3.1-flash-image-preview) — fast, supports 2K/4K. nano-banana (gemini-2.5-flash-image). nano-banana-pro (gemini-3-pro-image-preview) — highest quality.",
        },
        prompt: { type: "string", description: "Image generation prompt" },
        aspect_ratio: {
          type: "string",
          enum: ["auto","1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"],
          description: "Output aspect ratio (default: auto)",
        },
        image_size: {
          type: "string",
          enum: ["1K", "2K", "4K"],
          description: "Output resolution — supported by nano-banana-2 and nano-banana-pro",
        },
      },
      required: ["model", "prompt"],
    },
  },
  {
    name: "edit_image",
    description:
      "Edit or transform images using a prompt (image-to-image). Returns task_id immediately — call get_image_task to poll for the result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: {
          type: "string",
          enum: [
            "gemini-3.1-flash-image-preview",
            "gemini-2.5-flash-image",
            "gemini-3-pro-image-preview",
          ],
        },
        prompt: { type: "string", description: "Editing instruction" },
        image_urls: {
          type: "array",
          items: { type: "string" },
          description: "Reference image URLs (max 10, must be URLs — base64 not supported)",
        },
        aspect_ratio: {
          type: "string",
          enum: ["auto","1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"],
        },
        image_size: {
          type: "string",
          enum: ["1K", "2K", "4K"],
        },
      },
      required: ["model", "prompt", "image_urls"],
    },
  },
  {
    name: "get_image_task",
    description:
      "Poll the status of an image generation or editing task. Call every 5s until state is 'succeeded' or 'error'. On success, images[] contains the result URLs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "Task ID returned by generate_image or edit_image",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "generate_video",
    description:
      "Generate a video from text or reference images using VEO. Returns task_id immediately — call get_video_task to poll for the result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model: {
          type: "string",
          enum: ["veo3.1-fast", "veo3.1-pro"],
          description: "veo3.1-fast — faster/cheaper. veo3.1-pro — higher quality.",
        },
        prompt: { type: "string", description: "Video generation prompt" },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16"],
          description: "Output aspect ratio",
        },
        generation_type: {
          type: "string",
          enum: ["TEXT", "FIRST&LAST", "REFERENCE"],
          description:
            "TEXT: text-to-video. FIRST&LAST: 1–2 images as first/last frame. REFERENCE: up to 3 images as visual references (16:9 only). Default: TEXT",
        },
        quality: {
          type: "string",
          enum: ["720p", "1080p", "4k"],
          description: "Output quality (default: 720p)",
        },
        image_urls: {
          type: "array",
          items: { type: "string" },
          description:
            "Reference image URLs — required for FIRST&LAST (1–2 images) and REFERENCE (max 3 images) modes",
        },
      },
      required: ["model", "prompt"],
    },
  },
  {
    name: "get_video_task",
    description:
      "Poll the status of a video generation task. Call every 10s until state is 'succeeded' or 'error'. Returns progress percentage and video URLs on success.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "Task ID returned by generate_video",
        },
      },
      required: ["task_id"],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

async function handleTool(
  name: string,
  input: ToolInput,
  imageClient: DuomiImageClient,
  videoClient: DuomiVideoClient
): Promise<unknown> {
  switch (name) {
    case "generate_image":
      return imageClient.generateImage({
        model: input.model as any,
        prompt: input.prompt as string,
        aspect_ratio: input.aspect_ratio as any,
        image_size: input.image_size as any,
      });

    case "edit_image":
      return imageClient.editImage({
        model: input.model as any,
        prompt: input.prompt as string,
        image_urls: input.image_urls as string[],
        aspect_ratio: input.aspect_ratio as any,
        image_size: input.image_size as any,
      });

    case "get_image_task":
      return imageClient.getImageTask(input.task_id as string);

    case "generate_video":
      return videoClient.generateVideo({
        model: input.model as any,
        prompt: input.prompt as string,
        aspect_ratio: input.aspect_ratio as any,
        generation_type: input.generation_type as any,
        quality: input.quality as any,
        image_urls: input.image_urls as string[] | undefined,
      });

    case "get_video_task":
      return videoClient.getVideoTask(input.task_id as string);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = getApiKey();
  const imageClient = new DuomiImageClient(apiKey);
  const videoClient = new DuomiVideoClient(apiKey);

  const server = new Server(
    { name: "duomi-image-video-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input = (args ?? {}) as ToolInput;

    try {
      const result = await handleTool(name, input, imageClient, videoClient);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      if (err instanceof DuomiAPIError) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(
              { error: true, code: err.code, reason: err.reason, message: err.message },
              null, 2
            ),
          }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("duomi-image-video-mcp server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `dist/` created with `index.js`, `image-client.js`, `video-client.js`. No TypeScript errors.

- [ ] **Step 3: Verify server starts**

```bash
DUOMI_API_KEY=test node dist/index.js &
sleep 1 && kill %1
```

Expected: `duomi-image-video-mcp server started` on stderr. No crash.

- [ ] **Step 4: Verify missing key exits with clear message**

```bash
node dist/index.js 2>&1 | head -1
```

Expected output:
```
Error: API key required. Set DUOMI_API_KEY env var or pass --api-key <key>
```

- [ ] **Step 5: Make binary executable**

```bash
chmod +x dist/index.js
```

- [ ] **Step 6: Commit MCP server**

```bash
git add src/index.ts
git commit -m "feat: add MCP server with 5 tools (generate_image, edit_image, get_image_task, generate_video, get_video_task)"
```

---

## Chunk 5: README and npm prep

### Task 5: Write README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Final build check**

```bash
npm run build && node dist/index.js --api-key test 2>&1 | head -1
```

Expected: `duomi-image-video-mcp server started`

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup, models, and usage workflow"
```

---

## Post-Build: Register locally in Claude Code

Before publishing to npm, register the local build. Add to `~/.claude.json` under `mcpServers`:

```json
"duomi-image-video": {
  "command": "node",
  "args": ["/Users/kenlu/ai_workspaces/duomi-image-video-mcp/dist/index.js"],
  "env": {
    "DUOMI_API_KEY": "<from DUOMI_API_KEY in ~/.../credentials/.env_ckz>"
  }
}
```

## Post-Build: Publish to npm

```bash
npm login
npm publish --access public
```
