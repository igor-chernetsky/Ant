import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTagDto } from '../projects/projects.types';
import { TagsService } from './tags.service';

@Controller('v1/tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list() {
    return this.tagsService.listCatalog();
  }

  @Post()
  create(@Body() body: CreateTagDto) {
    return this.tagsService.createCustom(body);
  }
}
