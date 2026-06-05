import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { EstimationModule } from './estimation/estimation.module';
import { HealthModule } from './health/health.module';
import { AmendmentsModule } from './amendments/amendments.module';
import { IntakeModule } from './intake/intake.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StorageModule } from './storage/storage.module';
import { TagsModule } from './tags/tags.module';
import { TenderingModule } from './tendering/tendering.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TagsModule,
    DocumentsModule,
    EstimationModule,
    IntakeModule,
    AmendmentsModule,
    TenderingModule,
    VerificationModule,
  ],
})
export class AppModule {}
