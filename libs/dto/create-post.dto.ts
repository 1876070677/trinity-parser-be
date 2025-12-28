import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  stdNo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;
}
