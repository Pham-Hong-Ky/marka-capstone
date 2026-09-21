import env from '../config/env.js';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Return production-grade, secure cookie options.
 * Handles Cross-Origin (Render Backend <-> Vercel Frontend) with SameSite=None + Secure.
 */
export const getCookieOptions = (customOptions = {}) => {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true, // Prevents JavaScript from reading the cookie (anti-XSS)
    secure: isProduction, // Requires HTTPS in production (Render.com)
    sameSite: isProduction ? 'none' : 'lax', // 'none' for Cross-Origin production, 'lax' for local
    path: '/',
    maxAge: SEVEN_DAYS_IN_MS,
    ...customOptions,
  };
};

/**
 * Helper to set Refresh Token cookie securely on Express Response
 */
export const setRefreshTokenCookie = (res, refreshToken, customOptions = {}) => {
  const options = getCookieOptions(customOptions);
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, options);
};

/**
 * Helper to clear Refresh Token cookie on Logout
 */
export const clearRefreshTokenCookie = (res, customOptions = {}) => {
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
