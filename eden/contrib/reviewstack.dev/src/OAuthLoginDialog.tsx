/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {CustomLoginDialogProps} from 'reviewstack/src/LoginDialog';

import Footer from './Footer';
import {getRuntimeConfig} from './runtimeConfig';
import {Box, Button, Heading, Text} from '@primer/react';
import React, {useCallback, useState} from 'react';
import AppHeader from 'reviewstack/src/AppHeader';

export default function OAuthLoginDialog(props: CustomLoginDialogProps): React.ReactElement {
  const config = getRuntimeConfig();
  const hostname = config.auth?.hostname ?? 'github.com';

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <Box flex="0 0 auto">
        <AppHeader orgAndRepo={null} />
      </Box>
      <Box flex="1 1 auto" overflowY="auto">
        <Box paddingX={3} paddingY={2} maxWidth={900}>
          <Heading>Welcome to ReviewStack</Heading>
          <OAuthButton hostname={hostname} {...props} />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function OAuthButton({
  setTokenAndHostname,
  hostname,
}: CustomLoginDialogProps & {hostname: string}): React.ReactElement {
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const config = getRuntimeConfig();

  const onClick = useCallback(async () => {
    setButtonDisabled(true);
    setErrorMessage(null);
    try {
      const token = await fetchOAuthToken(config);
      setTokenAndHostname(token, hostname);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'error fetching OAuth token';
      setErrorMessage(message);
    }
    setButtonDisabled(false);
  }, [config, hostname, setButtonDisabled, setErrorMessage, setTokenAndHostname]);

  return (
    <Box pb={4}>
      <Text as="p" pb={2}>
        Use OAuth to authorize ReviewStack to access your GitHub data. Your access token will be
        stored locally in the browser.
      </Text>
      {errorMessage != null ? (
        <Box pb={2}>
          <Text color="danger.fg">{errorMessage}</Text>
        </Box>
      ) : null}
      <Button onClick={onClick} disabled={isButtonDisabled}>
        Authorize with OAuth
      </Button>
    </Box>
  );
}

function fetchOAuthToken(config: ReturnType<typeof getRuntimeConfig>): Promise<string> {
  const oauth = config.auth?.oauth ?? {};
  const authorizeUrl = oauth.authorizeUrl;
  if (!authorizeUrl) {
    return Promise.reject(new Error('OAuth authorizeUrl is not configured'));
  }

  const state = generateState();
  const redirectPath = oauth.callbackPath ?? '/oauth-callback.html';
  const redirectUri = new URL(redirectPath, window.location.origin).toString();
  const url = new URL(authorizeUrl);

  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  if (oauth.clientId) {
    url.searchParams.set('client_id', oauth.clientId);
  }
  if (oauth.scope) {
    url.searchParams.set('scope', oauth.scope);
  }
  if (oauth.provider) {
    url.searchParams.set('provider', oauth.provider);
  }
  if (oauth.extraParams) {
    for (const [key, value] of Object.entries(oauth.extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return new Promise((resolve, reject) => {
    const popup = window.open(
      url.toString(),
      'reviewstack-oauth',
      'width=600,height=700',
    );
    if (!popup) {
      reject(new Error('OAuth popup was blocked'));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('OAuth timed out'));
    }, 5 * 60 * 1000);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as {
        type?: string;
        token?: string | null;
        error?: string | null;
        state?: string | null;
      };
      if (!data || data.type !== 'reviewstack.oauth') {
        return;
      }
      if (data.state && data.state !== state) {
        return;
      }
      cleanup();
      if (data.error) {
        reject(new Error(data.error));
      } else if (typeof data.token === 'string' && data.token.length > 0) {
        resolve(data.token);
      } else {
        reject(new Error('token missing in OAuth response'));
      }
    }

    function cleanup() {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
      try {
        if (popup) {
          popup.close();
        }
      } catch (e) {
        // Ignore cleanup failures.
      }
    }

    window.addEventListener('message', handleMessage);
  });
}

function generateState(): string {
  const buffer = new Uint8Array(16);
  window.crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
