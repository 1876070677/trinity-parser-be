import { Controller, OnModuleInit } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { SubjectSearchLogRequest } from '@libs/types';
import { LoggingServiceService } from './logging-service.service';

@Controller()
export class LoggingServiceController implements OnModuleInit {
  private readonly topics = ['logging.subjectSearch'];

  constructor(private readonly loggingServiceService: LoggingServiceService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'logging-service-admin',
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

  @MessagePattern('logging.subjectSearch')
  async logSubjectSearch(@Payload() data: SubjectSearchLogRequest) {
    return this.loggingServiceService.logSubjectSearch(data);
  }
}
