import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaClientExceptionFilter } from './prisma/prisma-client-exception.filter';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';

  const allowedOrigins = new Set<string>([
    ...configuredOrigins,
    'http://127.0.0.1:5173',
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.has(origin) ||
        (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
