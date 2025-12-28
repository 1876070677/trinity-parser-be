import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Check,
} from 'typeorm';

@Entity('post')
@Check('"likes" <= 10000')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false, length: 10 })
  stdNo: string;

  @Column({ type: 'varchar', length: 500 })
  content: string;

  @CreateDateColumn({ nullable: false })
  createdAt: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  isAdmin: boolean;

  @Column({ type: 'int', default: 0, nullable: false })
  likes: number;
}
