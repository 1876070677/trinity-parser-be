import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ParsingServiceController } from './parsing-service.controller';
import { ParsingServiceService } from './parsing-service.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'LOGGING_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'parsing-to-logging',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
          consumer: {
            groupId: 'parsing-logging-consumer',
          },
        },
      },
    ]),
  ],
  controllers: [ParsingServiceController],
  providers: [ParsingServiceService],
})
export class ParsingServiceModule {}
