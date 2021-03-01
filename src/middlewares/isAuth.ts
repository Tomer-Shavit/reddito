import { myContext } from "src/types";
import { MiddlewareFn } from "type-graphql";

export const isAuth: MiddlewareFn<myContext> = ({ context: { req } }, next) => {
  if (!req.session.userId) {
    throw new Error("User is not authenticated");
  }
  return next();
};
