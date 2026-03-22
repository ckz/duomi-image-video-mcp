/**
 * DuomiAPI image client (nano-banana)
 * Handles text-to-image, image-to-image, and task polling.
 * DuomiAPIError is exported and shared with video-client.ts.
 */
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
      // DuomiAPI uses bare token auth (no "Bearer" prefix) — confirmed working
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
