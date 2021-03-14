import { Field, ObjectType } from "type-graphql";
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Entity,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Post } from "./Post";
import { Upvote } from "./Upvote";

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToMany(() => Upvote, (upvote) => upvote.user)
  upvotes: Upvote[];

  @Field()
  @Column({ unique: true })
  email!: string;

  @OneToMany(() => Post, (post) => post.creator) // note: we will create author property in the Photo class below
  posts: Post[];

  @Field()
  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
