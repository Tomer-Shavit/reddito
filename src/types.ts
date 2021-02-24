import { Request, Response } from "express";
import { Redis } from "ioredis";

export interface myContext {
  redis: Redis;
  req: Request;
  res: Response;
}
