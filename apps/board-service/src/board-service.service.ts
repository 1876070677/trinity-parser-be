import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto, ListPostsDto, ListPostsResponseDto } from '@libs/dto';

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

  async getPosts(dto: ListPostsDto): Promise<ListPostsResponseDto> {
    const limit = dto.limit ?? 20;

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1); // 다음 페이지 존재 여부 확인용

    if (dto.cursor) {
      const [cursorDate, cursorId] = this.decodeCursor(dto.cursor);
      queryBuilder.where(
        '(post.createdAt < :cursorDate) OR (post.createdAt = :cursorDate AND post.id < :cursorId)',
        { cursorDate, cursorId },
      );
    }

    const posts = await queryBuilder.getMany();

    const hasNextPage = posts.length > limit;
    if (hasNextPage) {
      posts.pop(); // limit+1번째 항목 제거
    }

    const nextCursor =
      hasNextPage && posts.length > 0
        ? this.encodeCursor(posts[posts.length - 1])
        : null;

    return {
      data: posts,
      meta: {
        hasNextPage,
        nextCursor,
      },
    };
  }

  private encodeCursor(post: Post): string {
    const payload = `${post.createdAt.toISOString()}|${post.id}`;
    return Buffer.from(payload).toString('base64');
  }

  private decodeCursor(cursor: string): [Date, string] {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [dateStr, id] = decoded.split('|');
    return [new Date(dateStr), id];
  }
}
