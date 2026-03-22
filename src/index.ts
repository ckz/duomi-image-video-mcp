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
          description: "nano-banana-2 (gemini-3.1-flash-image-preview) — fast, supports 2K/4K. nano-banana (gemini-2.5-flash-image). nano-banana-pro (gemini-3-pro-image-preview) — highest quality.",
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
          description: "Output aspect ratio (default: auto)",
        },
        image_size: {
          type: "string",
          enum: ["1K", "2K", "4K"],
          description: "Output resolution — supported by nano-banana-2 and nano-banana-pro",
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

    case "generate_video": {
      const genType = input.generation_type as string | undefined;
      if (
        (genType === "FIRST&LAST" || genType === "REFERENCE") &&
        (!input.image_urls || (input.image_urls as string[]).length === 0)
      ) {
        throw new Error(
          `generate_video: image_urls is required when generation_type is "${genType}"`
        );
      }
      return videoClient.generateVideo({
        model: input.model as any,
        prompt: input.prompt as string,
        aspect_ratio: input.aspect_ratio as any,
        generation_type: input.generation_type as any,
        quality: input.quality as any,
        image_urls: input.image_urls as string[] | undefined,
      });
    }

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
