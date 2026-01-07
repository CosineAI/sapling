/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {getRuntimeConfig} from './runtimeConfig';
import React, {Suspense} from 'react';

const DefaultLoginDialog = React.lazy(() => import('./DefaultLoginDialog'));
const NetlifyLoginDialog = React.lazy(() => import('./NetlifyLoginDialog'));
const OAuthLoginDialog = React.lazy(() => import('./OAuthLoginDialog'));

export default function LazyLoginDialog({
  setTokenAndHostname,
}: {
  setTokenAndHostname: (token: string, hostname: string) => void;
}) {
  const config = getRuntimeConfig();
  const {hostname} = window.location;
  let LoginComponent = DefaultLoginDialog;

  if (config.auth?.mode === 'oauth') {
    LoginComponent = OAuthLoginDialog;
  } else if (config.auth?.mode === 'netlify') {
    LoginComponent = NetlifyLoginDialog;
  } else if (config.auth?.mode === 'pat') {
    LoginComponent = DefaultLoginDialog;
  } else if (hostname === 'reviewstack.netlify.app' || hostname === 'reviewstack.dev') {
    LoginComponent = NetlifyLoginDialog;
  }

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <LoginComponent setTokenAndHostname={setTokenAndHostname} />
      </Suspense>
    </div>
  );
}
