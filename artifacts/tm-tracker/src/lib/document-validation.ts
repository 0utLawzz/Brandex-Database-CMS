const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/msword": ["doc"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/plain": ["txt"],
};

export async function validateStageDocument(file: File): Promise<void> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions[file.type]?.includes(extension)) {
    throw new Error("File extension does not match its document type.");
  }
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ole = starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const zip = starts([0x50, 0x4b, 0x03, 0x04]);
  let valid = false;
  switch (file.type) {
    case "application/pdf": valid = starts([0x25, 0x50, 0x44, 0x46, 0x2d]); break;
    case "image/png": valid = starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case "image/jpeg": valid = starts([0xff, 0xd8, 0xff]); break;
    case "image/gif": valid = starts([0x47, 0x49, 0x46, 0x38]) && [0x37, 0x39].includes(bytes[4]) && bytes[5] === 0x61; break;
    case "image/webp": valid = starts([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50; break;
    case "application/msword":
    case "application/vnd.ms-excel": valid = ole; break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": valid = zip; break;
    case "text/plain": {
      const text = new TextDecoder().decode(bytes);
      valid = !bytes.includes(0) && !/^\s*<(?:!doctype\s+html|html|script|svg)\b/i.test(text);
      break;
    }
  }
  if (!valid) throw new Error("File contents do not match the selected document type.");
}
