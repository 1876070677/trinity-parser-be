import { Controller, OnModuleInit } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { BoardServiceService } from './board-service.service';
import {
  CreatePostDto,
  CreateAdminPostDto,
  ListPostsDto,
  ListPostsResponseDto,
} from '@libs/dto';

@Controller()
export class BoardServiceController implements OnModuleInit {
  private readonly topics = [
    'board.createPost',
    'board.createAdminPost',
    'board.deletePost',
    'board.likePost',
    'board.listPosts',
  ];

  constructor(private readonly boardServiceService: BoardServiceService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'board-service-admin',
      brokers: (process.env.KAFKA_BROKER ?? 'localhost:9092').split(','),
    });
    const admin = kafka.admin();
    await admin.connect();

    // 이 서비스가 구독할 토픽들을 개별적으로 생성
    const createdTopics: string[] = [];
    for (const topic of this.topics) {
      try {
        const created = await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 3 }],
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

  @MessagePattern('board.createAdminPost')
  async createAdminPost(
    @Payload() data: CreateAdminPostDto,
  ): Promise<{ success: boolean; id?: string }> {
    return await this.boardServiceService.createAdminPost(data);
  }

  @MessagePattern('board.deletePost')
  async deletePost(
    @Payload() data: { id: string },
  ): Promise<{ success: boolean }> {
    return await this.boardServiceService.deletePost(data.id);
  }

  @MessagePattern('board.likePost')
  async likePost(
    @Payload() data: { id: string },
  ): Promise<{ success: boolean; likes?: number }> {
    return this.boardServiceService.likePost(data.id);
  }

  @MessagePattern('board.listPosts')
  async listPosts(
    @Payload() data: ListPostsDto,
  ): Promise<ListPostsResponseDto> {
    return this.boardServiceService.getPosts(data);
  }
}