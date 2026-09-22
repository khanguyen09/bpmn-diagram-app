import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isSafePublicBpmnXml } from "./server";
import { starterBpmnXml } from "./infrastructure/bpmn-io/starter-model";
it("UC83.2 reuses safe persistence XML checks without requiring workflow completeness", async () => {
  expect(await isSafePublicBpmnXml(starterBpmnXml, "teb-core-starter@1")).toBe(true);
  expect(await isSafePublicBpmnXml('<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///etc/passwd">]><x>&ext;</x>', "teb-core-starter@1")).toBe(false);
  expect(await isSafePublicBpmnXml(starterBpmnXml, "unknown")).toBe(false);
});
