/** Keep operational probes generic: never return connection strings, errors or user data. */
export async function readiness(probe: () => Promise<unknown>, configured: boolean, timeoutMs = 5000) {
  if (!configured) return { status: 'unavailable' as const };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([probe(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Readiness timeout')), timeoutMs);
    })]);
    return { status: 'ok' as const };
  } catch {
    return { status: 'unavailable' as const };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
