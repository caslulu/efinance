import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  ParseEnumPipe,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { StatementImportService } from './statement-import.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  TransactionSeriesScope,
  UpdateTransactionDto,
} from './dto/update-transaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfirmStatementImportDto } from './dto/confirm-statement-import.dto';
import { AnalyzeStatementDto } from './dto/analyze-statement.dto';
import { AiStatementImportService } from './ai-statement-import.service';
import { Throttle } from '@nestjs/throttler';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'))
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly statementImportService: StatementImportService,
    private readonly aiStatementImportService: AiStatementImportService,
  ) {}

  @Post()
  create(@Request() req, @Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(
      req.user.userId,
      createTransactionDto,
    );
  }

  @Post('import/:walletId/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  previewImport(
    @Request() req,
    @Param('walletId', ParseIntPipe) walletId: number,
    @Query('cardId') cardId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado.');
    }

    return this.statementImportService.previewStatementImport(
      req.user.userId,
      walletId,
      file,
      cardId ? Number(cardId) : undefined,
    );
  }

  @Post('import/:walletId/confirm')
  confirmImport(
    @Request() req,
    @Param('walletId', ParseIntPipe) walletId: number,
    @Body() body: ConfirmStatementImportDto,
  ) {
    return this.statementImportService.confirmStatementImport(
      req.user.userId,
      walletId,
      body.rows,
      body.cardId,
    );
  }

  @Post('import/:walletId/analyze')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        fields: 3,
        fieldSize: 80000,
        files: 1,
      },
    }),
  )
  analyzeImport(
    @Request() req,
    @Param('walletId', ParseIntPipe) walletId: number,
    @Query('cardId', new ParseIntPipe({ optional: true }))
    cardId: number | undefined,
    @Body() body: AnalyzeStatementDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.aiStatementImportService.analyze(
      req.user.userId,
      walletId,
      body,
      file,
      cardId,
    );
  }

  @Get()
  findAll(@Request() req) {
    return this.transactionsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(
      id,
      req.user.userId,
      updateTransactionDto,
    );
  }

  @Delete(':id')
  remove(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Query(
      'scope',
      new DefaultValuePipe(TransactionSeriesScope.THIS),
      new ParseEnumPipe(TransactionSeriesScope),
    )
    scope: TransactionSeriesScope,
  ) {
    return this.transactionsService.remove(id, req.user.userId, scope);
  }
}
