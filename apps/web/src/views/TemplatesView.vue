<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDialog from "../components/mds/MDialog.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MInput from "../components/mds/MInput.vue";
import MSpinner from "../components/mds/MSpinner.vue";
import MSwitch from "../components/mds/MSwitch.vue";
import MTag from "../components/mds/MTag.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import type { TemplateRow, TemplateWorkflow } from "../lib/types";

/**
 * Template-from-video (GĐ3): upload video mẫu → AI phân tích style profile →
 * template dùng lại được khi tạo video, workflow chỉnh được trong drawer.
 */

const toast = useToast();
const templates = ref<TemplateRow[]>([]);
const loading = ref(true);

const TEMPLATE_STATUS: Record<string, { label: string; color: string }> = {
  analyzing: { label: "Đang phân tích", color: "info" },
  ready: { label: "Sẵn sàng", color: "success" },
  failed: { label: "Lỗi", color: "danger" },
};

const PRESET_LABEL: Record<string, string> = {
  midnight: "Midnight — tối xanh công nghệ",
  aurora: "Aurora — tím sáng tạo",
  paper: "Paper — kem editorial",
  noir: "Noir — đen + đỏ báo chí",
};

async function reload(): Promise<void> {
  try {
    templates.value = await api<TemplateRow[]>("/v1/templates");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được danh sách mẫu.");
  } finally {
    loading.value = false;
  }
}

/** Poll 4s khi còn template đang phân tích (như ProjectsView) */
let pollTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void reload();
  pollTimer = setInterval(() => {
    if (templates.value.some((t) => t.status === "analyzing")) void reload();
  }, 4000);
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

// ---- Tạo mẫu mới ----
const createOpen = ref(false);
const newName = ref("");
const newFile = ref<File | null>(null);
const nameError = ref("");
const fileError = ref("");
const creating = ref(false);

function onPickFile(e: Event): void {
  fileError.value = "";
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  if (file && file.size > 18 * 1024 * 1024) {
    fileError.value = "Video nặng quá 18MB — hãy nén hoặc cắt đoạn tiêu biểu 30-60 giây.";
    newFile.value = null;
    return;
  }
  newFile.value = file;
}

async function createTemplate(): Promise<void> {
  nameError.value = "";
  fileError.value = "";
  if (newName.value.trim().length < 2) {
    nameError.value = "Nhập tên mẫu, tối thiểu 2 ký tự.";
    return;
  }
  if (!newFile.value) {
    fileError.value = "Chọn video mẫu (mp4, mov, webm — ≤18MB).";
    return;
  }
  creating.value = true;
  try {
    const form = new FormData();
    form.append("name", newName.value.trim());
    form.append("video", newFile.value, newFile.value.name);
    await apiForm("/v1/templates", form);
    toast.success("Đã tải video mẫu — AI đang phân tích phong cách.");
    createOpen.value = false;
    newName.value = "";
    newFile.value = null;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tạo được mẫu.");
  } finally {
    creating.value = false;
  }
}

// ---- Sửa workflow ----
const editOpen = ref(false);
const editing = ref<TemplateRow | null>(null);
const editName = ref("");
const wf = ref<TemplateWorkflow | null>(null);
const saving = ref(false);

function openEdit(t: TemplateRow): void {
  editing.value = t;
  editName.value = t.name;
  wf.value = { ...t.workflow, scriptPipeline: [...(t.workflow.scriptPipeline ?? [])] };
  // Chưa chỉnh tay lần nào → mồi bằng pipeline AI học từ video mẫu để creator sửa
  if (wf.value.scriptPipeline.length === 0 && t.profile?.scriptPipeline?.length) {
    wf.value.scriptPipeline = [...t.profile.scriptPipeline];
  }
  // Textarea giữ nguyên văn (KHÔNG trim/lọc theo từng phím) — chỉ chuẩn hoá lúc lưu.
  // Trước đây dùng computed set trim mỗi keystroke → gõ dấu cách bị nuốt, chữ dính nhau.
  pipelineText.value = wf.value.scriptPipeline.join("\n");
  editOpen.value = true;
}

/** Pipeline sửa dạng văn bản THÔ: mỗi dòng 1 nhịp kể chuyện. Chỉ split/trim khi lưu. */
const pipelineText = ref("");

