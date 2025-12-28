import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BoardServiceModule } from './board-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BoardServiceModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'board-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          groupId: 'board-service-consumer',
        },
      },
    },
  );
  await app.listen();
  console.log('Board Service is listening on Kafka');
}
bootstrap();
