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
}
