import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModalDialog } from "./modal-dialog";

describe("ModalDialog", () => {
  it("keeps native dialog semantics and a shared centered surface hook", () => {
    const html = renderToStaticMarkup(createElement(
      ModalDialog,
      {
        open: true,
        onRequestClose: () => undefined,
        "aria-labelledby": "dialog-title",
      },
      createElement("h2", { id: "dialog-title" }, "Xác nhận"),
    ));

    expect(html).toContain("<dialog");
    expect(html).toContain('class="modal-dialog"');
    expect(html).toContain('aria-labelledby="dialog-title"');
  });
});
