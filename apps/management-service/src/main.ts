import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ManagementServiceModule } from './management-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ManagementServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'management',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
        consumer: {
          groupId: 'management-consumer',
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
      },
    },
  );

  await app.listen();
  console.log('Management Service is listening to Kafka messages');
}
bootstrap();
