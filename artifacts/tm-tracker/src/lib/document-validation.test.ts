import { expect, it } from "vitest";
import { validateStageDocument } from "./document-validation";

it("rejects a disguised document before it enters case storage", async () => {
  const disguised = new File(["<html><script>alert(1)</script></html>"], "notice.pdf", {
    type: "application/pdf",
  });
  await expect(validateStageDocument(disguised)).rejects.toThrow("contents do not match");
  const wrongExtension = new File(["%PDF-1.7"], "notice.html", {
    type: "application/pdf",
  });
  await expect(validateStageDocument(wrongExtension)).rejects.toThrow("extension does not match");
});

it("accepts a PDF whose extension, MIME and header agree", async () => {
  const pdf = new File(["%PDF-1.7\n"], "notice.pdf", { type: "application/pdf" });
  await expect(validateStageDocument(pdf)).resolves.toBeUndefined();
});
