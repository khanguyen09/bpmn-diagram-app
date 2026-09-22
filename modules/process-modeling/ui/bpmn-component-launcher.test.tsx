import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
} from "../domain/collaboration-profile";
import {
  coreBpmnProfile,
  coreComplexRoutingBpmnProfile,
  coreDataAuthoringBpmnProfile,
} from "../domain/core-profile";
import {
  BpmnComponentLauncher,
  allBpmnLauncherToolIds,
  bpmnLauncherToolDefinitions,
  flattenBpmnLauncherItems,
  nextBpmnLauncherGridIndex,
  projectBpmnLauncherGroups,
  type BpmnLauncherContextState,
} from "./bpmn-component-launcher";
import type { BpmnLibraryItem } from "./bpmn-node-library-catalogue";

function itemIds(profileId: Parameters<typeof projectBpmnLauncherGroups>[0]["acknowledgedProfileId"]) {
  return flattenBpmnLauncherItems(
    projectBpmnLauncherGroups({ acknowledgedProfileId: profileId }),
  ).map((item) => item.id);
}

describe("BPMN component launcher projection", () => {
  it("defines one stable global preference union for all 32 supported tools", () => {
    expect(allBpmnLauncherToolIds).toHaveLength(32);
    expect(new Set(allBpmnLauncherToolIds).size).toBe(32);
    expect(allBpmnLauncherToolIds).toEqual(
      expect.arrayContaining([
        "sequence-flow",
        "message-flow",
        "horizontal-swimlane-frame",
        "vertical-swimlane-frame",
      ]),
    );
  });

  it("keeps the Core registry at 27 tools while projecting two swimlane bridges", () => {
    const definitions = bpmnLauncherToolDefinitions(coreBpmnProfile.id);
    const ids = definitions.map((item) => item.id);

    expect(definitions).toHaveLength(27);
    expect(new Set(ids).size).toBe(27);
    expect(ids).not.toEqual(
      expect.arrayContaining(["message-flow", "white-box-pool", "black-box-pool"]),
    );
    expect(itemIds(coreComplexRoutingBpmnProfile.id)).toHaveLength(29);
  });

  it("keeps the latest Collaboration inventory at 32 unique family tools", () => {
    const definitions = bpmnLauncherToolDefinitions(collaborationBpmnProfile.id);
    const ids = definitions.map((item) => item.id);

    expect(definitions).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
    expect(ids).toEqual(
      expect.arrayContaining([
        "message-flow",
        "white-box-pool",
        "black-box-pool",
        "horizontal-swimlane-frame",
        "vertical-swimlane-frame",
      ]),
    );
    expect(itemIds(collaborationSwimlaneLayoutsBpmnProfile.id)).toHaveLength(32);
  });

  it("keeps every projected tool usable with explicit preparation", () => {
    const items = flattenBpmnLauncherItems(
      projectBpmnLauncherGroups({ acknowledgedProfileId: coreBpmnProfile.id }),
    );
    const task = items.find((item) => item.id === "task");
    const dataObject = items.find((item) => item.id === "data-object");
    const horizontalSwimlane = items.find(
      (item) => item.id === "horizontal-swimlane-frame",
    );
    const verticalSwimlane = items.find(
      (item) => item.id === "vertical-swimlane-frame",
    );

    expect(items).toHaveLength(29);
    expect(items.every((item) => item.actionability === "usable")).toBe(true);
    expect(task).toMatchObject({
      actionability: "usable",
      preparation: { kind: "none" },
    });
    expect(dataObject).toMatchObject({
      actionability: "usable",
      minimumProfileId: coreDataAuthoringBpmnProfile.id,
      preparation: {
        kind: "ordered-profile-ack",
        minimumProfileId: coreDataAuthoringBpmnProfile.id,
        minimumProfileLabel: coreDataAuthoringBpmnProfile.label,
      },
    });
    expect(dataObject?.preparation).toMatchObject({
      minimumProfileLabel: coreDataAuthoringBpmnProfile.label,
    });
    expect(dataObject?.stateLabel).toBe(
      "Có thể dùng ngay; hệ thống sẽ tự chuẩn bị khi bạn chọn.",
    );
    expect(horizontalSwimlane).toMatchObject({
      supportsDrag: false,
      tool: {
        label: "Phân vai ngang · 2 vai trò",
      },
      preparation: {
        kind: "in-place-swimlane-conversion",
        minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
        orientation: "horizontal",
      },
      stateLabel: "Có thể dùng trong sơ đồ này sau một bước chuẩn bị.",
    });
    expect(verticalSwimlane).toMatchObject({
      supportsDrag: false,
      tool: {
        label: "Phân vai dọc · 2 vai trò",
      },
      preparation: {
        kind: "in-place-swimlane-conversion",
        minimumProfileId: collaborationSwimlaneLayoutsBpmnProfile.id,
        orientation: "vertical",
      },
    });

    const latestCoreItems = flattenBpmnLauncherItems(
      projectBpmnLauncherGroups({
        acknowledgedProfileId: coreComplexRoutingBpmnProfile.id,
      }),
    );
    expect(
      latestCoreItems
        .filter(
          (item) =>
            item.id !== "horizontal-swimlane-frame" &&
            item.id !== "vertical-swimlane-frame",
        )
        .every(
          (item) =>
            item.actionability === "usable" && item.preparation.kind === "none",
        ),
    ).toBe(true);
  });

  it("searches Vietnamese without accents, English aliases and canonical types", () => {
    const project = (query: string) =>
      flattenBpmnLauncherItems(
        projectBpmnLauncherGroups({
          acknowledgedProfileId: coreBpmnProfile.id,
          query,
        }),
      ).map((item) => item.id);

    expect(project("re nhanh")).toEqual(["exclusive-gateway"]);
    expect(project("data store")).toEqual(["data-store"]);
    expect(project("IntermediateCatchEvent")).toEqual(
      expect.arrayContaining(["message-catch-event", "timer-catch-event"]),
    );
    expect(project("tự chuẩn bị")).toEqual(
      expect.arrayContaining(["data-object", "user-task"]),
    );
    expect(project("máy chủ xác nhận")).not.toContain("task");
    expect(project("white-box pool")).toEqual([]);
    expect(project("swimlane")).toEqual([
      "horizontal-swimlane-frame",
      "vertical-swimlane-frame",
    ]);
    expect(project("vai tro")).toEqual([
      "horizontal-swimlane-frame",
      "vertical-swimlane-frame",
    ]);
    expect(project("ngang")).toEqual(["horizontal-swimlane-frame"]);
    expect(project("dọc")).toContain("vertical-swimlane-frame");
    expect(project("dọc")).not.toContain("horizontal-swimlane-frame");
    expect(project("horizontal")).toEqual(["horizontal-swimlane-frame"]);
    expect(project("vertical")).toEqual(["vertical-swimlane-frame"]);
    expect(project("Start Event")).toContain("start-event");
    expect(project("Exclusive Gateway")).toContain("exclusive-gateway");
    expect(project("Call Activity")).toContain("call-activity");
    expect(project("Data Store")).toContain("data-store");
    expect(project("Message Flow")).toEqual([]);
  });

  it("keeps all primary labels and hints in plain Vietnamese", () => {
    const primaryCopy = bpmnLauncherToolDefinitions(collaborationBpmnProfile.id)
      .flatMap((item) => [item.tool.label, item.tool.hint])
      .join("\n");

    expect(primaryCopy).not.toMatch(
      /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:Task|Event|Gateway|Activity|Association|DataStore|Data Store|Data Object|Call Activity|SubProcess|Pool|Lane|swimlane|Message|Sequence|Undo|semantic|reference|merge|profile|exact|root|ACK|CAS|FlowNode|Process|XML|DI|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker)\b/iu,
    );
    expect(primaryCopy).toContain("Điểm bắt đầu");
    expect(primaryCopy).toContain("Chọn một hướng");
    expect(primaryCopy).toContain("Dùng lại quy trình");
    expect(primaryCopy).toContain("Phân vai ngang · 2 vai trò");
  });

  it("keeps aggregate recipes click-first instead of exposing partial native drag", () => {
    const definitions = bpmnLauncherToolDefinitions(
      collaborationBpmnProfile.id,
    );

    expect(
      definitions.find((item) => item.id === "call-activity"),
    ).toMatchObject({ supportsDrag: false });
    expect(
      definitions.find((item) => item.id === "horizontal-swimlane-frame"),
    ).toMatchObject({ supportsDrag: false });
    expect(
      definitions.find((item) => item.id === "vertical-swimlane-frame"),
    ).toMatchObject({ supportsDrag: false });
  });

  it("keeps incompatible tools focusable in the projection with an exact reason", () => {
    const contextState = new Map<
      BpmnLibraryItem["id"],
      BpmnLauncherContextState
    >([
      [
        "message-boundary-event",
        {
          state: "context-incompatible",
          reason: "Chọn một công việc trước khi gắn sự kiện.",
        },
      ],
    ]);
    const boundary = flattenBpmnLauncherItems(
      projectBpmnLauncherGroups({
        acknowledgedProfileId: coreComplexRoutingBpmnProfile.id,
        contextState,
      }),
    ).find((item) => item.id === "message-boundary-event");

    expect(boundary).toMatchObject({
      actionability: "context-incompatible",
      stateLabel: "Chọn một công việc trước khi gắn sự kiện.",
    });
  });
});

