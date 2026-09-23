import { Response, CookieOptions } from 'express';
import env from '../config/env.js';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export const getCookieOptions = (customOptions: CookieOptions = {}): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_IN_MS,
    ...customOptions,
  };
};

export const setRefreshTokenCookie = (res: Response, refreshToken: string, customOptions: CookieOptions = {}) => {
  const options = getCookieOptions(customOptions);
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, options);
};

export const clearRefreshTokenCookie = (res: Response, customOptions: CookieOptions = {}) => {
  const options = getCookieOptions({
    maxAge: 0,
    ...customOptions,
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, options);
};

export default {
  getCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
