/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ChangeEvent, FormEvent} from 'react';
import type {CustomLoginDialogProps} from 'reviewstack/src/LoginDialog';

import Footer from './Footer';
import {getRuntimeConfig} from './runtimeConfig';
import {Box, Button, Heading, Text, TextInput} from '@primer/react';
import React, {useCallback, useMemo, useState} from 'react';
import AppHeader from 'reviewstack/src/AppHeader';

export default function OAuthLoginDialog(props: CustomLoginDialogProps): React.ReactElement {
  const config = getRuntimeConfig();
  const hostname = config.auth?.hostname ?? 'github.com';
  const allowPatFallback = config.auth?.allowPatFallback ?? true;

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <Box flex="0 0 auto">
        <AppHeader orgAndRepo={null} />
      </Box>
      <Box flex="1 1 auto" overflowY="auto">
        <Box paddingX={3} paddingY={2} maxWidth={900}>
          <Heading>Welcome to ReviewStack</Heading>
          <OAuthButton hostname={hostname} {...props} />
          {allowPatFallback ? <PatFallback hostname={hostname} {...props} /> : null}
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

function PatFallback({
  setTokenAndHostname,
  hostname,
}: CustomLoginDialogProps & {hostname: string}): React.ReactElement {
  const [patHostname, setHostname] = useState(hostname);
  const [token, setToken] = useState('');

  const onChangeHostname = useCallback(
    (e: ChangeEvent) => setHostname((e.target as HTMLInputElement).value),
    [],
  );
  const onChangeToken = useCallback(
    (e: ChangeEvent) => setToken((e.target as HTMLInputElement).value),
    [],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setTokenAndHostname(token.trim(), patHostname.trim());
      return false;
    },
    [token, patHostname, setTokenAndHostname],
  );

  const isInputValid = useMemo(() => {
    if (token.trim() === '') {
      return false;
    }
    const normalizedHostname = patHostname.trim();
    return normalizedHostname !== '' && normalizedHostname.indexOf('.') !== -1;
  }, [patHostname, token]);

  return (
    <Box>
      <Heading as="h3" sx={{fontSize: 3, mb: 2}}>
        Use a Personal Access Token
      </Heading>
      <Text as="p" pb={2}>
        If you prefer, you can provide a GitHub Personal Access Token (PAT) instead of OAuth.
      </Text>
      <form onSubmit={onSubmit}>
        <Box pb={2}>
          GitHub Hostname: <br />
          <TextInput
            value={patHostname}
            onChange={onChangeHostname}
            sx={{width: '400px'}}
            monospace
            aria-label="hostname"
            placeholder="github.com"
          />
        </Box>
        <Box pb={2}>
          Personal Access Token: <br />
          <TextInput
            value={token}
            onChange={onChangeToken}
            type="password"
            sx={{width: '400px'}}
            monospace
            aria-label="personal access token"
            placeholder="github_pat_abcdefg123456789"
          />
        </Box>
        <Box paddingY={2}>
          <Button disabled={!isInputValid} type="submit">
            Use Personal Access Token
          </Button>
        </Box>
      </form>
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
        popup.close();
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