describe("BPMN component launcher grid navigation", () => {
  it("moves predictably in a five-column grid and clamps at boundaries", () => {
    expect(nextBpmnLauncherGridIndex(0, 12, "ArrowLeft")).toBe(0);
    expect(nextBpmnLauncherGridIndex(0, 12, "ArrowRight")).toBe(1);
    expect(nextBpmnLauncherGridIndex(1, 12, "ArrowDown")).toBe(6);
    expect(nextBpmnLauncherGridIndex(6, 12, "ArrowUp")).toBe(1);
    expect(nextBpmnLauncherGridIndex(10, 12, "ArrowDown")).toBe(11);
    expect(nextBpmnLauncherGridIndex(8, 12, "Home")).toBe(0);
    expect(nextBpmnLauncherGridIndex(2, 12, "End")).toBe(11);
    expect(nextBpmnLauncherGridIndex(0, 0, "End")).toBe(-1);
  });
});

describe("BPMN component launcher semantic contract", () => {
  it("renders a labelled non-modal launcher with usable preparation-aware tools and no lock UI", () => {
    const html = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={coreBpmnProfile.id}
        open
        armedToolId="task"
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
        onToolDragStart={vi.fn()}
      />,
    );

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="false"');
    expect(html).toContain('type="search"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('class="bpmn-component-launcher__preview"');
    expect(html).toContain('aria-label="Mô tả thành phần đang xem"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).not.toContain('/studio/diagram?create=swimlane');
    expect(html).toContain('data-bpmn-tool-id="data-object"');
    expect(html).toContain('data-bpmn-tool-actionability="usable"');
    expect(html).toContain('data-bpmn-tool-preparation="ordered-profile-ack"');
    expect(html).toContain('aria-label="Tài liệu dữ liệu.');
    expect(html).toContain("hệ thống sẽ tự chuẩn bị khi bạn chọn");
    expect(html).not.toContain("Studio sẽ tự chuẩn bị profile");
    expect(html).not.toContain("chờ máy chủ xác nhận trước khi tạo");
    expect(html).toContain('data-bpmn-tool-id="task"');
    expect(html).toContain('data-bpmn-tool-preparation="none"');
    expect(html).toContain('aria-pressed="true"');
    const preparationAwareTags = html.match(
      /<button[^>]*data-bpmn-tool-id="user-task"[^>]*>/g,
    );
    expect(preparationAwareTags?.length).toBeGreaterThan(0);
    expect(
      preparationAwareTags?.every(
        (tag) => !tag.includes("disabled") && tag.includes('draggable="true"'),
      ),
    ).toBe(true);
    expect(html).not.toContain("data-bpmn-tool-state");
    expect(html).not.toContain("requires-upgrade");
    expect(html).not.toContain("Cần nâng cấp");
    expect(html).not.toContain("Mở khóa");
    expect(html).not.toContain("lucide-lock-keyhole");
    expect(html).toContain('data-bpmn-tool-id="horizontal-swimlane-frame"');
    expect(html).toContain('data-bpmn-tool-id="vertical-swimlane-frame"');
    expect(html).toContain(
      'data-bpmn-tool-preparation="in-place-swimlane-conversion"',
    );
    expect(html).toContain("Phân vai ngang · 2 vai trò");
    expect(html).toContain("Phân vai dọc · 2 vai trò");
    const swimlaneBridgeTags = html.match(
      /<button[^>]*data-bpmn-tool-id="(?:horizontal|vertical)-swimlane-frame"[^>]*>/g,
    );
    expect(swimlaneBridgeTags).toHaveLength(2);
    expect(
      swimlaneBridgeTags?.every(
        (tag) => !tag.includes("disabled") && tag.includes('draggable="false"'),
      ),
    ).toBe(true);
  });

  it("renders each projected component exactly once", () => {
    const coreHtml = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={coreBpmnProfile.id}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );
    const collaborationHtml = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={collaborationBpmnProfile.id}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );
    const renderedIds = (html: string) =>
      [...html.matchAll(/data-bpmn-tool-id="([^"]+)"/g)].map(
        (match) => match[1]!,
      );
    const coreIds = renderedIds(coreHtml);
    const collaborationIds = renderedIds(collaborationHtml);

    expect(coreIds).toHaveLength(29);
    expect(new Set(coreIds).size).toBe(29);
    expect(collaborationIds).toHaveLength(32);
    expect(new Set(collaborationIds).size).toBe(32);
    expect(coreHtml).toContain("Thường dùng");
  });

  it("renders the stable icon key and semantic tone on every Collaboration tile", () => {
    const html = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={collaborationBpmnProfile.id}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );
    const definitions = bpmnLauncherToolDefinitions(
      collaborationBpmnProfile.id,
    );

    expect(definitions).toHaveLength(32);
    expect(new Set(definitions.map((item) => item.iconKey)).size).toBe(32);
    expect(new Set(definitions.map((item) => item.groupId))).toEqual(
      new Set([
        "connections",
        "events",
        "activities",
        "gateways",
        "data-artifacts",
        "collaboration",
      ]),
    );

    for (const definition of definitions) {
      const tile = html.match(
        new RegExp(
          `<button[^>]*data-bpmn-tool-id="${definition.id}"[^>]*>[\\s\\S]*?</button>`,
        ),
      )?.[0];

      expect(tile, definition.id).toBeDefined();
      expect(tile, definition.id).toContain(
        `data-bpmn-tool-icon="${definition.iconKey}"`,
      );
      expect(tile, definition.id).toContain(
        `data-bpmn-tool-group="${definition.groupId}"`,
      );
      expect(tile, definition.id).toContain(
        'class="bpmn-component-tile__glyph" aria-hidden="true"',
      );
      expect(tile, definition.id).toContain('aria-hidden="true"');
    }
  });

  it("keeps an incompatible tool keyboard-focusable and exposes its reason", () => {
    const contextState = new Map<
      BpmnLibraryItem["id"],
      BpmnLauncherContextState
    >([
      [
        "task",
        {
          state: "context-incompatible",
          reason: "Công việc này chưa phù hợp với vị trí đang chọn.",
        },
      ],
    ]);
    const html = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={coreBpmnProfile.id}
        contextState={contextState}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );
    const incompatibleTags = html.match(
      /<button[^>]*data-bpmn-tool-id="task"[^>]*>/g,
    );

    expect(incompatibleTags?.length).toBeGreaterThan(0);
    expect(incompatibleTags?.every((tag) => !tag.includes("disabled"))).toBe(true);
    expect(html).toContain(
      'data-bpmn-tool-actionability="context-incompatible"',
    );
    expect(html).toContain('data-bpmn-tool-preparation="none"');
    expect(html).not.toContain("lucide-lock-keyhole");
    expect(html).toContain(
      "Công việc này chưa phù hợp với vị trí đang chọn.",
    );
  });

  it("does not render the panel while closed", () => {
    const html = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={coreBpmnProfile.id}
        open={false}
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );

    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain('role="dialog"');
  });

  it("uses in-place swimlane tools instead of a new-diagram CTA", () => {
    const coreHtml = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={coreBpmnProfile.id}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );
    const collaborationHtml = renderToStaticMarkup(
      <BpmnComponentLauncher
        acknowledgedProfileId={collaborationBpmnProfile.id}
        open
        onOpenChange={vi.fn()}
        onToolIntent={vi.fn()}
      />,
    );

    expect(coreHtml).toContain("Phân vai ngang · 2 vai trò");
    expect(coreHtml).toContain("Phân vai dọc · 2 vai trò");
    expect(coreHtml).not.toContain("Tạo sơ đồ swimlane");
    expect(coreHtml).not.toContain('/studio/diagram?create=swimlane');
    expect(collaborationHtml).not.toContain("Tạo sơ đồ swimlane");
    expect(itemIds(coreBpmnProfile.id)).toHaveLength(29);
    expect(itemIds(collaborationSwimlaneLayoutsBpmnProfile.id)).toHaveLength(32);
  });
});
