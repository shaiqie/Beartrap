export interface ScrapeTelemetryEvent {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly observedAt: number;
  readonly source: string;
}

export class ScrapeTelemetryService {
  private readonly events: ScrapeTelemetryEvent[] = [];

  public record(event: ScrapeTelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > 1_000) {
      this.events.splice(0, this.events.length - 1_000);
    }
  }

  public recentForUser(guildId: string, userId: string, sinceMs: number): ScrapeTelemetryEvent[] {
    return this.events.filter(
      (event) => event.guildId === guildId && event.userId === userId && event.observedAt >= sinceMs
    );
  }
}
