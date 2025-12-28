import { Controller, OnModuleInit } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { BoardServiceService } from './board-service.service';
import { CreatePostDto } from '@libs/dto';

@Controller()
export class BoardServiceController implements OnModuleInit {
  private readonly topics = ['board.createPost'];

  constructor(private readonly boardServiceService: BoardServiceService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'board-service-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // 이 서비스가 구독할 토픽들을 개별적으로 생성
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

  @MessagePattern('board.createPost')
  async createPost(
    @Payload() data: CreatePostDto,
  ): Promise<{ success: boolean; id?: string }> {
    return this.boardServiceService.createPost(data);
  }
}
