import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardServiceController } from './board-service.controller';
import { BoardServiceService } from './board-service.service';
import { Post } from './entities/post.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'trinity',
      entities: [Post],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Post]),
  ],
  controllers: [BoardServiceController],
  providers: [BoardServiceService],
})
export class BoardServiceModule {}
