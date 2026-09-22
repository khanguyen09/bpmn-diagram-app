import { expect, test, type Page } from "@playwright/test";
import { BpmnModdle } from "bpmn-moddle";
import { starterBpmnXml } from "../../../modules/process-modeling/infrastructure/bpmn-io/starter-model";
import { createBpmnModelViaApi, readBpmnDraft, assertNoDocumentHorizontalOverflow } from "./authoring-helpers";
import { openBpmnInspectorView } from "./inspector-navigation";
import { cleanupExactProcessModels } from "./process-model-cleanup";

const prefix = "E2E SDD57 Presentation ";
const ids: string[] = [];
async function openModel(page: Page, parallel = false) {
  const xml = parallel ? starterBpmnXml.replaceAll("exclusiveGateway", "parallelGateway") : starterBpmnXml;
  const model = await createBpmnModelViaApi(page, {
    title: `${prefix}${Date.now()}`, description: "Isolated presentation proof", purpose: "REFERENCE",
    profileId: "teb-core-full-authoring@1", xml, idempotencyKey: `sdd57-${Date.now()}`,
  });
  ids.push(model.modelId);
  await page.goto(`/studio/diagram/${model.modelId}`);
  await expect(page.getByText("Đã lưu máy chủ", { exact: true })).toBeVisible();
  return model.modelId;
}
async function select(page: Page, id: string) {
  await page.locator(`.djs-shape[data-element-id="${id}"]`).click();
  await openBpmnInspectorView(page, "edit");
}
async function geometry(xml: string) {
  const parsed = await new BpmnModdle().fromXML(xml);
  const plane = (parsed.rootElement as unknown as { diagrams: {plane: {planeElement: {id: string; bounds?: {x:number;y:number;width:number;height:number}; waypoint?: {x:number;y:number}[]}[]}}[] }).diagrams[0].plane;
  return plane.planeElement.map(e => ({id:e.id, ...(e.bounds ? {bounds: {x:e.bounds.x,y:e.bounds.y,width:e.bounds.width,height:e.bounds.height}} : {waypoints:e.waypoint?.map(p=>({x:p.x,y:p.y}))})}));
}
test.afterAll(async () => { await cleanupExactProcessModels(ids, prefix); });

test("Be Vietnam Pro labels and expanded icon picker remain readable and persist selection", async ({page}) => {
  const id = await openModel(page);
  const labels = page.locator(".bpmn-modeler svg text");
  expect(await labels.count()).toBeGreaterThan(4);
  expect(await labels.evaluateAll(nodes => nodes.every(n => getComputedStyle(n).fontFamily.includes("Be Vietnam Pro")))).toBe(true);
  await select(page, "Task_Intake");
  await page.locator(".bpmn-inspector-disclosure > summary").filter({hasText:"Biểu tượng minh hoạ"}).click();
  const picker = page.locator(".bpmn-node-icon-picker");
  await expect(picker.getByRole("button", {name:/^Chọn biểu tượng/})).toHaveCount(36);
  const cells = await picker.locator(".bpmn-node-icon-grid > button").evaluateAll(nodes => nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
  expect(Math.max(...cells.map(c=>c.w))-Math.min(...cells.map(c=>c.w))).toBeLessThan(1);
  expect(Math.max(...cells.map(c=>c.h))-Math.min(...cells.map(c=>c.h))).toBeLessThan(1);
  await picker.getByLabel("Tìm biểu tượng").fill("zzzzzz");
  await expect(picker.getByText("Không tìm thấy biểu tượng phù hợp.")).toBeVisible();
  await picker.getByRole("button", {name:"Xoá tìm kiếm"}).click();
  await picker.getByLabel("Tìm biểu tượng").fill("lich");
  await picker.getByRole("button", {name:"Chọn biểu tượng Lịch hẹn", exact:true}).click();
  await expect.poll(async () => (await readBpmnDraft(page,id)).canonicalXml).toContain('iconKey="calendar"');
  await page.reload();
  await expect(page.getByText("Đã lưu máy chủ", {exact:true})).toBeVisible();
  await select(page,"Task_Intake");
  await page.locator(".bpmn-inspector-disclosure > summary").filter({hasText:"Biểu tượng minh hoạ"}).click();
  await expect(page.getByRole("button",{name:"Chọn biểu tượng Lịch hẹn",exact:true})).toHaveAttribute("aria-pressed","true");
  await assertNoDocumentHorizontalOverflow(page);
});

test("delete confirmation is centered, readable and cancellation does not change the diagram", async ({page}) => {
  const id = await openModel(page);
  const before = await readBpmnDraft(page,id);
  await select(page,"Task_Intake");
  await page.getByRole("button",{name:"Xoá phần tử",exact:true}).click();
  const dialog = page.getByRole("alertdialog",{name:"Xoá phần tử này?"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Huỷ",exact:true})).toBeFocused();
  for (const size of [{width:1280,height:900},{width:820,height:700}]) {
    await page.setViewportSize(size);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x+box!.width/2-size.width/2)).toBeLessThan(2);
    expect(box!.width).toBeLessThan(size.width);
    expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
  }
  await dialog.getByRole("button",{name:"Huỷ",exact:true}).click();
  await expect(dialog).toBeHidden();
  expect((await readBpmnDraft(page,id)).canonicalXml).toBe(before.canonicalXml);
});

for (const parallel of [false,true]) {
  test(`balances ${parallel ? "parallel" : "choice"} branches with a single undo and redo`,async({page})=>{
    const id = await openModel(page,parallel);
    const before = await readBpmnDraft(page,id);
    await select(page,"Gateway_Ready");
    await page.getByRole("button",{name:"Cân đối nhánh",exact:true}).click();
    await expect.poll(async()=>(await readBpmnDraft(page,id)).revisionToken).not.toBe(before.revisionToken);
    const after = await readBpmnDraft(page,id);
    expect(await geometry(after.canonicalXml)).not.toEqual(await geometry(before.canonicalXml));
    expect(after.canonicalXml.split("<bpmndi:BPMNDiagram")[0]).toBe(before.canonicalXml.split("<bpmndi:BPMNDiagram")[0]);
    const laidOut = await geometry(after.canonicalXml);
    const upper = laidOut.find(e=>e.id === "Shape_Publish")!;
    const lower = laidOut.find(e=>e.id === "Shape_Revise")!;
    const gateway = laidOut.find(e=>e.id === "Shape_Gateway")!;
    if (!("bounds" in upper) || !("bounds" in lower) || !("bounds" in gateway)) throw new Error("Expected shape bounds");
    expect(upper.bounds.x).toBe(lower.bounds.x);
    expect((upper.bounds.y+upper.bounds.height/2+lower.bounds.y+lower.bounds.height/2)/2).toBe(gateway.bounds.y+gateway.bounds.height/2);
    const shapes = await page.locator('.djs-shape[data-element-id="Task_Publish"], .djs-shape[data-element-id="Task_Revise"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute("transform")));
    expect(shapes).toHaveLength(2);
    await page.getByRole("button",{name:"Hoàn tác",exact:true}).click();
    await expect.poll(async()=>geometry((await readBpmnDraft(page,id)).canonicalXml)).toEqual(await geometry(before.canonicalXml));
    await page.getByRole("button",{name:"Làm lại",exact:true}).click();
    await expect.poll(async()=>geometry((await readBpmnDraft(page,id)).canonicalXml)).toEqual(await geometry(after.canonicalXml));
  });
}
