import {
  coreCatchingEventsBpmnProfile,
  coreConditionalBpmnProfile,
  coreEventRoutingBpmnProfile,
  coreActivityContainersBpmnProfile,
  coreDataAuthoringBpmnProfile,
  coreFullAuthoringBpmnProfile,
  coreIntermediateEventsBpmnProfile,
  coreStructuredBpmnProfile,
  coreTaskTypesBpmnProfile,
  supportsBoundaryEvents,
  supportsSubprocessTimers,
  supportsCatchingEvents,
  supportsConditionalRouting,
  supportsEventRouting,
  supportsActivityContainers,
  supportsComplexRouting,
  supportsDataAuthoring,
  supportsFullAuthoring,
  supportsIntermediateEvents,
  supportsStructuredRouting,
  supportsTaskTypes,
  type BpmnProfileId,
} from "../domain/core-profile";
import {
  collaborationCatchingEventsBpmnProfile,
  collaborationActivityContainersBpmnProfile,
  collaborationDataAuthoringBpmnProfile,
  collaborationFullAuthoringBpmnProfile,
  collaborationConditionalBpmnProfile,
  collaborationEventRoutingBpmnProfile,
  collaborationIntermediateEventsBpmnProfile,
  collaborationStructuredBpmnProfile,
  collaborationTaskTypesBpmnProfile,
  isCollaborationBpmnProfileId,
  supportsSwimlaneLayouts,
} from "../domain/collaboration-profile";

export type BpmnShapeCreationRecipe =
  | { readonly kind: "plain" }
  | { readonly kind: "text-annotation" }
  | { readonly kind: "titled-group" }
  | { readonly kind: "expanded-subprocess-starter" }
  | { readonly kind: "call-activity" }
  | { readonly kind: "data-object" }
  | { readonly kind: "data-store" }
  | { readonly kind: "complex-join" }
  | {
      readonly kind: "swimlane-frame";
      readonly orientation: "horizontal" | "vertical";
    }
  | {
      readonly kind: "catch-event";
      readonly eventDefinitionType:
        "bpmn:MessageEventDefinition" | "bpmn:TimerEventDefinition";
    }
  | {
      readonly kind: "throw-event";
      readonly eventDefinitionType?: "bpmn:MessageEventDefinition";
    }
  | {
      readonly kind: "boundary-event";
      readonly eventDefinitionType:
        "bpmn:MessageEventDefinition" | "bpmn:TimerEventDefinition";
      readonly cancelActivity: boolean;
    };

export type BpmnLibraryItem =
  | {
      readonly id:
        | "sequence-flow"
        | "message-flow"
        | "association"
        | "data-association";
      readonly kind: "connector";
      readonly connector:
        | "sequence"
        | "message"
        | "association"
        | "data-association";
      readonly label: string;
      readonly hint: string;
      readonly aliases: readonly string[];
    }
  | {
      readonly id:
        | "start-event"
        | "task"
        | "exclusive-gateway"
        | "parallel-gateway"
        | "inclusive-gateway"
        | "message-catch-event"
        | "timer-catch-event"
        | "receive-task"
        | "user-task"
        | "service-task"
        | "manual-task"
        | "none-throw-event"
        | "message-throw-event"
        | "message-boundary-event"
        | "timer-boundary-event"
        | "event-based-gateway"
        | "end-event"
        | "text-annotation"
        | "group"
        | "expanded-subprocess"
        | "call-activity"
        | "data-object"
        | "data-store"
        | "complex-gateway"
        | "horizontal-swimlane-frame"
        | "vertical-swimlane-frame"
        | "white-box-pool"
        | "black-box-pool";
      readonly kind: "shape";
      readonly type:
        | "bpmn:StartEvent"
        | "bpmn:Task"
        | "bpmn:ExclusiveGateway"
        | "bpmn:ParallelGateway"
        | "bpmn:InclusiveGateway"
        | "bpmn:IntermediateCatchEvent"
        | "bpmn:ReceiveTask"
        | "bpmn:UserTask"
        | "bpmn:ServiceTask"
        | "bpmn:ManualTask"
        | "bpmn:IntermediateThrowEvent"
        | "bpmn:BoundaryEvent"
        | "bpmn:EventBasedGateway"
        | "bpmn:EndEvent"
        | "bpmn:TextAnnotation"
        | "bpmn:Group"
        | "bpmn:SubProcess"
        | "bpmn:CallActivity"
        | "bpmn:DataObjectReference"
        | "bpmn:DataStoreReference"
        | "bpmn:ComplexGateway"
        | "bpmn:Participant";
      readonly recipe: BpmnShapeCreationRecipe;
      readonly participantExpanded?: boolean;
      readonly label: string;
      readonly hint: string;
      readonly aliases: readonly string[];
    };

