export interface BrandingConfig {
  readonly websiteUrl: string;
  readonly githubUrl: string;
}

export function loadBranding(source: Record<string, string | undefined> = Bun.env): BrandingConfig {
  return {
    websiteUrl: source.BEARTRAP_WEBSITE_URL ?? "https://beartrap.app",
    githubUrl: source.BEARTRAP_GITHUB_URL ?? "https://github.com/shaiqie/Beartrap"
  };
}
