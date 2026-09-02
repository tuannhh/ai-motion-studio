/** Kiểu dữ liệu trả về từ @ams/server (snake_case giữ nguyên từ DB) */

export type ProjectRow = {
  id: number;
  idea: string;
  mode: "angles" | "series";
  variant_count: number;
  preset_hint: string | null;
  duration_sec: number | null;
  status: "draft" | "generating" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  script_count: number;
  source_count: number;
};

export type SourceRow = {
  id: number;
  file_name: string;
  mime: string;
  size_bytes: number;
  status: "uploaded" | "extracting" | "ready" | "failed";
  extract_method: string | null;
  error_message: string | null;
};

export type ScriptRow = {
  id: number;
  variant_index: number;
  title: string;
  angle: string;
  slug: string;
  preset: string;
  narration_md: string;
  scenes: Array<{ id: string; type: string; narration: string; display?: string }>;
  status: "pending" | "approved" | "rejected";
  job_id: number | null;
  job_status: "queued" | "tts" | "rendering" | "done" | "failed" | null;
  job_progress: number | null;
  job_error: string | null;
};

export type ProjectDetail = {
  project: ProjectRow & {
    voice_gender: "male" | "female";
    voice_region: "bac" | "nam";
    voice_style: "thoisu" | "tintuc";
    voice_speed: string;
  };
  sources: SourceRow[];
  scripts: ScriptRow[];
};

export type JobRow = {
  id: number;
  status: string;
  progress: number;
  finished_at: string | null;
  title: string;
  slug: string;
  preset: string;
  project_id: number;
};

export type WatermarkPreset = {
  id: number;
  name: string;
  kind: "text" | "image";
  text: string | null;
  hasImage: boolean;
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

export type WatermarkConfig = {
  /** 'inherit' chỉ có ở watermark riêng của user (dùng mặc định hệ thống) */
  kind: "inherit" | "none" | "text" | "image";
  text: string | null;
  hasImage: boolean;
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

/** StyleProfile do Gemini phân tích từ video mẫu (camelCase DTO từ server) */
export type StyleProfile = {
  preset: "midnight" | "aurora" | "paper" | "noir";
  accent?: string;
  paletteNotes: string;
  pacing: { avgSceneSec: number; wordsPerMinute: number };
  sceneTypeMix: Array<{ type: string; weight: number }>;
  narrationTone: string;
  hookStyle: string;
  visualSignatures: string[];
  motion?: {
    intensity: "subtle" | "medium" | "dynamic";
    signatures: string[];
  };
  imageStyle?: {
    kind: "photographic" | "illustration" | "3d" | "mixed" | "minimal";
    sourcing: "ai-generated" | "real-footage" | "mixed" | "minimal";
    notes: string;
  };
  scriptPipeline?: string[];
  captionStyle?: string;
  doNots: string[];
};

export type TemplateWorkflow = {
  mode: "angles" | "series";
  variantCount: number;
  durationSec: number;
  voiceGender: "male" | "female";
  voiceRegion: "bac" | "nam";
  voiceStyle: "thoisu" | "tintuc";
  voiceSpeed: 1 | 1.2;
  approveGate: boolean;
  scriptPipeline: string[];
};

export type TemplateRow = {
  id: number;
  name: string;
  sourceVideoName: string | null;
  status: "analyzing" | "ready" | "failed";
  errorMessage: string | null;
  profile: StyleProfile | null;
  workflow: TemplateWorkflow;
  createdAt: string;
  updatedAt: string;
};

export type SeriesRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  project_count: number;
  episode_count: number;
};

export type SeriesEpisode = {
  episode: number;
  scriptId: number;
  projectId: number;
  title: string;
  angle: string;
  slug: string;
  scriptStatus: "pending" | "approved" | "rejected";
  jobId: number | null;
  jobStatus: "queued" | "images" | "tts" | "rendering" | "done" | "failed" | null;
  jobProgress: number | null;
  hasVideo: boolean;
  createdAt: string;
};

export type SeriesDetail = {
  series: { id: number; name: string; description: string | null; created_at: string };
  episodes: SeriesEpisode[];
};

export type MusicTrack = {
  id: number;
  name: string;
  credit: string | null;
  mime: string;
  size_bytes: number;
  created_at: string;
};

export type GDriveStatus =
  | { connected: false }
  | { connected: true; email: string | null; connectedAt: string; enabled: boolean };

export type DriveExport = {
  fileId: string;
  webLink: string | null;
  exportedAt?: string;
  name?: string;
};

export type UserRow = {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "creator";
  is_active: number;
  created_at: string;
  project_count: number;
};
