import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    this.logger.error(`Prisma ${exception.code}: ${exception.message.replace(/\n/g, ' ')}`);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        response.status(status).json({
          statusCode: status,
          message: 'Já existe um registro com este dado (Email ou Usuário).',
        });
        break;
      }
      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;
        response.status(status).json({
          statusCode: status,
          message: 'Registro não encontrado.',
        });
        break;
      }
      default: {
        if (isProduction) {
          const status = HttpStatus.INTERNAL_SERVER_ERROR;
          response.status(status).json({
            statusCode: status,
            message: 'Erro interno ao processar a requisição.',
          });
        } else {
          super.catch(exception, host);
        }
        break;
      }
    }
  }
}
