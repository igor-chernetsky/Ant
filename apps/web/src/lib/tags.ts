export interface TagCatalogItem {
  slug: string;
  label: string;
  groupSlug: string | null;
  groupLabel: string | null;
  isSystem: boolean;
}

export async function fetchTags(): Promise<TagCatalogItem[]> {
  const response = await fetch('/api/tags', { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load tags');
  }
  return response.json() as Promise<TagCatalogItem[]>;
}

export async function createTag(label: string): Promise<TagCatalogItem> {
  const response = await fetch('/api/tags', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to create tag');
  }
  return response.json() as Promise<TagCatalogItem>;
}

export function groupTagsByGroup(
  tags: TagCatalogItem[],
): Map<string, TagCatalogItem[]> {
  const groups = new Map<string, TagCatalogItem[]>();
  for (const tag of tags) {
    const key = tag.groupLabel ?? 'Other';
    const list = groups.get(key) ?? [];
    list.push(tag);
    groups.set(key, list);
  }
  return groups;
}
