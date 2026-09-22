import { describe, expect, it } from "vitest";
import type { CoreBpmnElement } from "../domain/core-profile";
import {
  bpmnOutlineColorLabel,
  bpmnOutlineAdvancedMetadata,
  bpmnOutlinePrimaryLabel,
  bpmnOutlineTypeLabel,
  isBpmnResponsibilityNode,
} from "./bpmn-outline-presentation";

const base = {
  incoming: [],
  outgoing: [],
} as const;

describe("BPMN outline presentation", () => {
  it("names exact Task and Intermediate Throw semantics", () => {
    expect(
      bpmnOutlineTypeLabel({ ...base, id: "u", type: "bpmn:UserTask" }),
    ).toBe("Công việc của người");
    expect(
      bpmnOutlineTypeLabel({
        ...base,
        id: "t",
        type: "bpmn:IntermediateThrowEvent",
      }),
    ).toBe("Đánh dấu mốc");
  });

  it("announces Boundary definition, interrupting behavior and host", () => {
    const host: CoreBpmnElement = {
      ...base,
      id: "Task_1",
      type: "bpmn:ServiceTask",
      name: "Gửi email",
    };
    const boundary: CoreBpmnElement = {
      ...base,
      id: "Boundary_1",
      type: "bpmn:BoundaryEvent",
      attachedToId: host.id,
      cancelActivity: false,
      eventDefinition: {
        id: "Timer_1",
        kind: "TIMER",
        timerKind: "DURATION",
        expression: "PT15M",
      },
    };
    expect(bpmnOutlineTypeLabel(boundary, new Map([[host.id, host]]))).toBe(
      "Hẹn giờ tại biên · không ngắt công việc · Gửi email",
    );
  });

  it("uses Actor vocabulary for Pool/group/child role hierarchy", () => {
    const pool: CoreBpmnElement = {
      ...base,
      id: "Pool_1",
      type: "bpmn:Participant",
      processId: "Process_1",
    };
    const group: CoreBpmnElement = {
      ...base,
      id: "Lane_1",
      type: "bpmn:Lane",
      parentId: pool.id,
    };
    const role: CoreBpmnElement = {
      ...base,
      id: "Lane_2",
      type: "bpmn:Lane",
      parentId: group.id,
    };
    const byId = new Map([
      [pool.id, pool],
      [group.id, group],
    ]);
    expect(bpmnOutlineTypeLabel(pool, byId)).toBe("Bên tham gia có quy trình");
    expect(
      bpmnOutlineTypeLabel({
        ...base,
        id: "Pool_external",
        type: "bpmn:Participant",
      }),
    ).toBe("Bên tham gia chỉ trao đổi");
    expect(bpmnOutlineTypeLabel(group, byId)).toBe("Nhóm chức năng");
    expect(bpmnOutlineTypeLabel(role, byId)).toBe("Vai trò con");
  });

  it("counts new Task/Throw responsibility but not attached Boundary", () => {
    expect(
      isBpmnResponsibilityNode({
        ...base,
        id: "Service_1",
        type: "bpmn:ServiceTask",
      }),
    ).toBe(true);
    expect(
      isBpmnResponsibilityNode({
        ...base,
        id: "Throw_1",
        type: "bpmn:IntermediateThrowEvent",
      }),
    ).toBe(true);
    expect(
      isBpmnResponsibilityNode({
        ...base,
        id: "Boundary_1",
        type: "bpmn:BoundaryEvent",
      }),
    ).toBe(false);
  });

  it("exposes artifact vocabulary, authored text and DI colors without canvas", () => {
    const annotation: CoreBpmnElement = {
      ...base,
      id: "Annotation_1",
      type: "bpmn:TextAnnotation",
      text: "Chỉ xuất bản khi pháp lý duyệt",
    };
    const group: CoreBpmnElement = {
      ...base,
      id: "Group_1",
      type: "bpmn:Group",
      displayLabel: "Kiểm tra trước xuất bản",
    };
    expect(bpmnOutlineTypeLabel(annotation)).toBe("Ghi chú");
    expect(bpmnOutlinePrimaryLabel(annotation)).toBe(
      "Chỉ xuất bản khi pháp lý duyệt",
    );
    expect(bpmnOutlineTypeLabel(group)).toBe("Nhóm trực quan");
    expect(bpmnOutlinePrimaryLabel(group)).toBe(
      "Kiểm tra trước xuất bản",
    );
    expect(bpmnOutlineColorLabel("#F0EBFF", "#6F54E8")).toBe(
      "Màu riêng · nền #F0EBFF · viền #6F54E8",
    );
    expect(bpmnOutlineColorLabel(undefined, undefined)).toBeNull();
  });

  it("keeps advanced semantics readable in viewer-only outline", () => {
    const call: CoreBpmnElement = {
      ...base,
      id: "Call_1",
      type: "bpmn:CallActivity",
      calledElementId: "Process_reusable",
    };
    const complex: CoreBpmnElement = {
      ...base,
      id: "Complex_1",
      type: "bpmn:ComplexGateway",
      gatewayDirection: "Converging",
      activationCondition: "count(incoming) >= 2",
    };
    expect(bpmnOutlineTypeLabel(call)).toBe("Dùng lại quy trình");
    expect(bpmnOutlineAdvancedMetadata(call)).toBe(
      "Đã liên kết với quy trình dùng chung",
    );
    expect(bpmnOutlineAdvancedMetadata(complex)).toContain(
      "count(incoming) >= 2",
    );
  });
});