export interface BpmnLibraryGroup {
  readonly id:
    | "connections"
    | "events"
    | "activities"
    | "gateways"
    | "documentation"
    | "structure-reuse"
    | "data"
    | "advanced-routing"
    | "collaboration";
  readonly label: string;
  readonly items: readonly BpmnLibraryItem[];
}

const coreGroups: readonly BpmnLibraryGroup[] = [
  {
    id: "connections",
    label: "Kết nối",
    items: [
      {
        id: "sequence-flow",
        kind: "connector",
        connector: "sequence",
        label: "Luồng công việc",
        hint: "Nối hai bước theo thứ tự trong cùng một bên tham gia.",
        aliases: [
          "luồng tuần tự",
          "đường nối",
          "connector",
          "flow",
          "sequence flow",
        ],
      },
    ],
  },
  {
    id: "events",
    label: "Sự kiện",
    items: [
      {
        id: "start-event",
        kind: "shape",
        type: "bpmn:StartEvent",
        recipe: { kind: "plain" },
        label: "Điểm bắt đầu",
        hint: "Nơi quy trình bắt đầu.",
        aliases: ["bắt đầu", "khởi đầu", "start", "event", "start event"],
      },
      {
        id: "end-event",
        kind: "shape",
        type: "bpmn:EndEvent",
        recipe: { kind: "plain" },
        label: "Điểm kết thúc",
        hint: "Nơi một nhánh công việc kết thúc.",
        aliases: ["kết thúc", "đích", "end", "event", "end event"],
      },
    ],
  },
  {
    id: "activities",
    label: "Hoạt động",
    items: [
      {
        id: "task",
        kind: "shape",
        type: "bpmn:Task",
        recipe: { kind: "plain" },
        label: "Công việc",
        hint: "Một bước cần thực hiện trong quy trình.",
        aliases: ["tác vụ", "công việc", "hoạt động", "activity", "task"],
      },
    ],
  },
  {
    id: "gateways",
    label: "Điểm quyết định",
    items: [
      {
        id: "exclusive-gateway",
        kind: "shape",
        type: "bpmn:ExclusiveGateway",
        recipe: { kind: "plain" },
        label: "Chọn một hướng",
        hint: "Chỉ một nhánh phù hợp được đi tiếp.",
        aliases: [
          "gateway",
          "quyết định",
          "rẽ nhánh",
          "điều kiện",
          "xor",
          "exclusive gateway",
        ],
      },
    ],
  },
];

const parallelGatewayItem: BpmnLibraryItem = {
  id: "parallel-gateway",
  kind: "shape",
  type: "bpmn:ParallelGateway",
  recipe: { kind: "plain" },
  label: "Chạy song song",
  hint: "Tất cả các nhánh cùng được bắt đầu.",
  aliases: [
    "gateway",
    "song song",
    "đồng thời",
    "parallel",
    "and",
    "parallel gateway",
  ],
};

const inclusiveGatewayItem: BpmnLibraryItem = {
  id: "inclusive-gateway",
  kind: "shape",
  type: "bpmn:InclusiveGateway",
  recipe: { kind: "plain" },
  label: "Chọn một hoặc nhiều hướng",
  hint: "Một hoặc nhiều nhánh phù hợp có thể cùng được đi tiếp.",
  aliases: [
    "gateway",
    "bao gồm",
    "một hoặc nhiều",
    "inclusive",
    "or",
    "inclusive gateway",
  ],
};

