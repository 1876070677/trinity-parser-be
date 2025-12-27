import { Controller, OnModuleInit } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import type { AuthData, LoginData } from './user-service.service';
import { UserServiceService } from './user-service.service';

@Controller()
export class UserServiceController implements OnModuleInit {
  private readonly topics = ['user.loginForm', 'user.auth', 'user.login'];

  constructor(private readonly userServiceService: UserServiceService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'user-service-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // 이 서비스가 구독할 토픽들 생성
    await admin.createTopics({
      topics: this.topics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });

    console.log(`Created topics: ${this.topics.join(', ')}`);
    await admin.disconnect();
  }

  // 1단계: samlRequest 획득
  @MessagePattern('user.loginForm')
  async loginForm() {
    return this.userServiceService.loginForm();
  }

  // 2단계: id/password + samlRequest로 SAMLResponse 획득
  @MessagePattern('user.auth')
  async auth(@Payload() data: AuthData) {
    return this.userServiceService.auth(data);
  }

  // 3단계: SAMLResponse로 csrf 토큰 획득
  @MessagePattern('user.login')
  async login(@Payload() data: LoginData) {
    return this.userServiceService.login(data);
  }
}
