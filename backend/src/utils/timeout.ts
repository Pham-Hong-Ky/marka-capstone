export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  makeError: () => Error
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(makeError()), ms);
    timer.unref();
  });

  // Promise thua cuộc vẫn có thể reject sau đó; chặn unhandled rejection.
  promise.catch(() => undefined);

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export default { withTimeout };
