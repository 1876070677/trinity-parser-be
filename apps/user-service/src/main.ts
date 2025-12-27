import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UserServiceModule } from './user-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'user',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
        consumer: {
          groupId: 'user-consumer',
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
      },
    },
  );

  await app.listen();
  console.log('User Service is listening to Kafka messages');
}
bootstrap();