type BpmnShapeLibraryItem = Extract<BpmnLibraryItem, { kind: "shape" }>;

const messageCatchEventItem: BpmnShapeLibraryItem = {
  id: "message-catch-event",
  kind: "shape",
  type: "bpmn:IntermediateCatchEvent",
  recipe: {
    kind: "catch-event",
    eventDefinitionType: "bpmn:MessageEventDefinition",
  },
  label: "Chờ thông điệp",
  hint: "Tạm dừng cho đến khi nhận được một thông điệp.",
  aliases: [
    "sự kiện nhận",
    "chờ tin nhắn",
    "message catch",
    "envelope",
    "message catch event",
  ],
};

const timerCatchEventItem: BpmnShapeLibraryItem = {
  id: "timer-catch-event",
  kind: "shape",
  type: "bpmn:IntermediateCatchEvent",
  recipe: {
    kind: "catch-event",
    eventDefinitionType: "bpmn:TimerEventDefinition",
  },
  label: "Chờ thời điểm",
  hint: "Tạm dừng đến một thời điểm hoặc hết khoảng chờ.",
  aliases: [
    "sự kiện thời gian",
    "hẹn giờ",
    "timer catch",
    "clock",
    "timer catch event",
  ],
};

const receiveTaskItem: BpmnShapeLibraryItem = {
  id: "receive-task",
  kind: "shape",
  type: "bpmn:ReceiveTask",
  recipe: { kind: "plain" },
  label: "Nhận thông điệp",
  hint: "Công việc chỉ hoàn tất sau khi nhận được một thông điệp.",
  aliases: [
    "tác vụ nhận",
    "nhận thông điệp",
    "receive",
    "message task",
    "receive task",
  ],
};

const eventBasedGatewayItem: BpmnShapeLibraryItem = {
  id: "event-based-gateway",
  kind: "shape",
  type: "bpmn:EventBasedGateway",
  recipe: { kind: "plain" },
  label: "Chờ sự kiện đầu tiên",
  hint: "Sự kiện đến trước sẽ quyết định nhánh đi tiếp.",
  aliases: [
    "gateway sự kiện",
    "đến trước",
    "event based",
    "race",
    "event-based gateway",
  ],
};

const taskTypeItems = [
  {
    id: "user-task",
    kind: "shape",
    type: "bpmn:UserTask",
    recipe: { kind: "plain" },
    label: "Người thực hiện",
    hint: "Công việc do một người hoàn thành trong hệ thống.",
    aliases: ["nguoi dung", "con nguoi", "user task", "human"],
  },
  {
    id: "service-task",
    kind: "shape",
    type: "bpmn:ServiceTask",
    recipe: { kind: "plain" },
    label: "Hệ thống thực hiện",
    hint: "Công việc được một dịch vụ hoặc hệ thống tự động xử lý.",
    aliases: ["dich vu", "he thong", "service task", "automation"],
  },
  {
    id: "manual-task",
    kind: "shape",
    type: "bpmn:ManualTask",
    recipe: { kind: "plain" },
    label: "Làm thủ công",
    hint: "Công việc do con người thực hiện ngoài hệ thống.",
    aliases: ["thu cong", "manual task", "offline"],
  },
] as const satisfies readonly BpmnShapeLibraryItem[];

const intermediateThrowItems = [
  {
    id: "none-throw-event",
    kind: "shape",
    type: "bpmn:IntermediateThrowEvent",
    recipe: { kind: "throw-event" },
    label: "Mốc trung gian",
    hint: "Đánh dấu một mốc trên đường đi của quy trình.",
    aliases: [
      "su kien nem none",
      "intermediate throw",
      "milestone",
      "none intermediate throw",
    ],
  },
  {
    id: "message-throw-event",
    kind: "shape",
    type: "bpmn:IntermediateThrowEvent",
    recipe: {
      kind: "throw-event",
      eventDefinitionType: "bpmn:MessageEventDefinition",
    },
    label: "Gửi thông điệp",
    hint: "Phát một thông điệp để bên khác nhận.",
    aliases: [
      "su kien gui",
      "nem thong diep",
      "message throw",
      "send",
      "message intermediate throw",
    ],
  },
] as const satisfies readonly BpmnShapeLibraryItem[];

