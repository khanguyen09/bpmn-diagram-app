import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import {
  createBpmnModelViaApi,
  findBpmnLauncherTool,
  readBpmnDraft,
  waitForBpmnDraftAcknowledgement,
} from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const titlePrefix = "E2E Conditional Routing ";
const createdModelIds: string[] = [];
let durableConditionalModelId: string | undefined;

async function createStructuredModel(page: Page, suffix: string) {
  const created = await createBpmnModelViaApi(page, {
    title: `${titlePrefix}${suffix} ${Date.now()}`,
    description: "Conditional Routing browser proof",
    purpose: "TO_BE",
    profileId: "teb-core-structured@1",
    xml: starterBpmnXml,
    idempotencyKey: `e2e-conditional:${suffix}:${Date.now()}`,
  });
  createdModelIds.push(created.modelId);
  await page.goto(`/studio/diagram/${created.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return created.modelId;
}

async function openInspector(
  page: Page,
  view: "edit" | "structure",
) {
  await openBpmnInspectorView(page, view);
}

async function selectOutlineItem(page: Page, name: string) {
  await openInspector(page, "structure");
  await page
    .locator(".bpmn-studio__inspector .bpmn-outline button")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
}

test.describe.serial("BPMN Conditional Routing", () => {
  test.afterAll(async () => {
    await cleanupExactProcessModels(createdModelIds, titlePrefix);
  });

  test("Structured upgrades only after ACK, then Inclusive and conditional defaults round-trip", async ({
    page,
  }, testInfo) => {
    const modelId = await createStructuredModel(page, "desktop");
    durableConditionalModelId = modelId;
    const preparedInclusive = await findBpmnLauncherTool(page, {
      toolId: "inclusive-gateway",
      query: "nhiều hướng",
      preparation: "ordered-profile-ack",
    });
    await expect(preparedInclusive).toBeEnabled();
    await expect(
      await findBpmnLauncherTool(page, {
        toolId: "event-based-gateway",
        query: "sự kiện đến trước",
        preparation: "ordered-profile-ack",
      }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");

    await selectOutlineItem(page, "Chưa");
    await openInspector(page, "edit");
    await expect(page.locator(".bpmn-routing-editor textarea")).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Đặt làm nhánh mặc định" }),
    ).toHaveCount(0);

    const shapes = page.locator(".bpmn-modeler .djs-shape");
    const shapeCountBeforeInclusive = await shapes.count();
    const inclusive = await findBpmnLauncherTool(page, {
      toolId: "inclusive-gateway",
      query: "nhiều hướng",
      preparation: "ordered-profile-ack",
    });
    await inclusive.focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await readBpmnDraft(page, modelId)).profileId)
      .toBe("teb-core-conditional@1");
    await expect(shapes).toHaveCount(shapeCountBeforeInclusive + 1);
    const createdInclusive = page.locator(".bpmn-modeler .djs-shape.selected");
    const inclusiveId = await createdInclusive.getAttribute("data-element-id");
    expect(inclusiveId).toBeTruthy();

    await selectOutlineItem(page, "Chưa");
    await openInspector(page, "edit");
    const condition = page.locator(".bpmn-routing-editor textarea");
    await condition.fill("Cần bổ sung bằng chứng");
    await waitForBpmnDraftAcknowledgement(page, modelId, () =>
      page.getByRole("button", { name: "Áp dụng điều kiện" }).click(),
    );
    await expect
      .poll(async () => (await readBpmnDraft(page, modelId)).canonicalXml)
      .toMatch(
        /<bpmn:sequenceFlow[^>]+id="Flow_Revise"[\s\S]*?<bpmn:conditionExpression[^>]*>Cần bổ sung bằng chứng<\/bpmn:conditionExpression>/,
      );
    await expect(condition).toHaveValue("Cần bổ sung bằng chứng");

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(condition).toHaveValue("");
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(condition).toHaveValue("Cần bổ sung bằng chứng");

    await selectOutlineItem(page, "Có");
    await openInspector(page, "edit");
    const defaultBranch = page.getByRole("checkbox", {
      name: "Đặt làm nhánh mặc định",
    });
    await defaultBranch.check();
    await waitForBpmnDraftAcknowledgement(page, modelId, () =>
      page.getByRole("button", { name: "Áp dụng điều kiện" }).click(),
    );
    await expect
      .poll(async () => (await readBpmnDraft(page, modelId)).canonicalXml)
      .toMatch(
        /<bpmn:exclusiveGateway[^>]+id="Gateway_Ready"[^>]+default="Flow_Ready_Publish"/,
      );
    await expect(defaultBranch).toBeChecked();

    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(defaultBranch).not.toBeChecked();
    await page.getByRole("button", { name: "Làm lại" }).click();
    await expect(defaultBranch).toBeChecked();
    await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const persistedResponse = await page.request.get(
      `/api/v1/studio/process-models/${modelId}/draft`,
    );
    expect(persistedResponse.ok()).toBe(true);
    const persisted = (await persistedResponse.json()) as {
      profileId: string;
      canonicalXml: string;
    };
    expect(persisted.profileId).toBe("teb-core-conditional@1");
    expect(persisted.canonicalXml).toContain("<bpmn:inclusiveGateway");
    expect(persisted.canonicalXml).toMatch(
      /<bpmn:exclusiveGateway[^>]+id="Gateway_Ready"[^>]+default="Flow_Ready_Publish"/,
    );
    expect(persisted.canonicalXml).toMatch(
      /<bpmn:sequenceFlow[^>]+id="Flow_Revise"[\s\S]*?<bpmn:conditionExpression[^>]*>Cần bổ sung bằng chứng<\/bpmn:conditionExpression>/,
    );
    await testInfo.attach("conditional-routing-canonical.xml", {
      body: persisted.canonicalXml,
      contentType: "application/xml",
    });

    await page.reload();
    expect((await readBpmnDraft(page, modelId)).profileId).toBe(
      "teb-core-conditional@1",
    );
    await expect(
      page.locator(
        `.bpmn-modeler .djs-shape[data-element-id="${inclusiveId}"]`,
      ),
    ).toHaveCount(1);
    await selectOutlineItem(page, "Chưa");
    await openInspector(page, "edit");
    await expect(page.locator(".bpmn-routing-editor textarea")).toHaveValue(
      "Cần bổ sung bằng chứng",
    );
    await selectOutlineItem(page, "Có");
    await openInspector(page, "edit");
    await expect(
      page.getByRole("checkbox", { name: "Đặt làm nhánh mặc định" }),
    ).toBeChecked();

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("conditional-routing-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });

  test("@mobile remains viewer-first for a durable Conditional model", async ({
    page,
  }, testInfo) => {
    expect(durableConditionalModelId).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/studio/diagram/${durableConditionalModelId}`);

    await expect(
      page.getByText("Chế độ xem trên màn hình nhỏ", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Chọn thành phần" })).toBeHidden();
    await expect(page.getByTestId("bpmn-modeler")).toBeHidden();
    await expect(page.locator(".bpmn-routing-editor textarea")).toHaveCount(0);
    await expect(
      page.getByRole("checkbox", { name: "Đặt làm nhánh mặc định" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".bpmn-mobile-outline-shell.bpmn-outline"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("conditional-routing-mobile-axe.json", {
      body: JSON.stringify(accessibility, null, 2),
      contentType: "application/json",
    });
    expect(accessibility.violations).toEqual([]);
  });
});
