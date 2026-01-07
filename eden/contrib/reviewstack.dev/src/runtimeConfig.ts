export type ReviewStackAuthMode = 'pat' | 'netlify' | 'oauth';

export type ReviewStackOAuthConfig = {
  authorizeUrl?: string;
  clientId?: string;
  scope?: string;
  provider?: string;
  extraParams?: Record<string, string>;
  tokenParam?: string;
  errorParam?: string;
  callbackPath?: string;
};

export type ReviewStackAuthConfig = {
  mode?: ReviewStackAuthMode;
  hostname?: string;
  allowPatFallback?: boolean;
  oauth?: ReviewStackOAuthConfig;
};

export type ReviewStackConfig = {
  auth?: ReviewStackAuthConfig;
};

const DEFAULT_AUTH: ReviewStackAuthConfig = {
  hostname: 'github.com',
  allowPatFallback: true,
  oauth: {
    scope: 'user repo',
    tokenParam: 'token',
    errorParam: 'error',
    callbackPath: '/oauth-callback.html',
  },
};

const DEFAULT_CONFIG: ReviewStackConfig = {
  auth: DEFAULT_AUTH,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getRuntimeConfig(): ReviewStackConfig {
  const raw = (window as {REVIEWSTACK_CONFIG?: unknown}).REVIEWSTACK_CONFIG;
  if (!isRecord(raw)) {
    return DEFAULT_CONFIG;
  }

  const rawAuth = isRecord(raw.auth) ? raw.auth : {};
  const rawOAuth = isRecord(rawAuth.oauth) ? rawAuth.oauth : {};

  return {
    auth: {
      ...DEFAULT_AUTH,
      ...rawAuth,
      oauth: {
        ...(DEFAULT_AUTH.oauth ?? {}),
        ...rawOAuth,
      },
    },
  };
}
