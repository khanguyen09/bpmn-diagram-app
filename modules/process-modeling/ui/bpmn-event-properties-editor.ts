export type BpmnTimerKind = "DATE" | "DURATION";

export interface BpmnTimerDraft {
  readonly kind: BpmnTimerKind;
  readonly value: string;
}

export const maxBpmnMessageNameLength = 180;
export const maxBpmnTimerDateLength = 64;
export const maxBpmnTimerDurationLength = 32;
export const maxBpmnTimerDurationSeconds = 365 * 24 * 60 * 60;

const durationPattern =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?)?$/;

export function bpmnMessageNameError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return "Thông điệp cần một tên semantic.";
  if (Array.from(normalized).length > maxBpmnMessageNameLength) {
    return `Tên thông điệp tối đa ${maxBpmnMessageNameLength} ký tự.`;
  }
  return null;
}

export function bpmnTimerDraftError(draft: BpmnTimerDraft): string | null {
  const value = draft.value.trim();
  if (!value) return "Timer cần một giá trị.";

  if (draft.kind === "DATE") {
    if (value.length > maxBpmnTimerDateLength) {
      return `Mốc thời gian tối đa ${maxBpmnTimerDateLength} ký tự.`;
    }
    if (!validTimerDate(value)) {
      return "Dùng RFC 3339 với múi giờ, ví dụ 2026-08-15T09:00:00+07:00.";
    }
    return null;
  }

  if (value.length > maxBpmnTimerDurationLength) {
    return `Khoảng chờ tối đa ${maxBpmnTimerDurationLength} ký tự.`;
  }
  if (!durationPattern.test(value)) {
    return "Dùng ISO 8601 D/H/M/S, ví dụ PT30M hoặc P2DT4H.";
  }
  if (!validTimerDuration(value)) {
    return "Khoảng chờ phải từ 1 giây đến 365 ngày.";
  }
  return null;
}

export function normalizeBpmnTimerDraft(draft: BpmnTimerDraft): BpmnTimerDraft {
  return { kind: draft.kind, value: draft.value.trim() };
}
import {
  validTimerDate,
  validTimerDuration,
} from "../domain/event-routing";
