import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAdminPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;
}