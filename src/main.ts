import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const frontendUrl = config.getOrThrow<string>('frontendUrl');

app.use(helmet());

app.enableCors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TenantContextInterceptor(), new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('University ERP API')
    .setDescription('NestJS, Prisma, PostgreSQL, Redis, JWT, and RBAC API for University ERP.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  Logger.log(`University ERP API running on http://localhost:${port}/api/v1`);
}

void bootstrap();
