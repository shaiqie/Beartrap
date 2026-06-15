const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[),.!?;:\]}]+$/;

export function extractUrls(content: string): string[] {
  const matches = content.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const raw of matches) {
    const cleaned = raw.replace(TRAILING_PUNCTUATION, "");
    if (cleaned.length === 0 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    urls.push(cleaned);
  }

  return urls;
}
