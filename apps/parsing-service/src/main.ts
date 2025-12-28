import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ParsingServiceModule } from './parsing-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ParsingServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'parsing-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
        consumer: {
          groupId: 'parsing-service-consumer',
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
      },
    },
  );

  await app.listen();
  console.log('Parsing Service is running as Kafka microservice');
}
bootstrap();