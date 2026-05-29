export interface CreateProjectDto {
  title: string;
  description?: string;
  regionCode?: string;
}

export interface ProjectResponse {
  id: string;
  title: string;
  description: string | null;
  regionCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
