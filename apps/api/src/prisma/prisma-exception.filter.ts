import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.error(exception.message, exception.stack);

    const schemaMismatch =
      (exception instanceof Prisma.PrismaClientKnownRequestError &&
        exception.code === 'P2021') ||
      /enum|incompatible value|does not exist in/i.test(exception.message);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: schemaMismatch
        ? 'Database schema is out of date. Run prisma migrate deploy on the API server.'
        : 'Internal server error',
    });
  }
}
