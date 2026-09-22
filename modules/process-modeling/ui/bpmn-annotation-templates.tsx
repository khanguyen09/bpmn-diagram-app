"use client";

import { useId } from "react";
import { Button } from "@/shared/ui/button";
import { isSupportedBpmnPlainText } from "../domain/full-authoring";
import { bpmnElementColorPalette, type BpmnElementColorId } from "./bpmn-element-colors";

export interface BpmnAnnotationTemplate {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly colorId: BpmnElementColorId | null;
}

export const bpmnAnnotationTemplates: readonly BpmnAnnotationTemplate[] = [
  { id: "good", label: "Điểm tốt", text: "ĐIỂM TỐT\nMô tả biện pháp kiểm soát hoặc kết quả tích cực tại bước này.", colorId: "green" },
  { id: "attention", label: "Cần lưu ý", text: "CẦN LƯU Ý\nMô tả điều kiện, rủi ro và cách xử lý cần chú ý.", colorId: "amber" },
  { id: "limit", label: "Giới hạn", text: "GIỚI HẠN\nMô tả phạm vi đang hỗ trợ và phần chưa được thực hiện.", colorId: "red" },
  { id: "question", label: "Câu hỏi", text: "CÂU HỎI\nGhi câu hỏi cần làm rõ và người phụ trách xác nhận.", colorId: "blue" },
  { id: "legend", label: "Quy ước màu", text: "QUY ƯỚC MÀU\nXanh lá: điểm tốt hoặc kết quả tích cực.\nVàng: cần lưu ý. Đỏ: giới hạn hoặc rủi ro.\nXanh dương: câu hỏi cần xác nhận.\nMàu chỉ hỗ trợ đọc; ký hiệu BPMN quyết định ý nghĩa quy trình.", colorId: null },
];

export function appendBpmnAnnotationTemplate(currentText: string, template: BpmnAnnotationTemplate): string | null {
  const next = currentText + (currentText ? "\n\n" : "") + template.text;
  const length = [...new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(next)].length;
  return length <= 2_000 && isSupportedBpmnPlainText(next) ? next : null;
}

export function BpmnAnnotationTemplates({ value, onAppend, disabled = false }: {
  readonly value: string;
  readonly onAppend: (text: string, template: BpmnAnnotationTemplate) => void;
  readonly disabled?: boolean;
}) {
  const helpId = useId();
  return <div className="bpmn-artifact-editor__field">
    <strong>Mẫu chú thích</strong>
    <p id={helpId}>Thêm mẫu vào cuối nội dung, sửa lại rồi áp dụng. Màu gợi ý có thể chọn trong bảng màu.</p>
    <div className="bpmn-validation-inspector__filters" role="group" aria-label="Thêm mẫu chú thích" aria-describedby={helpId}>
      {bpmnAnnotationTemplates.map((template) => {
        const next = appendBpmnAnnotationTemplate(value, template);
        return <Button key={template.id} variant="secondary" disabled={disabled || next === null}
          title={next === null ? "Nội dung vượt 2.000 ký tự hoặc có ký tự không được hỗ trợ." : template.colorId ? `Màu gợi ý: ${bpmnElementColorPalette.find((color) => color.id === template.colorId)?.label}` : "Thêm chú giải dùng chung cho sơ đồ"}
          onClick={() => { if (next !== null) onAppend(next, template); }}>
          {template.label}
        </Button>;
      })}
    </div>
    {bpmnAnnotationTemplates.some((template) => appendBpmnAnnotationTemplate(value, template) === null)
      ? <small role="status">Một số mẫu không thể thêm. Rút gọn nội dung hoặc xóa ký tự không được hỗ trợ.</small> : null}
  </div>;
}