const boundaryEventItems = [
  {
    id: "message-boundary-event",
    kind: "shape",
    type: "bpmn:BoundaryEvent",
    recipe: {
      kind: "boundary-event",
      eventDefinitionType: "bpmn:MessageEventDefinition",
      cancelActivity: true,
    },
    label: "Khi nhận được thông điệp",
    hint: "Gắn vào một công việc và phản ứng khi thông điệp đến.",
    aliases: [
      "bien thong diep",
      "message boundary",
      "attached",
      "message boundary event",
    ],
  },
  {
    id: "timer-boundary-event",
    kind: "shape",
    type: "bpmn:BoundaryEvent",
    recipe: {
      kind: "boundary-event",
      eventDefinitionType: "bpmn:TimerEventDefinition",
      cancelActivity: true,
    },
    label: "Khi hết thời gian",
    hint: "Gắn vào một công việc và phản ứng khi đến hạn.",
    aliases: [
      "bien thoi gian",
      "timer boundary",
      "timeout",
      "attached",
      "timer boundary event",
    ],
  },
] as const satisfies readonly BpmnShapeLibraryItem[];

const collaborationGroup: BpmnLibraryGroup = {
  id: "collaboration",
  label: "Cộng tác & phân vai",
  items: [
    {
      id: "message-flow",
      kind: "connector",
      connector: "message",
      label: "Trao đổi thông điệp",
      hint: "Nối hai bên tham gia khác nhau để thể hiện việc gửi và nhận.",
      aliases: [
        "luồng thông điệp",
        "tin nhắn",
        "message",
        "connector",
        "message flow",
      ],
    },
    {
      id: "white-box-pool",
      kind: "shape",
      type: "bpmn:Participant",
      participantExpanded: true,
      recipe: { kind: "plain" },
      label: "Bên tham gia có quy trình",
      hint: "Hiển thị các công việc và vai trò bên trong.",
      aliases: [
        "pool mở",
        "participant",
        "process",
        "hồ bơi",
        "white-box pool",
      ],
    },
    {
      id: "black-box-pool",
      kind: "shape",
      type: "bpmn:Participant",
      participantExpanded: false,
      recipe: { kind: "plain" },
      label: "Bên tham gia bên ngoài",
      hint: "Chỉ thể hiện việc trao đổi, không hiển thị công việc nội bộ.",
      aliases: [
        "pool đóng",
        "participant",
        "đối tác",
        "hệ thống",
        "black-box pool",
      ],
    },
  ],
};

const swimlaneFrameItems = [
  {
    id: "horizontal-swimlane-frame",
    kind: "shape",
    type: "bpmn:Participant",
    participantExpanded: true,
    recipe: { kind: "swimlane-frame", orientation: "horizontal" },
    label: "Phân vai ngang · 2 vai trò",
    hint: "Chia bên tham gia thành hai vai trò xếp trên và dưới.",
    aliases: [
      "swimlane ngang",
      "pool ngang",
      "horizontal lanes",
      "horizontal swimlane",
      "roles",
    ],
  },
  {
    id: "vertical-swimlane-frame",
    kind: "shape",
    type: "bpmn:Participant",
    participantExpanded: true,
    recipe: { kind: "swimlane-frame", orientation: "vertical" },
    label: "Phân vai dọc · 2 vai trò",
    hint: "Chia bên tham gia thành hai vai trò xếp trái và phải.",
    aliases: [
      "swimlane doc",
      "pool doc",
      "vertical lanes",
      "vertical swimlane",
      "roles",
    ],
  },
] as const satisfies readonly BpmnShapeLibraryItem[];

