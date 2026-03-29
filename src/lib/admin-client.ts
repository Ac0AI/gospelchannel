type ErrorPayload = {
  error?: string;
};

function getErrorMessage(payload: ErrorPayload | null, response: Response) {
  if (payload?.error) return payload.error;
  return `Request failed with status ${response.status}`;
}

export async function postAdminAction<TPayload, TResponse = { success: true }>(
  url: string,
  payload: TPayload
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    console.error(`[admin] POST ${url} failed: ${message}`, error);
    throw new Error(message);
  }

  const result = (await response.json().catch(() => null)) as (TResponse & ErrorPayload) | null;

  if (!response.ok) {
    const message = getErrorMessage(result, response);
    console.error(`[admin] POST ${url} failed: ${message}`);
    throw new Error(message);
  }

  return (result ?? ({ success: true } as TResponse));
}
