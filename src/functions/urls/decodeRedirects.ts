import type { RedirectFinding } from "../../types/Security";

const REDIRECT_PARAMS = [
  "url",
  "u",
  "redirect",
  "redirect_url",
  "redirect_uri",
  "target",
  "to",
  "next",
  "dest",
  "destination"
] as const;

function maybeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function decodeRedirects(urls: readonly string[]): RedirectFinding[] {
  const findings: RedirectFinding[] = [];

  for (const sourceUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      continue;
    }

    for (const parameter of REDIRECT_PARAMS) {
      const rawValue = parsed.searchParams.get(parameter);
      if (!rawValue) continue;

      const decodedTarget = maybeDecode(rawValue.trim());
      if (!isHttpUrl(decodedTarget)) continue;

      findings.push({
        sourceUrl,
        parameter,
        decodedTarget
      });
    }
  }

  return findings;
}