const documentationGroup: BpmnLibraryGroup = {
  id: "documentation",
  label: "Tài liệu & tổ chức",
  items: [
    {
      id: "association",
      kind: "connector",
      connector: "association",
      label: "Đường nối chú thích",
      hint: "Nối chú thích với nội dung liên quan mà không đổi trình tự công việc.",
      aliases: ["association", "lien ket chu thich", "artifact"],
    },
    {
      id: "text-annotation",
      kind: "shape",
      type: "bpmn:TextAnnotation",
      recipe: { kind: "text-annotation" },
      label: "Chú thích",
      hint: "Thêm ghi chú giải thích ngay trên sơ đồ.",
      aliases: [
        "chu thich",
        "annotation",
        "ghi chu",
        "text",
        "text annotation",
      ],
    },
    {
      id: "group",
      kind: "shape",
      type: "bpmn:Group",
      recipe: { kind: "titled-group" },
      label: "Nhóm trực quan",
      hint: "Khoanh vùng các phần tử liên quan mà không thay đổi luồng.",
      aliases: ["nhom", "group", "vung", "phan loai", "visual group"],
    },
  ],
};

const structureReuseGroup: BpmnLibraryGroup = {
  id: "structure-reuse",
  label: "Cấu trúc & tái sử dụng",
  items: [
    {
      id: "expanded-subprocess",
      kind: "shape",
      type: "bpmn:SubProcess",
      recipe: { kind: "expanded-subprocess-starter" },
      label: "Quy trình con",
      hint: "Tạo sẵn một luồng nhỏ gồm điểm bắt đầu, công việc và điểm kết thúc.",
      aliases: [
        "quy trinh con",
        "subprocess",
        "container",
        "mo rong",
        "expanded subprocess",
      ],
    },
    {
      id: "call-activity",
      kind: "shape",
      type: "bpmn:CallActivity",
      recipe: { kind: "call-activity" },
      label: "Dùng lại quy trình",
      hint: "Gọi một quy trình dùng chung đã có trong sơ đồ.",
      aliases: ["goi quy trinh", "call activity", "reuse", "called element"],
    },
  ],
};

const dataGroup: BpmnLibraryGroup = {
  id: "data",
  label: "Dữ liệu",
  items: [
    {
      id: "data-association",
      kind: "connector",
      connector: "data-association",
      label: "Liên kết dữ liệu",
      hint: "Nối tài liệu hoặc kho dữ liệu với một công việc.",
      aliases: ["data association", "du lieu vao", "du lieu ra", "dependency"],
    },
    {
      id: "data-object",
      kind: "shape",
      type: "bpmn:DataObjectReference",
      recipe: { kind: "data-object" },
      label: "Tài liệu dữ liệu",
      hint: "Thể hiện tài liệu hoặc dữ liệu được dùng trong một công việc.",
      aliases: ["tai lieu du lieu", "data object", "document", "reference"],
    },
    {
      id: "data-store",
      kind: "shape",
      type: "bpmn:DataStoreReference",
      recipe: { kind: "data-store" },
      label: "Kho dữ liệu",
      hint: "Thể hiện nơi dữ liệu được lưu và dùng lại.",
      aliases: ["kho du lieu", "data store", "database", "shared"],
    },
  ],
};

const advancedRoutingGroup: BpmnLibraryGroup = {
  id: "advanced-routing",
  label: "Định tuyến nâng cao",
  items: [
    {
      id: "complex-gateway",
      kind: "shape",
      type: "bpmn:ComplexGateway",
      recipe: { kind: "complex-join" },
      label: "Đồng bộ theo điều kiện",
      hint: "Gom nhiều nhánh và chỉ tiếp tục khi điều kiện đã đặt được đáp ứng.",
      aliases: ["complex gateway", "dong bo", "activation", "join"],
    },
  ],
};

