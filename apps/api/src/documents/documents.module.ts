import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { DefectsModule } from '../defects/defects.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PublicDocumentsController } from './public-documents.controller';

@Module({
  imports: [
    UsersModule,
    AiModule,
    AuthModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => DefectsModule),
  ],
  controllers: [DocumentsController, PublicDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
