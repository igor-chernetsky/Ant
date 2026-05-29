export interface Project {
  id: string;
  title: string;
  description: string | null;
  regionCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  regionCode?: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects', { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load projects');
  }
  return response.json() as Promise<Project[]>;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to create project');
  }
  return response.json() as Promise<Project>;
}

export function formatProjectStatus(status: string): string {
  return status.replaceAll('_', ' ');
}
