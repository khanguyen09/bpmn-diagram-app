import { describe, expect, it } from "vitest";
import {
  collaborationBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationSwimlaneLayoutsBpmnProfile,
  supportedCollaborationBpmnProfiles,
  supportsSwimlaneLayouts,
} from "../domain/collaboration-profile";
import {
  acknowledgedBpmnAuthoringProfile,
  coreBpmnProfile,
  coreCatchingEventsBpmnProfile,
  coreBoundaryEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreStructuredBpmnProfile,
  coreTaskTypesBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreComplexRoutingBpmnProfile,
  supportedCoreBpmnProfiles,
} from "../domain/core-profile";
import {
  acknowledgedBpmnAuthoringProfile as acknowledgedUiProfile,
  bpmnAppendActions,
  bpmnBoundaryAttachActions,
  bpmnNodeLibraryGroups,
  filterBpmnNodeLibrary,
} from "./bpmn-node-library-catalogue";

describe("BPMN node library catalogue", () => {
  it("keeps collaboration-only elements outside the core profile", () => {
    const coreIds = bpmnNodeLibraryGroups(coreBpmnProfile.id)
      .flatMap((group) => group.items)
      .map((item) => item.id);
    const collaborationIds = bpmnNodeLibraryGroups(collaborationBpmnProfile.id)
      .flatMap((group) => group.items)
      .map((item) => item.id);

    expect(coreIds).not.toContain("message-flow");
    expect(coreIds).not.toContain("white-box-pool");
    expect(collaborationIds).toContain("message-flow");
    expect(collaborationIds).toContain("black-box-pool");
    expect(
      bpmnNodeLibraryGroups(collaborationBpmnProfile.id).find(
        (group) => group.id === "collaboration",
      )?.label,
    ).toBe("Cộng tác & phân vai");
    expect(
      bpmnNodeLibraryGroups(collaborationBpmnProfile.id)
        .flatMap((group) => group.items)
        .find((item) => item.id === "white-box-pool"),
    ).toMatchObject({
      label: "Bên tham gia có quy trình",
    });
  });

  it("reveals native horizontal and vertical frame recipes only in the successor", () => {
    const predecessorIds = bpmnNodeLibraryGroups(
      collaborationFullAuthoringBpmnProfile.id,
    )
      .flatMap((group) => group.items)
      .map((item) => item.id);
    const successorItems = bpmnNodeLibraryGroups(
      collaborationSwimlaneLayoutsBpmnProfile.id,
    ).flatMap((group) => group.items);

    expect(predecessorIds).not.toEqual(
      expect.arrayContaining([
        "horizontal-swimlane-frame",
        "vertical-swimlane-frame",
      ]),
    );
    expect(
      successorItems.filter((item) => item.id.includes("swimlane-frame")),
    ).toMatchObject([
      {
        id: "horizontal-swimlane-frame",
        type: "bpmn:Participant",
        recipe: { kind: "swimlane-frame", orientation: "horizontal" },
      },
      {
        id: "vertical-swimlane-frame",
        type: "bpmn:Participant",
        recipe: { kind: "swimlane-frame", orientation: "vertical" },
      },
    ]);
    expect(
      filterBpmnNodeLibrary(
        bpmnNodeLibraryGroups(collaborationSwimlaneLayoutsBpmnProfile.id),
        "swimlane doc",
      )
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(["vertical-swimlane-frame"]);
  });

  it("keeps every predecessor and Core profile isolated from frame recipes", () => {
    const profilesWithoutFrames = [
      ...supportedCoreBpmnProfiles,
      ...supportedCollaborationBpmnProfiles.filter(
        (profile) => !supportsSwimlaneLayouts(profile.id),
      ),
    ];

    for (const profile of profilesWithoutFrames) {
      expect(
        bpmnNodeLibraryGroups(profile.id)
          .flatMap((group) => group.items)
          .filter((item) => item.id.includes("swimlane-frame")),
        profile.id,
      ).toEqual([]);
    }
  });

  it("exposes catching recipes and Event-Based Gateway only after each ACK", () => {
    expect(
      acknowledgedUiProfile(
        coreCatchingEventsBpmnProfile.id,
        true,
        false,
        false,
      ),
    ).toBe(coreConditionalBpmnProfile.id);
    expect(
      acknowledgedUiProfile(coreEventRoutingBpmnProfile.id, true, true, false),
    ).toBe(coreCatchingEventsBpmnProfile.id);

    const catchingItems = bpmnNodeLibraryGroups(
      coreCatchingEventsBpmnProfile.id,
    ).flatMap((group) => group.items);
    const message = catchingItems.find(
      (item) => item.id === "message-catch-event",
    );
    const timer = catchingItems.find((item) => item.id === "timer-catch-event");
    expect(message).toMatchObject({
      kind: "shape",
      type: "bpmn:IntermediateCatchEvent",
      recipe: {
        kind: "catch-event",
        eventDefinitionType: "bpmn:MessageEventDefinition",
      },
    });
    expect(timer).toMatchObject({
      recipe: {
        kind: "catch-event",
        eventDefinitionType: "bpmn:TimerEventDefinition",
      },
    });
    expect(catchingItems.map((item) => item.id)).not.toContain(
      "event-based-gateway",
    );
    expect(
      bpmnNodeLibraryGroups(coreEventRoutingBpmnProfile.id)
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toContain("event-based-gateway");
  });

  it("matches Vietnamese aliases without requiring accents", () => {
    const result = filterBpmnNodeLibrary(
      bpmnNodeLibraryGroups(coreBpmnProfile.id),
      "quyet dinh",
    );

    expect(
      result.flatMap((group) => group.items).map((item) => item.id),
    ).toEqual(["exclusive-gateway"]);
  });

  it("matches English labels and returns an empty catalogue for no match", () => {
    const groups = bpmnNodeLibraryGroups(collaborationBpmnProfile.id);

    expect(
      filterBpmnNodeLibrary(groups, "white-box").flatMap(
        (group) => group.items,
      ),
    ).toHaveLength(1);
    expect(filterBpmnNodeLibrary(groups, "khong-ton-tai")).toEqual([]);
  });

  it("keeps canonical English names searchable without exposing them as primary copy", () => {
    const groups = bpmnNodeLibraryGroups(
      collaborationSwimlaneLayoutsBpmnProfile.id,
    );
    const findIds = (query: string) =>
      filterBpmnNodeLibrary(groups, query)
        .flatMap((group) => group.items)
        .map((item) => item.id);

    expect(findIds("Start Event")).toContain("start-event");
    expect(findIds("Exclusive Gateway")).toContain("exclusive-gateway");
    expect(findIds("Message Flow")).toContain("message-flow");
    expect(findIds("Call Activity")).toContain("call-activity");
    expect(findIds("Data Store")).toContain("data-store");
    expect(findIds("vertical swimlane")).toContain(
      "vertical-swimlane-frame",
    );

    const primaryCopy = groups
      .flatMap((group) => [
        group.label,
        ...group.items.flatMap((item) => [item.label, item.hint]),
      ])
      .join("\n");
    expect(primaryCopy).not.toMatch(
      /teb-(?:core|collaboration)-[\w-]+@\d+|\b(?:Task|Event|Gateway|Activity|Association|DataStore|Data Store|Data Object|Call Activity|SubProcess|Pool|Lane|swimlane|Message|Sequence|Undo|semantic|reference|merge|profile|exact|root|ACK|CAS|FlowNode|Process|XML|DI|Model ID|Revision|Versions?|restore-version|successor-draft|commit|history|candidate|worker)\b/iu,
    );
  });

  it("exposes Parallel Gateway only after the Structured Routing upgrade", () => {
    expect(
      bpmnAppendActions(coreBpmnProfile.id).map((action) => action.id),
    ).not.toContain("parallel-gateway");
    expect(
      bpmnAppendActions(coreStructuredBpmnProfile.id).map(
        (action) => action.id,
      ),
    ).toContain("parallel-gateway");
    expect(
      bpmnNodeLibraryGroups(coreStructuredBpmnProfile.id)
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toContain("parallel-gateway");
  });

  it("exposes Inclusive Gateway only for Conditional Routing", () => {
    expect(
      acknowledgedBpmnAuthoringProfile(coreConditionalBpmnProfile.id, false),
    ).toBe(coreStructuredBpmnProfile.id);
    expect(
      acknowledgedBpmnAuthoringProfile(coreConditionalBpmnProfile.id, true),
    ).toBe(coreConditionalBpmnProfile.id);
    expect(
      bpmnAppendActions(coreStructuredBpmnProfile.id).map(
        (action) => action.id,
      ),
    ).not.toContain("inclusive-gateway");
    expect(
      bpmnAppendActions(coreConditionalBpmnProfile.id).map(
        (action) => action.id,
      ),
    ).toEqual([
      "task",
      "exclusive-gateway",
      "parallel-gateway",
      "inclusive-gateway",
      "end-event",
    ]);
    expect(
      filterBpmnNodeLibrary(
        bpmnNodeLibraryGroups(coreConditionalBpmnProfile.id),
        "mot hoac nhieu",
      )
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(["inclusive-gateway"]);
  });

  it("keeps Task Types, Intermediate Events and Boundary Events behind separate ACKs", () => {
    expect(
      acknowledgedUiProfile(
        coreBoundaryEventsBpmnProfile.id,
        true,
        true,
        true,
        true,
        true,
        false,
      ),
    ).toBe(coreIntermediateEventsBpmnProfile.id);
    expect(
      acknowledgedUiProfile(
        coreBoundaryEventsBpmnProfile.id,
        true,
        true,
        true,
        true,
        false,
        false,
      ),
    ).toBe(coreTaskTypesBpmnProfile.id);
    expect(
      acknowledgedUiProfile(
        coreBoundaryEventsBpmnProfile.id,
        true,
        true,
        true,
        false,
        false,
        false,
      ),
    ).toBe(coreEventRoutingBpmnProfile.id);
  });

  it("reveals advanced authoring groups progressively with exact recipes", () => {
    expect(
      bpmnNodeLibraryGroups(coreActivityContainersBpmnProfile.id)
        .flatMap((group) => group.items)
        .find((item) => item.id === "expanded-subprocess"),
    ).toMatchObject({
      type: "bpmn:SubProcess",
      recipe: { kind: "expanded-subprocess-starter" },
    });
    const dataItems = bpmnNodeLibraryGroups(coreDataAuthoringBpmnProfile.id)
      .flatMap((group) => group.items);
    expect(dataItems.map((item) => item.id)).toEqual(
      expect.arrayContaining(["data-association", "data-object", "data-store"]),
    );
    expect(
      bpmnNodeLibraryGroups(coreActivityContainersBpmnProfile.id)
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).not.toContain("data-object");
    expect(
      bpmnNodeLibraryGroups(coreComplexRoutingBpmnProfile.id)
        .flatMap((group) => group.items)
        .find((item) => item.id === "complex-gateway"),
    ).toMatchObject({
      type: "bpmn:ComplexGateway",
      recipe: { kind: "complex-join" },
    });
  });

  it("exposes exact task/throw recipes and keeps Boundary out of Add next", () => {
    expect(
      bpmnAppendActions(coreTaskTypesBpmnProfile.id).map((item) => item.id),
    ).toEqual(expect.arrayContaining(["user-task", "service-task", "manual-task"]));

    const throwActions = bpmnAppendActions(
      coreIntermediateEventsBpmnProfile.id,
    ).filter((item) => item.type === "bpmn:IntermediateThrowEvent");
    expect(throwActions).toMatchObject([
      { id: "none-throw-event", recipe: { kind: "throw-event" } },
      {
        id: "message-throw-event",
        recipe: {
          kind: "throw-event",
          eventDefinitionType: "bpmn:MessageEventDefinition",
        },
      },
    ]);
    expect(
      bpmnAppendActions(coreBoundaryEventsBpmnProfile.id).some((item) =>
        item.id.includes("boundary"),
      ),
    ).toBe(false);
    expect(bpmnBoundaryAttachActions(coreBoundaryEventsBpmnProfile.id))
      .toMatchObject([
        {
          id: "message-boundary-event",
          recipe: {
            kind: "boundary-event",
            cancelActivity: true,
          },
        },
        {
          id: "timer-boundary-event",
          recipe: {
            kind: "boundary-event",
            cancelActivity: true,
          },
        },
      ]);
  });

  it("exposes native documentation artifacts only in Full Authoring", () => {
    const frozenIds = bpmnNodeLibraryGroups(coreBoundaryEventsBpmnProfile.id)
      .flatMap((group) => group.items)
      .map((item) => item.id);
    const fullGroups = bpmnNodeLibraryGroups(coreFullAuthoringBpmnProfile.id);
    const fullIds = fullGroups.flatMap((group) => group.items).map((item) => item.id);

    expect(frozenIds).not.toEqual(
      expect.arrayContaining(["text-annotation", "group", "association"]),
    );
    expect(
      fullGroups.find((group) => group.id === "documentation")?.label,
    ).toBe("Tài liệu & tổ chức");
    expect(fullIds).toEqual(
      expect.arrayContaining(["text-annotation", "group", "association"]),
    );
    expect(
      fullGroups
        .flatMap((group) => group.items)
        .find((item) => item.id === "group"),
    ).toMatchObject({
      type: "bpmn:Group",
      recipe: { kind: "titled-group" },
    });
    expect(
      bpmnNodeLibraryGroups(collaborationFullAuthoringBpmnProfile.id)
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(expect.arrayContaining(["association", "message-flow"]));
  });
});