async function saveEdit(): Promise<void> {
  if (!editing.value || !wf.value) return;
  wf.value.scriptPipeline = pipelineText.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  saving.value = true;
  try {
    await api(`/v1/templates/${editing.value.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editName.value.trim(), workflow: wf.value }),
    });
    toast.success("Đã lưu thiết lập mẫu.");
    editOpen.value = false;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không lưu được.");
  } finally {
    saving.value = false;
  }
}

async function reanalyze(t: TemplateRow): Promise<void> {
  try {
    await api(`/v1/templates/${t.id}/reanalyze`, { method: "POST" });
    toast.success("Đang phân tích lại video mẫu…");
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không phân tích lại được.");
  }
}

// ---- Xoá ----
const deleteTarget = ref<TemplateRow | null>(null);
const deleting = ref(false);
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api(`/v1/templates/${deleteTarget.value.id}`, { method: "DELETE" });
    toast.success("Đã xoá mẫu.");
    deleteTarget.value = null;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không xoá được.");
  } finally {
    deleting.value = false;
  }
}

const sceneMixText = (t: TemplateRow): string =>
  (t.profile?.sceneTypeMix ?? [])
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((m) => m.type)
    .join(" · ");

const hasTemplates = computed(() => templates.value.length > 0);
</script>

<template>
  <div class="p-6">
    <!-- Toolbar chuẩn màn Danh sách: tiêu đề trái, Primary ngoài cùng phải -->
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="m-0 text-xl font-semibold">Video Template</h1>
        <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
          Đưa video bất kỳ — AI học phong cách (màu, nhịp, bố cục, giọng kể) thành mẫu dùng lại khi tạo video.
        </p>
      </div>
      <MButton variant="primary" @click="createOpen = true">
        Tạo mẫu từ video
      </MButton>
    </header>

    <div v-if="loading" class="grid place-items-center py-16"><MSpinner :size="28" /></div>

    <MEmptyState
      v-else-if="!hasTemplates"
      title="Chưa có mẫu video nào"
      description="Tải lên một video có phong cách bạn thích — AI sẽ phân tích và tạo mẫu tương tự."
    >
      <MButton variant="primary" @click="createOpen = true">Tạo mẫu đầu tiên</MButton>
    </MEmptyState>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="t in templates"
        :key="t.id"
        class="rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="m-0 truncate text-[15px] font-semibold">{{ t.name }}</h2>
            <p class="m-0 mt-0.5 truncate text-xs text-[var(--mds-text-secondary)]">
              {{ t.sourceVideoName ?? "—" }}
            </p>
          </div>
          <MTag :color="TEMPLATE_STATUS[t.status]?.color" size="sm">
            {{ TEMPLATE_STATUS[t.status]?.label ?? t.status }}
          </MTag>
        </div>

        <div v-if="t.status === 'analyzing'" class="mt-3 flex items-center gap-2 text-[13px] text-[var(--mds-text-secondary)]">
          <MSpinner :size="16" /> AI đang xem video và học phong cách…
        </div>

        <p v-else-if="t.status === 'failed'" class="m-0 mt-3 text-[13px] text-[var(--mds-danger)]">
          {{ t.errorMessage ?? "Phân tích thất bại." }}
        </p>

        <template v-else-if="t.profile">
          <div class="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <span
              v-if="t.profile.accent"
              class="inline-block h-4 w-4 shrink-0 rounded-full border border-[var(--mds-neutral-400,#CED1D6)]"
              :style="{ background: t.profile.accent }"
              :title="`Màu nhấn ${t.profile.accent}`"
            />
            <span class="font-medium">{{ PRESET_LABEL[t.profile.preset] ?? t.profile.preset }}</span>
          </div>
          <p class="m-0 mt-2 line-clamp-2 text-[13px] text-[var(--mds-text-secondary)]">
            {{ t.profile.narrationTone }}
          </p>
          <p class="m-0 mt-2 text-xs text-[var(--mds-text-secondary)]">
            Scene ưa dùng: {{ sceneMixText(t) }} · ≈{{ t.profile.pacing.avgSceneSec }}s/scene
          </p>
          <p class="m-0 mt-1 text-xs text-[var(--mds-text-secondary)]">
            Workflow: {{ t.workflow.mode === "series" ? "serie" : "đa chiều" }} ·
            {{ t.workflow.variantCount }} kịch bản · {{ t.workflow.durationSec }}s ·
            {{ t.workflow.approveGate ? "có duyệt" : "tự render" }}
          </p>
        </template>

        <div class="mt-3 flex justify-end gap-2 border-t border-[var(--mds-neutral-300,#E9EAEB)] pt-3">
          <MButton @click="deleteTarget = t">Xoá</MButton>
          <MButton
            v-if="t.status === 'failed'"
            @click="reanalyze(t)"
          >
            Phân tích lại
          </MButton>
          <MButton
            v-if="t.status !== 'analyzing'"
            variant="primary"
            @click="openEdit(t)"
          >
            Thiết lập
          </MButton>
        </div>
      </article>
    </div>

    <!-- Drawer tạo mẫu -->
    <MDrawer v-model="createOpen" title="Tạo mẫu từ video" :width="440">
      <div class="space-y-4">
        <label class="block text-[13px] font-medium">
          Tên mẫu <span class="text-[var(--mds-danger)]">*</span>
          <MInput
            v-model="newName"
            class="mt-1"
            placeholder="Ví dụ: Phong cách AI News"
            :error="nameError"
          />
        </label>
        <div class="text-[13px] font-medium">
          Video mẫu <span class="text-[var(--mds-danger)]">*</span>
          <span class="font-normal text-[var(--mds-text-secondary)]"> — mp4, mov, webm ≤18MB</span>
          <input
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            class="mt-1 block w-full text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--mds-brand-50,#EFF4FF)] file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-[var(--mds-brand-600,#245FDF)]"
            @change="onPickFile"
          />
          <p v-if="fileError" class="m-0 mt-1 text-xs text-[var(--mds-danger)]">{{ fileError }}</p>
          <p v-else-if="newFile" class="m-0 mt-1 text-xs text-[var(--mds-text-secondary)]">
            {{ newFile.name }} — {{ (newFile.size / 1e6).toFixed(1) }}MB
          </p>
        </div>
        <p class="m-0 rounded-md bg-[var(--mds-bg-page)] p-3 text-xs text-[var(--mds-text-secondary)]">
          AI chỉ học <b>phong cách</b> (màu sắc, nhịp dựng, bố cục, giọng kể) — không sao chép nội dung video mẫu.
        </p>
      </div>
      <template #footer>
        <MButton @click="createOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="creating" @click="createTemplate">
          Tải lên & phân tích
        </MButton>
      </template>
    </MDrawer>

    <!-- Drawer thiết lập workflow -->
    <MDrawer v-model="editOpen" title="Thiết lập mẫu" :width="440">
      <div v-if="wf" class="space-y-4">
        <label class="block text-[13px] font-medium">
          Tên mẫu
          <MInput v-model="editName" class="mt-1" />
        </label>

        <div v-if="editing?.profile" class="rounded-md bg-[var(--mds-bg-page)] p-3 text-xs">
          <p class="m-0 font-medium">Phong cách đã học (AI phân tích — không sửa tay)</p>
          <p class="m-0 mt-1 text-[var(--mds-text-secondary)]">
            {{ PRESET_LABEL[editing.profile.preset] }} · {{ editing.profile.paletteNotes }}
          </p>
          <p class="m-0 mt-1 text-[var(--mds-text-secondary)]">
            Mở đầu: {{ editing.profile.hookStyle }}
          </p>
          <ul class="m-0 mt-1 list-inside list-disc text-[var(--mds-text-secondary)]">
            <li v-for="s in editing.profile.visualSignatures" :key="s">{{ s }}</li>
          </ul>
          <p v-if="editing.profile.motion" class="m-0 mt-1 text-[var(--mds-text-secondary)]">
            Chuyển động ({{ editing.profile.motion.intensity }}):
            {{ editing.profile.motion.signatures.join("; ") || "theo mức tổng thể" }}
          </p>
          <p v-if="editing.profile.imageStyle" class="m-0 mt-1 text-[var(--mds-text-secondary)]">
            Hình ảnh: {{ editing.profile.imageStyle.kind }} · nguồn
            {{ editing.profile.imageStyle.sourcing }}
          </p>
        </div>

        <div>
          <label class="block text-[13px] font-medium" for="tpl-pipeline">
            Pipeline / workflow kịch bản
          </label>
          <p class="m-0 mb-1 mt-0.5 text-xs text-[var(--mds-text-secondary)]">
            Mỗi dòng là 1 nhịp kể chuyện theo thứ tự (AI bám đúng CẤU TRÚC này, chỉ mượn
            phong cách — không chép nội dung mẫu). Để trống = dùng gợi ý AI học từ video.
          </p>
          <MTextarea
            id="tpl-pipeline"
            v-model="pipelineText"
            :rows="7"
            placeholder="Mở đầu bằng câu hỏi gây sốc + số liệu&#10;Nêu vấn đề người xem đang gặp&#10;Đưa 3 giải pháp cụ thể&#10;So sánh trước / sau&#10;Chốt bằng lời kêu gọi hành động"
          />
        </div>
        <div class="flex items-center justify-between rounded-md bg-[var(--mds-bg-page)] p-3">
          <div class="text-[13px]">
            <p class="m-0 font-medium">Gate duyệt kịch bản</p>
            <p class="m-0 mt-0.5 text-xs text-[var(--mds-text-secondary)]">
              Tắt = sinh kịch bản xong tự động render, không chờ duyệt.
            </p>
          </div>
          <MSwitch v-model="wf.approveGate" />
        </div>
      </div>
      <template #footer>
        <MButton @click="editOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="saving" @click="saveEdit">Lưu</MButton>
      </template>
    </MDrawer>

    <!-- Xác nhận xoá -->
    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá mẫu video"
      @update:model-value="deleteTarget = null"
    >
      <p class="m-0 text-[13px]">
        Xoá mẫu "<b>{{ deleteTarget?.name }}</b>"? Project đã tạo từ mẫu này vẫn giữ nguyên.
      </p>
      <template #footer>
        <MButton @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </div>
</template>
