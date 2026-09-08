import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  ContactService,
  type SubmitContactMessageContext,
  type SubmitContactMessageDto,
} from './contact.service';

function readClientIp(req: Request): string {
  const fromBff = req.headers['x-client-ip'];
  if (typeof fromBff === 'string' && fromBff.trim()) {
    return fromBff.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.ip ?? '';
}

@Controller('v1/public/contact')
export class PublicContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  submit(@Req() req: Request, @Body() body: SubmitContactMessageDto) {
    const context: SubmitContactMessageContext = {
      clientIp: readClientIp(req),
    };
    return this.contact.submitContactMessage(body, context);
  }
}
