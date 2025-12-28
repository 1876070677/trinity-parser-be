import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(ApiGatewayModule);

  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), 'apps', 'api-gateway', 'public'));

  // API Gateway는 HTTP로 클라이언트 요청을 받습니다
  await app.listen(process.env.PORT ?? 3000);

  console.log('API Gateway is running on port 3000');
}
void bootstrap();
