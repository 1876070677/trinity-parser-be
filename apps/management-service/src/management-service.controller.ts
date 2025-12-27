import { Controller, OnModuleInit } from '@nestjs/common';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { ManagementServiceService } from './management-service.service';

@Controller()
export class ManagementServiceController implements OnModuleInit {
  private readonly topics = [
    'management.loginSuccess',
    'management.getLoginCount',
  ];

  constructor(
    private readonly managementServiceService: ManagementServiceService,
  ) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'management-service-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    const createdTopics: string[] = [];
    for (const topic of this.topics) {
      try {
        const created = await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        });
        if (created) {
          createdTopics.push(topic);
        } else {
          console.log(`토픽 이미 존재: ${topic}`);
        }
      } catch (error) {
        console.log(`토픽 생성 실패 ${topic}:`, error);
      }
    }
    if (createdTopics.length > 0) {
      console.log(`Created topics: ${createdTopics.join(', ')}`);
    }
    await admin.disconnect();
  }

  // 로그인 성공 이벤트 수신 (fire-and-forget)
  @EventPattern('management.loginSuccess')
  async handleLoginSuccess() {
    await this.managementServiceService.incrementLoginCount();
  }

  // 로그인 카운트 조회 (request-response)
  @MessagePattern('management.getLoginCount')
  async getLoginCount() {
    const count = await this.managementServiceService.getLoginCount();
    return { count };
  }
}
