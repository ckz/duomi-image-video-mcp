/**
 * DuomiAPI video client (VEO)
 * Handles video generation and task polling.
 * Imports DuomiAPIError from image-client.ts.
 */
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
      // DuomiAPI uses bare token auth (no "Bearer" prefix) — confirmed working
      headers: { Authorization: apiKey },
    });
  }

  async generateVideo(req: GenerateVideoReq): Promise<{ task_id: string }> {
    // duration is fixed at 8 per API spec — not exposed as a parameter
    const body = { ...req, duration: 8 };
    const res = await this.http.post("/v1/videos/generations", body);
    this.assertOk(res.data);
    // video API returns flat { id } — image API returns { data: { task_id } }
    const taskId = res.data.task_id ?? res.data.id ?? res.data.data?.task_id ?? res.data.data?.id;
    if (!taskId) {
      throw new DuomiAPIError(0, "missing task_id", "DuomiAPI error: response missing task_id");
    }
    return { task_id: taskId };
  }

  async getVideoTask(taskId: string): Promise<VideoTaskResult> {
    const res = await this.http.get(`/v1/videos/tasks/${taskId}`);
    const d = res.data;
    if (d.state == null) {
      return { task_id: taskId, state: "error", progress: 0, message: "task not found" };
    }
    return {
      task_id: d.id ?? taskId,
      state: d.state,
      progress: d.progress ?? 0,
      // VEO task response: { id, state, progress, data: { videos: [...] } }
      videos: d.data?.videos,
      message: d.message ?? undefined,
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
