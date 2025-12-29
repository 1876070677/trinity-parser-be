import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka, MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { SubjectInfoRequest, GradeRequest } from '@libs/types';
import { ParsingServiceService } from './parsing-service.service';

@Controller()
export class ParsingServiceController implements OnModuleInit {
  private readonly topics = ['parsing.subjectInfo', 'parsing.grade'];

  constructor(
    private readonly parsingServiceService: ParsingServiceService,
    @Inject('LOGGING_SERVICE') private readonly loggingClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'parsing-service-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // 이 서비스가 구독할 토픽들을 생성
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

  @MessagePattern('parsing.subjectInfo')
  async getSubjectInfo(@Payload() data: SubjectInfoRequest) {
    const result = await this.parsingServiceService.getSubjectInfo(data);

    // 성공 시 logging-service로 로그 전송
    this.loggingClient.emit('logging.subjectSearch', {
      classKrName: result.sbjtKorNm,
      classId: result.sujtNo,
      classNo: result.classNo,
    });

    return result;
  }

  @MessagePattern('parsing.grade')
  async getGrades(@Payload() data: GradeRequest) {
    return this.parsingServiceService.getGrades(data);
  }
}