export function bpmnNodeLibraryGroups(
  profileId: BpmnProfileId,
): readonly BpmnLibraryGroup[] {
  const profileGroups = coreGroups.map((group) =>
    group.id === "events"
      ? {
          ...group,
          items: [
            ...group.items,
            ...(supportsCatchingEvents(profileId)
              ? [messageCatchEventItem, timerCatchEventItem]
              : []),
          ],
        }
      : group.id === "activities"
        ? {
            ...group,
            items: [
              ...group.items,
              ...(supportsCatchingEvents(profileId) ? [receiveTaskItem] : []),
              ...(supportsTaskTypes(profileId) ? taskTypeItems : []),
            ],
          }
        : group.id === "gateways"
          ? {
              ...group,
              items: [
                ...group.items,
                ...(supportsStructuredRouting(profileId)
                  ? [parallelGatewayItem]
                  : []),
                ...(supportsConditionalRouting(profileId)
                  ? [inclusiveGatewayItem]
                  : []),
                ...(supportsEventRouting(profileId)
                  ? [eventBasedGatewayItem]
                  : []),
              ],
            }
          : group,
  );
  const groupsWithExtendedEvents = profileGroups.map((group) =>
    group.id === "events"
      ? {
          ...group,
          items: [
            ...group.items,
            ...(supportsIntermediateEvents(profileId)
              ? intermediateThrowItems
              : []),
            ...(supportsBoundaryEvents(profileId) ? boundaryEventItems : []),
          ],
        }
      : group,
  );
  const groupsWithDocumentation = supportsFullAuthoring(profileId)
    ? [...groupsWithExtendedEvents, documentationGroup]
    : groupsWithExtendedEvents;
  const groupsWithActivities = supportsActivityContainers(profileId)
    ? [...groupsWithDocumentation, structureReuseGroup]
    : groupsWithDocumentation;
  const groupsWithData = supportsDataAuthoring(profileId)
    ? [...groupsWithActivities, dataGroup]
    : groupsWithActivities;
  const groupsWithAdvancedRouting = supportsComplexRouting(profileId)
    ? [...groupsWithData, advancedRoutingGroup]
    : groupsWithData;
  const orientedCollaborationGroup = supportsSwimlaneLayouts(profileId)
    ? {
        ...collaborationGroup,
        items: [
          collaborationGroup.items[0]!,
          ...swimlaneFrameItems,
          ...collaborationGroup.items.slice(1),
        ],
      }
    : collaborationGroup;
  return isCollaborationBpmnProfileId(profileId)
    ? [...groupsWithAdvancedRouting, orientedCollaborationGroup]
    : groupsWithAdvancedRouting;
}

