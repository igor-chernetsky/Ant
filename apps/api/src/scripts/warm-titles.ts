import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectLocalizationService } from '../localization/project-localization.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const localization = app.get(ProjectLocalizationService);
    const result = await localization.warmAllProjectTitles();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
  }
}

void main();
