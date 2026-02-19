import { logger } from './logger';
import { Platform } from 'react-native';

const MODULE = 'CRASH_HANDLER';

export function setupCrashHandler(): void {
  logger.info(MODULE, 'Installing crash handlers', { platform: Platform.OS });

  if (typeof ErrorUtils !== 'undefined') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      logger.fatal(MODULE, 'Unhandled JS exception', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 1000),
        isFatal,
        breadcrumbCount: logger.getBreadcrumbs().length,
        lastBreadcrumbs: logger.getBreadcrumbs().slice(-5).map((b) => ({
          timestamp: b.timestamp,
          level: b.levelName,
          module: b.module,
          action: b.action,
        })),
      });
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  if (typeof global !== 'undefined') {
    (global as any).onunhandledrejection = (event: any) => {
      const reason = event?.reason || event;
      logger.error(MODULE, 'Unhandled promise rejection', {
        reason: reason?.message || String(reason),
        stack: reason?.stack?.substring(0, 500),
      });
    };
  }

  logger.info(MODULE, 'Crash handlers installed successfully');
}
