import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Post } from "./Post";
import { User } from "./User";

@Entity()
export class Upvote extends BaseEntity {
  @Column({ type: "int" })
  value: number;

  @ManyToOne(() => User, (user) => user.upvotes)
  user: User;

  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => Post, (post) => post.upvotes)
  post: Post;

  @PrimaryColumn()
  postId: number;
}
