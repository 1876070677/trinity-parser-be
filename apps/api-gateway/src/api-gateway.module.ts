import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
            retry: {
              initialRetryTime: 1000,
              retries: 10,
            },
          },
          consumer: {
            groupId: 'api-gateway-consumer',
            retry: {
              initialRetryTime: 1000,
              retries: 10,
            },
          },
        },
      },
      {
        name: 'MANAGEMENT_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'api-gateway-management',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
            retry: {
              initialRetryTime: 1000,
              retries: 10,
            },
          },
          consumer: {
            groupId: 'api-gateway-management-consumer',
            retry: {
              initialRetryTime: 1000,
              retries: 10,
            },
          },
        },
      },
    ]),
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
