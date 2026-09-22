export const inspectorViews = [
  "properties",
  "structure",
  "model",
  "navigation",
  "versions",
] as const;

export type InspectorView = (typeof inspectorViews)[number];

export const inspectorPrimaryViews = ["edit", "diagram", "check"] as const;

export type InspectorPrimaryView = (typeof inspectorPrimaryViews)[number];

export interface InspectorPrimaryViewProjection {
  readonly id: InspectorPrimaryView;
  readonly label: string;
  readonly logicalViews: readonly InspectorView[];
  readonly defaultView: InspectorView;
  readonly secondaryLabels: Readonly<Partial<Record<InspectorView, string>>>;
}

/**
 * A compact navigation projection over the existing logical views. It does
 * not replace or rename persisted view IDs, so existing inspector state and
 * keyboard behavior remain compatible.
 */
export const inspectorPrimaryViewProjection: readonly InspectorPrimaryViewProjection[] =
  [
    {
      id: "edit",
      label: "Chỉnh sửa",
      logicalViews: ["properties"],
      defaultView: "properties",
      secondaryLabels: {},
    },
    {
      id: "diagram",
      label: "Sơ đồ",
      logicalViews: ["model", "structure", "versions"],
      defaultView: "model",
      secondaryLabels: {
        model: "Thông tin chung",
        structure: "Danh sách bước",
        versions: "Bản lưu",
      },
    },
    {
      id: "check",
      label: "Kiểm tra",
      logicalViews: ["navigation"],
      defaultView: "navigation",
      secondaryLabels: {},
    },
  ];

export function primaryInspectorViewFor(
  view: InspectorView,
): InspectorPrimaryView {
  const projection = inspectorPrimaryViewProjection.find((candidate) =>
    candidate.logicalViews.includes(view),
  );
  if (!projection) {
    throw new Error(
      `Inspector view is missing from the primary projection: ${view}`,
    );
  }
  return projection.id;
}

export function inspectorViewForPrimary(
  primaryView: InspectorPrimaryView,
  currentView?: InspectorView,
): InspectorView {
  const projection = inspectorPrimaryViewProjection.find(
    (candidate) => candidate.id === primaryView,
  );
  if (!projection) {
    throw new Error(`Unknown primary inspector view: ${primaryView}`);
  }
  if (currentView && projection.logicalViews.includes(currentView)) {
    return currentView;
  }
  return projection.defaultView;
}

export interface InspectorSecondaryView {
  readonly view: InspectorView;
  readonly label: string;
}

export function secondaryInspectorViewsFor(
  primaryView: InspectorPrimaryView,
): readonly InspectorSecondaryView[] {
  const projection = inspectorPrimaryViewProjection.find(
    (candidate) => candidate.id === primaryView,
  );
  if (!projection) return [];
  return projection.logicalViews.flatMap((view) => {
    const label = projection.secondaryLabels[view];
    return label ? [{ view, label }] : [];
  });
}

export function nextInspectorPrimaryView(
  current: InspectorPrimaryView,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
): InspectorPrimaryView {
  if (key === "Home") return inspectorPrimaryViews[0];
  if (key === "End") {
    return inspectorPrimaryViews[inspectorPrimaryViews.length - 1];
  }
  const currentIndex = inspectorPrimaryViews.indexOf(current);
  const offset = key === "ArrowRight" ? 1 : -1;
  return inspectorPrimaryViews[
    (currentIndex + offset + inspectorPrimaryViews.length) %
      inspectorPrimaryViews.length
  ];
}

export function nextInspectorView(
  current: InspectorView,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
): InspectorView {
  if (key === "Home") return inspectorViews[0];
  if (key === "End") return inspectorViews[inspectorViews.length - 1];
  const currentIndex = inspectorViews.indexOf(current);
  const offset = key === "ArrowRight" ? 1 : -1;
  return inspectorViews[
    (currentIndex + offset + inspectorViews.length) % inspectorViews.length
  ];
}
