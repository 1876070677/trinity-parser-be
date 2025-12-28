import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from '@libs/dto';

@Injectable()
export class BoardServiceService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async createPost(
    data: CreatePostDto,
  ): Promise<{ success: boolean; id?: string }> {
    const post = this.postRepository.create({
      stdNo: data.stdNo,
      content: data.content,
    });
    const saved = await this.postRepository.save(post);
    return { success: true, id: saved.id };
  }

  async likePost(id: string): Promise<{ success: boolean; likes?: number }> {
    // TypeORM increment는 DB 레벨에서 원자적으로 처리됨
    // UPDATE post SET likes = likes + 1 WHERE id = ?
    const result = await this.postRepository.increment({ id }, 'likes', 1);

    if (result.affected === 0) {
      return { success: false };
    }

    // 업데이트된 likes 값 조회
    const post = await this.postRepository.findOne({ where: { id } });
    return { success: true, likes: post?.likes };
  }
}
