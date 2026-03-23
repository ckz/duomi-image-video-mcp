/**
 * DuomiAPI image client (nano-banana)
 * Handles text-to-image, image-to-image, and task polling.
 * DuomiAPIError is exported and shared with video-client.ts.
 */
import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

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
  local_path?: string; // Added: local file path after download
}

export interface DownloadImageOptions {
  output_dir?: string;
  base_name?: string;
  aspect_ratio?: string;
  format?: "jpeg" | "jpg" | "png";
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class DuomiImageClient {
  private http: AxiosInstance;
  private readonly POLL_INTERVAL_MS = 5000; // Start with 5 seconds
  private readonly POLL_INTERVAL_INCREMENT = 5000; // Add 5s each attempt
  private readonly MAX_POLL_ATTEMPTS = 12; // Max 1 minute (5+10+15+20+25+30 = 105s, so 12 attempts covers ~90s)

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      // DuomiAPI uses bare token auth (no "Bearer" prefix) — confirmed working
      headers: { Authorization: apiKey },
    });
  }

  /**
   * Download an image from a URL to a local file.
   */
  async downloadImage(
    imageUrl: string,
    options: DownloadImageOptions = {}
  ): Promise<string> {
    const {
      output_dir = process.cwd(),
      base_name = "generated",
      aspect_ratio,
      format = "jpeg",
    } = options;

    // Create output directory if needed
    if (!fs.existsSync(output_dir)) {
      fs.mkdirSync(output_dir, { recursive: true });
    }

    // Build filename: base_name + aspect_ratio suffix + extension
    let filename = base_name;
    if (aspect_ratio && aspect_ratio !== "auto") {
      filename += `_${aspect_ratio.replace(":", "_")}`;
    }
    filename += `.${format}`;
    const outputPath = path.join(output_dir, filename);

    return new Promise<string>((resolve, reject) => {
      const protocol = imageUrl.startsWith("https") ? https : http;

      protocol.get(imageUrl, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.downloadImage(res.headers.location, options).then(resolve).catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: Failed to download image`));
          return;
        }

        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          resolve(outputPath);
        });
        fileStream.on("error", (err) => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      }).on("error", reject);
    });
  }

  /**
   * Wait for an image task to complete, with automatic polling.
   * Uses progressive intervals: 5s, 10s, 15s, 20s, 25s, 30s, ...
   * Returns the task result when succeeded or error.
   */
  async waitForTask(taskId: string): Promise<ImageTaskResult> {
    let attempts = 0;
    while (attempts < this.MAX_POLL_ATTEMPTS) {
      const result = await this.getImageTask(taskId);
      if (result.state === "succeeded" || result.state === "error") {
        return result;
      }
      // Progressive interval: 5s, 10s, 15s, 20s, 25s, 30s, ...
      const interval = this.POLL_INTERVAL_MS + (attempts * this.POLL_INTERVAL_INCREMENT);
      await new Promise((resolve) => setTimeout(resolve, interval));
      attempts++;
    }
    return { task_id: taskId, state: "error", message: "Max polling attempts reached (1 minute timeout)" };
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
    if (res.data.code !== 200) {
      return { task_id: taskId, state: "error", message: res.data.msg };
    }
    const d = res.data.data as {
      task_id: string;
      state: ImageTaskState;
      msg?: string;
      data?: { images: Array<{ url: string; file_name: string }> };
    };
    return {
      task_id: d.task_id,
      state: d.state,
      images: d.data?.images,
      message: d.msg ?? undefined,
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
