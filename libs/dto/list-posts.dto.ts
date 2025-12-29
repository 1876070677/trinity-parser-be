import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPostsDto {
  @IsOptional()
  @IsString()
  cursor?: string; // createdAt,id 형태로 인코딩된 커서

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export interface PostItem {
  id: string;
  stdNo: string;
  content: string;
  createdAt: Date;
  isAdmin: boolean;
  likes: number;
}

export interface ListPostsResponseDto {
  data: PostItem[];
  meta: {
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}
