export interface LogContext {
  readonly [key: string]: unknown;
}

function serializeContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return "";
  return ` ${JSON.stringify(context, (_, value) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    return value;
  })}`;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(`[info] ${message}${serializeContext(context)}`);
  },

  warn(message: string, context?: LogContext): void {
    console.warn(`[warn] ${message}${serializeContext(context)}`);
  },

  error(message: string, context?: LogContext): void {
    console.error(`[error] ${message}${serializeContext(context)}`);
  }
};
