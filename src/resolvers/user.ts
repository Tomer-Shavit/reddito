import { User } from "../entities/User";
import { myContext } from "../types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./usernameAndPassword";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => User, { nullable: true })
  user?: User;
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver(User)
export class UserResolver {
  //This is a resolver specific to the email field in the user type, which conditinaly check if post email is the same as the user email
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: myContext) {
    //this is their email so they can see it
    if (req.session.userId === user.id) {
      return user.email;
    }
    //an empty string will show in the case of other user
    return "";
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Ctx() { redis, req }: myContext,
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string
  ): Promise<UserResponse> {
    //validate the password
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password needs to be at least 3 characters long",
          },
        ],
      };
    }
    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    //validate the token
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "Token expired",
          },
        ],
      };
    }
    //find the user in the db
    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "User doesn't exists",
          },
        ],
      };
    }

    await User.update(
      { id: userIdNum },
      { password: await argon2.hash(newPassword) }
    );

    // logs in the user
    //@ts-ignore
    req.session.userId = user.id;
    await redis.del(key);

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Ctx() { redis }: myContext,
    @Arg("email") email: string
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      //The use isn't in the db
      return true;
    } else {
      const token = v4();
      await redis.set(
        FORGOT_PASSWORD_PREFIX + token,
        user.id,
        "ex",
        1000 * 60 * 60 * 24 * 3
      ); //set for 3 days
      sendEmail(
        email,
        `
        <a href="http://localhost:3000/change-password/${token}">Reset password here</a>
       `
      );
      return true;
    }
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: myContext) {
    //@ts-ignore
    if (!req.session.userId) {
      return null;
    }
    //@ts-ignore
    return User.findOne(req.session.userId);
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User)
  user(@Arg("id") id: number): Promise<User | undefined> {
    return User.findOne(id);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: myContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    let user;
    if (errors) {
      return {
        errors,
      };
    }
    const hashedPassword = await argon2.hash(options.password);
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          email: options.email,
          username: options.username,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      user = result.raw[0];
    } catch (err) {
      if (err.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "Username is already taken",
            },
          ],
        };
      }
    }
    // Store a cookie with the user id
    // Logging the user after register
    //@ts-ignore
    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: myContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: `User ${usernameOrEmail} doesn't exist`,
          },
        ],
      };
    }
    //check if hashed password is same as given password
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Incorrect password",
          },
        ],
      };
    }

    // Save a cookie with the user id
    //@ts-ignore
    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: myContext) {
    return new Promise((response) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          response(false);
          return;
        } else {
          response(true);
        }
      })
    );
  }
}
