import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PublicDocumentsController } from './public-documents.controller';

@Module({
  imports: [UsersModule, AiModule],
  controllers: [DocumentsController, PublicDocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
