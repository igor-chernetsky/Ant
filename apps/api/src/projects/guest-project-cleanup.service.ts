import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProjectsService } from './projects.service';

/**
 * Removes guest projects whose 24 hours ran out, together with their documents
 * and S3 objects. Without this, every abandoned anonymous draft would keep its
 * uploaded files (and the OpenAI spend behind its estimate) forever.
 */
@Injectable()
export class GuestProjectCleanupService {
  private readonly logger = new Logger(GuestProjectCleanupService.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async removeExpiredGuestProjects(): Promise<void> {
    const removed = await this.cleanupExpiredGuestProjects();
    if (removed > 0) {
      this.logger.log(`Removed ${removed} expired guest project(s)`);
    }
  }

  /** Exposed for tests and manual runs; returns how many projects were deleted. */
  async cleanupExpiredGuestProjects(limit = 100): Promise<number> {
    let removed = 0;
    for (let batch = 0; batch < 10; batch += 1) {
      const ids = await this.projectsService.listExpiredGuestProjects(limit);
      if (ids.length === 0) {
        break;
      }
      for (const id of ids) {
        try {
          if (await this.projectsService.deleteExpiredGuestProject(id)) {
            removed += 1;
          }
        } catch (err: unknown) {
          this.logger.error(
            `Failed to remove expired guest project ${id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      if (ids.length < limit) {
        break;
      }
    }
    return removed;
  }
}
