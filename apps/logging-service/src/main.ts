import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LoggingServiceModule } from './logging-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    LoggingServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'logging-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          groupId: 'logging-service-consumer',
        },
      },
    },
  );
  await app.listen();
  console.log('Logging Service is listening on Kafka');
}
bootstrap();
