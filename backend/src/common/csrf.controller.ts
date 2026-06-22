import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { issueCsrfToken } from './csrf.middleware';

@Public()
@Controller('csrf')
export class CsrfController {
  @Get()
  issue(@Res({ passthrough: true }) res: Response) {
    const token = issueCsrfToken(res);
    return { csrfToken: token };
  }
}