export function acknowledgedBpmnAuthoringProfile(
  profileId: BpmnProfileId,
  conditionalProfileAcknowledged: boolean,
  catchingEventsProfileAcknowledged = false,
  eventRoutingProfileAcknowledged = false,
  taskTypesProfileAcknowledged = false,
  intermediateEventsProfileAcknowledged = false,
  boundaryEventsProfileAcknowledged = false,
  activityContainersProfileAcknowledged = false,
  dataAuthoringProfileAcknowledged = false,
  complexRoutingProfileAcknowledged = false,
): BpmnProfileId {
  if (
    supportsComplexRouting(profileId) &&
    !complexRoutingProfileAcknowledged &&
    dataAuthoringProfileAcknowledged
  ) {
    return isCollaborationBpmnProfileId(profileId)
      ? collaborationDataAuthoringBpmnProfile.id
      : coreDataAuthoringBpmnProfile.id;
  }
  if (
    supportsDataAuthoring(profileId) &&
    !dataAuthoringProfileAcknowledged &&
    activityContainersProfileAcknowledged
  ) {
    return isCollaborationBpmnProfileId(profileId)
      ? collaborationActivityContainersBpmnProfile.id
      : coreActivityContainersBpmnProfile.id;
  }
  if (
    supportsActivityContainers(profileId) &&
    !activityContainersProfileAcknowledged &&
    boundaryEventsProfileAcknowledged
  ) {
    return isCollaborationBpmnProfileId(profileId)
      ? collaborationFullAuthoringBpmnProfile.id
      : coreFullAuthoringBpmnProfile.id;
  }
  if (supportsBoundaryEvents(profileId) && !boundaryEventsProfileAcknowledged) {
    if (intermediateEventsProfileAcknowledged) {
      return isCollaborationBpmnProfileId(profileId)
        ? collaborationIntermediateEventsBpmnProfile.id
        : coreIntermediateEventsBpmnProfile.id;
    }
  }
  if (
    supportsIntermediateEvents(profileId) &&
    !intermediateEventsProfileAcknowledged
  ) {
    if (taskTypesProfileAcknowledged) {
      return isCollaborationBpmnProfileId(profileId)
        ? collaborationTaskTypesBpmnProfile.id
        : coreTaskTypesBpmnProfile.id;
    }
  }
  if (supportsTaskTypes(profileId) && !taskTypesProfileAcknowledged) {
    if (eventRoutingProfileAcknowledged) {
      return isCollaborationBpmnProfileId(profileId)
        ? collaborationEventRoutingBpmnProfile.id
        : coreEventRoutingBpmnProfile.id;
    }
  }
  if (supportsEventRouting(profileId) && !eventRoutingProfileAcknowledged) {
    if (catchingEventsProfileAcknowledged) {
      return isCollaborationBpmnProfileId(profileId)
        ? collaborationCatchingEventsBpmnProfile.id
        : coreCatchingEventsBpmnProfile.id;
    }
    return isCollaborationBpmnProfileId(profileId)
      ? conditionalProfileAcknowledged
        ? collaborationConditionalBpmnProfile.id
        : collaborationStructuredBpmnProfile.id
      : conditionalProfileAcknowledged
        ? coreConditionalBpmnProfile.id
        : coreStructuredBpmnProfile.id;
  }
  if (supportsCatchingEvents(profileId) && !catchingEventsProfileAcknowledged) {
    return isCollaborationBpmnProfileId(profileId)
      ? conditionalProfileAcknowledged
        ? collaborationConditionalBpmnProfile.id
        : collaborationStructuredBpmnProfile.id
      : conditionalProfileAcknowledged
        ? coreConditionalBpmnProfile.id
        : coreStructuredBpmnProfile.id;
  }
  if (
    supportsConditionalRouting(profileId) &&
    !conditionalProfileAcknowledged
  ) {
    return isCollaborationBpmnProfileId(profileId)
      ? collaborationStructuredBpmnProfile.id
      : coreStructuredBpmnProfile.id;
  }
  return profileId;
}

export interface BpmnAppendAction {
  readonly id:
    | "task"
    | "exclusive-gateway"
    | "parallel-gateway"
    | "inclusive-gateway"
    | "message-catch-event"
    | "timer-catch-event"
    | "receive-task"
    | "user-task"
    | "service-task"
    | "manual-task"
    | "none-throw-event"
    | "message-throw-event"
    | "event-based-gateway"
    | "end-event";
  readonly type:
    | "bpmn:Task"
    | "bpmn:ExclusiveGateway"
    | "bpmn:ParallelGateway"
    | "bpmn:InclusiveGateway"
    | "bpmn:IntermediateCatchEvent"
    | "bpmn:ReceiveTask"
    | "bpmn:UserTask"
    | "bpmn:ServiceTask"
    | "bpmn:ManualTask"
    | "bpmn:IntermediateThrowEvent"
    | "bpmn:EventBasedGateway"
    | "bpmn:EndEvent";
  readonly recipe: BpmnShapeCreationRecipe;
  readonly label: string;
  readonly hint: string;
}

