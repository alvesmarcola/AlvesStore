const MIME_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10",
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).join(",") === "82,73,70,70"
    && bytes.subarray(8, 12).join(",") === "87,69,66,80",
};

export async function isValidProductImage(file: File) {
  const matchesSignature = MIME_SIGNATURES[file.type];
  if (!matchesSignature || file.size === 0 || file.size > 10 * 1024 * 1024) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return matchesSignature(bytes);
}
