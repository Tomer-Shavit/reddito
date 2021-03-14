import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { myContext } from "../types";
import { isAuth } from "../middlewares/isAuth";
import { getConnection } from "typeorm";
import { Upvote } from "../entities/Upvote";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field(() => Boolean)
  hasMore: Boolean;
}

@Resolver(Post)
export class PostResolver {
  //return a preview  of the posts text
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    if (root.text.length < 200) {
      return root.text;
    }
    return root.text.slice(0, 200) + "...";
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: myContext
  ) {
    const { userId } = req.session;
    const isUpvote = value === -1;
    const realValue = isUpvote ? -1 : 1;
    const upvote = await Upvote.findOne({ where: { postId, userId } });

    //user already upvoted and changed his vote
    if (upvote && upvote.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        update upvote
        set value = $1
        where "postId" = $2 and "userId" = $3
        `,
          [realValue, postId, userId]
        );
        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
          `,
          [2 * realValue, postId]
        );
      });
      //The user upvote a post for the first time
    } else if (!upvote) {
      getConnection().transaction(async (tm) => {
        await tm.query(
          `
          insert into upvote ("userId", "postId", value)
          values($1, $2,$3)
        `,
          [userId, postId, realValue]
        );

        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [realValue, postId]
        );
      });
    }

    // await getConnection().query(`
    //   START TRANSACTION;
    //   insert into upvote ("userId", "postId", value)
    //   values(${userId}, ${postId}, ${realValue});

    //   update post
    //   set points = points + ${realValue}
    //   where id = ${postId};

    //   COMMIT;
    // `);
    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    const replacements: any[] = [realLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
      select p.*,
      json_build_object('id',u.id, 'username', u.username, 'email', u.email, 'createdAt', u."createdAt", 'updatedAt', u."updatedAt") creator 
      from post p
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where $2 > p."createdAt"` : ""}
      order by p."createdAt" DESC
      limit $1
      `,
      replacements
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  async post(@Arg("id") id: number): Promise<Post | undefined> {
    return await Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: myContext
  ): Promise<Post> {
    // 2 sql queries
    return await Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title") title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);

    if (!post) {
      return null;
    }
    if (typeof title !== undefined) {
      await Post.update({ id }, { title });
    }
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    try {
      await Post.delete(id);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