export function bpmnAppendActions(
  profileId: BpmnProfileId,
): readonly BpmnAppendAction[] {
  const actions: BpmnAppendAction[] = [
    {
      id: "task",
      type: "bpmn:Task",
      recipe: { kind: "plain" },
      label: "Công việc",
      hint: "Thêm một bước cần thực hiện.",
    },
    {
      id: "exclusive-gateway",
      type: "bpmn:ExclusiveGateway",
      recipe: { kind: "plain" },
      label: "Chọn một hướng",
      hint: "Chỉ một nhánh phù hợp được đi tiếp.",
    },
  ];
  if (supportsStructuredRouting(profileId)) {
    actions.push({
      id: "parallel-gateway",
      type: "bpmn:ParallelGateway",
      recipe: { kind: "plain" },
      label: "Chạy song song",
      hint: "Tất cả các nhánh cùng được bắt đầu.",
    });
  }
  if (supportsConditionalRouting(profileId)) {
    actions.push({
      id: "inclusive-gateway",
      type: "bpmn:InclusiveGateway",
      recipe: { kind: "plain" },
      label: "Chọn một hoặc nhiều hướng",
      hint: "Một hoặc nhiều nhánh phù hợp có thể cùng được đi tiếp.",
    });
  }
  if (supportsCatchingEvents(profileId)) {
    actions.push(
      {
        id: "message-catch-event",
        type: "bpmn:IntermediateCatchEvent",
        recipe: messageCatchEventItem.recipe,
        label: "Chờ thông điệp",
        hint: "Tạm dừng cho đến khi nhận được thông điệp.",
      },
      {
        id: "timer-catch-event",
        type: "bpmn:IntermediateCatchEvent",
        recipe: timerCatchEventItem.recipe,
        label: "Chờ thời điểm",
        hint: "Tạm dừng đến một thời điểm hoặc hết khoảng chờ.",
      },
      {
        id: "receive-task",
        type: "bpmn:ReceiveTask",
        recipe: receiveTaskItem.recipe,
        label: "Nhận thông điệp",
        hint: "Hoàn tất sau khi nhận được thông điệp.",
      },
    );
  }
  if (supportsEventRouting(profileId)) {
    actions.push({
      id: "event-based-gateway",
      type: "bpmn:EventBasedGateway",
      recipe: eventBasedGatewayItem.recipe,
      label: "Chờ sự kiện đầu tiên",
      hint: "Sự kiện đến trước quyết định nhánh đi tiếp.",
    });
  }
  if (supportsTaskTypes(profileId)) {
    for (const item of taskTypeItems) {
      actions.push({
        id: item.id,
        type: item.type,
        recipe: item.recipe,
        label: item.label,
        hint: item.hint,
      });
    }
  }
  if (supportsIntermediateEvents(profileId)) {
    for (const item of intermediateThrowItems) {
      actions.push({
        id: item.id,
        type: item.type,
        recipe: item.recipe,
        label: item.label,
        hint: item.hint,
      });
    }
  }
  actions.push({
    id: "end-event",
    type: "bpmn:EndEvent",
    recipe: { kind: "plain" },
    label: "Điểm kết thúc",
    hint: "Kết thúc nhánh công việc này.",
  });
  return actions;
}

export function bpmnBoundaryAttachActions(
  profileId: BpmnProfileId,
  host?: { readonly type: string; readonly triggeredByEvent?: boolean },
): readonly BpmnShapeLibraryItem[] {
  if (host?.type === "bpmn:SubProcess") {
    return supportsSubprocessTimers(profileId) && !host.triggeredByEvent
      ? boundaryEventItems.filter((item) => item.id === "timer-boundary-event")
      : [];
  }
  return supportsBoundaryEvents(profileId) ? boundaryEventItems : [];
}

export function normalizeLibraryQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

export function filterBpmnNodeLibrary(
  groups: readonly BpmnLibraryGroup[],
  query: string,
): readonly BpmnLibraryGroup[] {
  const normalizedQuery = normalizeLibraryQuery(query);
  if (!normalizedQuery) return groups;

  return groups.flatMap((group) => {
    const items = group.items.filter((item) =>
      normalizeLibraryQuery(
        [item.label, item.hint, group.label, ...item.aliases].join(" "),
      ).includes(normalizedQuery),
    );
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}
