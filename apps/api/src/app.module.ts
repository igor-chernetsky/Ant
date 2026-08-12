import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { EstimationModule } from './estimation/estimation.module';
import { HealthModule } from './health/health.module';
import { AmendmentsModule } from './amendments/amendments.module';
import { IntakeModule } from './intake/intake.module';
import { LocalizationModule } from './localization/localization.module';
import { LocationsModule } from './locations/locations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StorageModule } from './storage/storage.module';
import { TagsModule } from './tags/tags.module';
import { TenderingModule } from './tendering/tendering.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { SupplyDirectoryModule } from './supply-directory/supply-directory.module';
import { ProgressModule } from './progress/progress.module';
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    LocalizationModule,
    ProjectsModule,
    TagsModule,
    DocumentsModule,
    EstimationModule,
    IntakeModule,
    LocationsModule,
    AmendmentsModule,
    TenderingModule,
    VerificationModule,
    SupplyDirectoryModule,
    ProgressModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
