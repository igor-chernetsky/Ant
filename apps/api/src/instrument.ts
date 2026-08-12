import * as Sentry from '@sentry/nestjs';
import {
  apiSentryDsn,
  apiSentryEnvironment,
  apiTracesSampleRate,
} from './sentry.shared';

Sentry.init({
  dsn: apiSentryDsn(),
  enabled: Boolean(apiSentryDsn()),
  environment: apiSentryEnvironment(),
  tracesSampleRate: apiTracesSampleRate(),
  dataCollection: {
    // userInfo: false,
    // httpBodies: [],
  },
});