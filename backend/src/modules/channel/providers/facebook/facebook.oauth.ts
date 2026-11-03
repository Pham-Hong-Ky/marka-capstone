import { createHmac } from 'node:crypto';
import env from '../../../../config/env.js';
import type { SocialAccount } from '../port/social-provider.port.js';
import {
  facebookGet,
  type FacebookAccountsResponse,
  type FacebookTokenResponse,
} from './facebook.graph.js';

const AUTH_DIALOG_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'read_insights',
];
const MAX_PAGES_FETCH = 500;

export const buildFacebookAuthorizationUrl = (state: string): string => {
  const url = new URL(AUTH_DIALOG_URL);
  url.searchParams.set('client_id', env.FACEBOOK_APP_ID);
  url.searchParams.set('redirect_uri', env.FACEBOOK_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(','));
  return url.toString();
};

export const exchangeCodeForToken = async (code: string): Promise<string> => {
  const response = await facebookGet<FacebookTokenResponse>('/oauth/access_token', {
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    redirect_uri: env.FACEBOOK_REDIRECT_URI,
    code,
  });

  return response.access_token;
};

export const exchangeForLongLivedToken = async (token: string): Promise<string> => {
  const response = await facebookGet<FacebookTokenResponse>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    fb_exchange_token: token,
  });

  return response.access_token;
};

export const fetchManagedPages = async (userToken: string): Promise<SocialAccount[]> => {
  const appSecretProof = createHmac('sha256', env.FACEBOOK_APP_SECRET)
    .update(userToken)
    .digest('hex');

  const accounts: SocialAccount[] = [];
  let afterCursor: string | undefined = undefined;

  do {
    const params: Record<string, string> = {
      fields: 'id,name,access_token,picture{url}',
      limit: '100',
      access_token: userToken,
      appsecret_proof: appSecretProof,
    };

    if (afterCursor) {
      params.after = afterCursor;
    }

    const response = await facebookGet<FacebookAccountsResponse>('/me/accounts', params);

    const validPages = response.data
      .filter((page) => Boolean(page.access_token))
      .map((page) => ({
        externalAccountId: page.id,
        name: page.name,
        avatar: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
      }));

    accounts.push(...validPages);

    afterCursor =
      response.paging?.next && response.paging?.cursors?.after
        ? response.paging.cursors.after
        : undefined;
  } while (afterCursor && accounts.length < MAX_PAGES_FETCH);

  return accounts;
};
