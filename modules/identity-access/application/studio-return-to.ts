export const defaultStudioReturnTo = "/studio/diagram";

const returnToBaseUrl = "https://studio-return.invalid";
const maximumDecodePasses = 5;
const unsafeCharacters = /[\u0000-\u001f\u007f-\u009f\\]/;

function isAllowedStudioLocation(value: string): boolean {
  if (unsafeCharacters.test(value) || value.startsWith("//")) return false;

  let location: URL;
  try {
    location = new URL(value, returnToBaseUrl);
  } catch {
    return false;
  }

  if (location.origin !== returnToBaseUrl) return false;

  const { pathname } = location;
  return (
    (pathname === "/studio/diagram" ||
      /^\/studio\/diagram\/[0-9a-f-]{36}\/?$/i.test(pathname) ||
      pathname === "/studio/profile")
  );
}

export function resolveStudioReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value) return defaultStudioReturnTo;

  let decoded = value;
  for (let pass = 0; pass <= maximumDecodePasses; pass += 1) {
    if (!isAllowedStudioLocation(decoded)) return defaultStudioReturnTo;

    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return defaultStudioReturnTo;
    }

    if (next === decoded) return value;
    if (pass === maximumDecodePasses) return defaultStudioReturnTo;
    decoded = next;
  }

  return defaultStudioReturnTo;
}
