export interface SubmitContactMessageInput {
  email?: string;
  phone?: string;
  message: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(body?.message)) {
    return body.message.join(', ');
  }
  return typeof body?.message === 'string' ? body.message : fallback;
}

export async function submitContactMessage(
  input: SubmitContactMessageInput,
): Promise<{ sent: true }> {
  const response = await fetch('/api/public/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to send message'));
  }
  return response.json() as Promise<{ sent: true }>;
}
