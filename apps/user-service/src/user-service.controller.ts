import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka, MessagePattern, Payload } from '@nestjs/microservices';
import { Kafka } from 'kafkajs';
import { AuthData, LoginData, LogoutData, UserInfoData } from '@libs/types';
import { UserServiceService } from './user-service.service';

@Controller()
export class UserServiceController implements OnModuleInit {
  private readonly topics = [
    'user.loginForm',
    'user.auth',
    'user.login',
    'user.logout',
    'user.userInfo',
  ];

  constructor(
    private readonly userServiceService: UserServiceService,
    @Inject('MANAGEMENT_SERVICE')
    private readonly managementClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'user-service-admin',
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

    // Management Service 응답 토픽 구독 및 연결
    this.managementClient.subscribeToResponseOf('management.getShtmYyyy');
    await this.managementClient.connect();
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
    const result = await this.userServiceService.login(data);

    // 로그인 성공 시 이벤트 발행 (fire-and-forget)
    this.managementClient.emit('management.loginSuccess', {});

    return result;
  }

  // 4단계: 로그아웃
  @MessagePattern('user.logout')
  async logout(@Payload() data: LogoutData) {
    return this.userServiceService.logout(data);
  }

  // 5단계: 사용자 정보 조회
  @MessagePattern('user.userInfo')
  async getUserInfo(@Payload() data: UserInfoData) {
    const result = await this.userServiceService.getUserInfo(data);

    // management-service에서 shtm, yyyy 조회
    const shtmYyyy = await new Promise<{
      shtm: string | null;
      yyyy: string | null;
    }>((resolve) => {
      this.managementClient.send('management.getShtmYyyy', {}).subscribe({
        next: (value: { shtm: string | null; yyyy: string | null }) =>
          resolve(value),
        error: () => resolve({ shtm: null, yyyy: null }),
      });
    });

    // userInfo에 shtm, yyyy 추가
    if (shtmYyyy.shtm) {
      result.userInfo.shtm = shtmYyyy.shtm;
    }
    if (shtmYyyy.yyyy) {
      result.userInfo.yyyy = shtmYyyy.yyyy;
    }

    return result;
  }
}
