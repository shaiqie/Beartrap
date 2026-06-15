import { decodeRedirects } from "../../functions/urls/decodeRedirects";
import { extractUrls } from "../../functions/urls/extractUrls";
import type { LinkIntel } from "../../types/Security";

export class LinkIntelService {
  public analyze(content: string): LinkIntel {
    const urls = extractUrls(content);
    const hosts: string[] = [];
    const malformed: string[] = [];

    for (const url of urls) {
      try {
        const parsed = new URL(url);
        hosts.push(parsed.hostname.toLowerCase());
      } catch {
        malformed.push(url);
      }
    }

    return {
      urls,
      hosts: [...new Set(hosts)],
      redirects: decodeRedirects(urls),
      malformed
    };
  }
}
