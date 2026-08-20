import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DominioExceptionFilter } from './shared/infrastructure/http/dominio-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DominioExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error al iniciar la aplicación', error);
  process.exit(1);
});
