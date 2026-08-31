import { Body, Controller, Post } from '@nestjs/common';
import {
  ContactService,
  type SubmitContactMessageDto,
} from './contact.service';

@Controller('v1/public/contact')
export class PublicContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  submit(@Body() body: SubmitContactMessageDto) {
    return this.contact.submitContactMessage(body);
  }
}
