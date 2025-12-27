import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.use(cookieParser());

  // API Gateway는 HTTP로 클라이언트 요청을 받습니다
  await app.listen(process.env.PORT ?? 3000);

  console.log('API Gateway is running on port 3000');
}
bootstrap();
