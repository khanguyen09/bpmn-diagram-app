"use client";

import {
  ArrowRight,
  DatabaseZap,
  Link2,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import type { BpmnLibraryItem } from "./bpmn-node-library-catalogue";

type BpmnToolId = BpmnLibraryItem["id"];

type BpmnNativeIconVariant =
  | "boundary"
  | "horizontal-lanes"
  | "vertical-lanes"
  | "expanded-pool"
  | "collapsed-pool";

type BpmnToolPresentationDefinition =
  | {
      readonly kind: "native-bpmn";
      readonly key: string;
      readonly className: string;
      readonly variant?: BpmnNativeIconVariant;
    }
  | {
      readonly kind: "lucide";
      readonly key: string;
      readonly icon: LucideIcon;
    };

export const bpmnToolPresentationRegistry = {
  "sequence-flow": {
    kind: "lucide",
    key: "sequence-flow-arrow",
    icon: ArrowRight,
  },
  "message-flow": {
    kind: "lucide",
    key: "message-flow-mail",
    icon: Mail,
  },
  association: {
    kind: "lucide",
    key: "association-link",
    icon: Link2,
  },
  "data-association": {
    kind: "lucide",
    key: "data-association",
    icon: DatabaseZap,
  },
  "start-event": {
    kind: "native-bpmn",
    key: "start-event-none",
    className: "bpmn-icon-start-event-none",
  },
  task: {
    kind: "native-bpmn",
    key: "task-none",
    className: "bpmn-icon-task-none",
  },
  "exclusive-gateway": {
    kind: "native-bpmn",
    key: "gateway-exclusive",
    className: "bpmn-icon-gateway-xor",
  },
  "parallel-gateway": {
    kind: "native-bpmn",
    key: "gateway-parallel",
    className: "bpmn-icon-gateway-parallel",
  },
  "inclusive-gateway": {
    kind: "native-bpmn",
    key: "gateway-inclusive",
    className: "bpmn-icon-gateway-or",
  },
  "message-catch-event": {
    kind: "native-bpmn",
    key: "event-catch-message",
    className: "bpmn-icon-intermediate-event-catch-message",
  },
  "timer-catch-event": {
    kind: "native-bpmn",
    key: "event-catch-timer",
    className: "bpmn-icon-intermediate-event-catch-timer",
  },
  "receive-task": {
    kind: "native-bpmn",
    key: "task-receive",
    className: "bpmn-icon-receive-task",
  },
  "user-task": {
    kind: "native-bpmn",
    key: "task-user",
    className: "bpmn-icon-user-task",
  },
  "service-task": {
    kind: "native-bpmn",
    key: "task-service",
    className: "bpmn-icon-service-task",
  },
  "manual-task": {
    kind: "native-bpmn",
    key: "task-manual",
    className: "bpmn-icon-manual-task",
  },
  "none-throw-event": {
    kind: "native-bpmn",
    key: "event-throw-none",
    className: "bpmn-icon-intermediate-event-none",
  },
  "message-throw-event": {
    kind: "native-bpmn",
    key: "event-throw-message",
    className: "bpmn-icon-intermediate-event-throw-message",
  },
  "message-boundary-event": {
    kind: "native-bpmn",
    key: "event-boundary-message",
    className: "bpmn-icon-intermediate-event-catch-message",
    variant: "boundary",
  },
  "timer-boundary-event": {
    kind: "native-bpmn",
    key: "event-boundary-timer",
    className: "bpmn-icon-intermediate-event-catch-timer",
    variant: "boundary",
  },
  "event-based-gateway": {
    kind: "native-bpmn",
    key: "gateway-event-based",
    className: "bpmn-icon-gateway-eventbased",
  },
  "end-event": {
    kind: "native-bpmn",
    key: "end-event-none",
    className: "bpmn-icon-end-event-none",
  },
  "text-annotation": {
    kind: "native-bpmn",
    key: "text-annotation",
    className: "bpmn-icon-text-annotation",
  },
  group: {
    kind: "native-bpmn",
    key: "visual-group",
    className: "bpmn-icon-group",
  },
  "expanded-subprocess": {
    kind: "native-bpmn",
    key: "subprocess-expanded",
    className: "bpmn-icon-subprocess-expanded",
  },
  "call-activity": {
    kind: "native-bpmn",
    key: "call-activity",
    className: "bpmn-icon-call-activity",
  },
  "data-object": {
    kind: "native-bpmn",
    key: "data-object",
    className: "bpmn-icon-data-object",
  },
  "data-store": {
    kind: "native-bpmn",
    key: "data-store",
    className: "bpmn-icon-data-store",
  },
  "complex-gateway": {
    kind: "native-bpmn",
    key: "gateway-complex",
    className: "bpmn-icon-gateway-complex",
  },
  "horizontal-swimlane-frame": {
    kind: "native-bpmn",
    key: "swimlane-horizontal",
    className: "bpmn-icon-lane-divide-two",
    variant: "horizontal-lanes",
  },
  "vertical-swimlane-frame": {
    kind: "native-bpmn",
    key: "swimlane-vertical",
    className: "bpmn-icon-lane-divide-two",
    variant: "vertical-lanes",
  },
  "white-box-pool": {
    kind: "native-bpmn",
    key: "pool-expanded",
    className: "bpmn-icon-participant",
    variant: "expanded-pool",
  },
  "black-box-pool": {
    kind: "native-bpmn",
    key: "pool-collapsed",
    className: "bpmn-icon-participant",
    variant: "collapsed-pool",
  },
} as const satisfies Record<BpmnToolId, BpmnToolPresentationDefinition>;

export type BpmnToolPresentationKey =
  (typeof bpmnToolPresentationRegistry)[BpmnToolId]["key"];

export function bpmnToolPresentation(
  toolId: BpmnToolId,
): (typeof bpmnToolPresentationRegistry)[BpmnToolId] {
  return bpmnToolPresentationRegistry[toolId];
}

export function BpmnToolPresentationIcon({
  toolId,
  size = 20,
  className,
}: {
  readonly toolId: BpmnToolId;
  readonly size?: number;
  readonly className?: string;
}) {
  const presentation = bpmnToolPresentationRegistry[toolId];
  if (presentation.kind === "lucide") {
    const Icon = presentation.icon;
    return (
      <Icon
        className={cn("bpmn-tool-presentation-icon", className)}
        width={size}
        height={size}
        strokeWidth={1.5}
        aria-hidden="true"
        focusable="false"
        data-bpmn-tool-icon={presentation.key}
      />
    );
  }

  const variant = "variant" in presentation ? presentation.variant : undefined;
  return (
    <span
      className={cn(
        "bpmn-tool-presentation-icon",
        presentation.className,
        variant && `is-${variant}`,
        className,
      )}
      style={
        {
          "--bpmn-tool-icon-size": `${size}px`,
        } as CSSProperties
      }
      aria-hidden="true"
      data-bpmn-tool-icon={presentation.key}
    />
  );
}
