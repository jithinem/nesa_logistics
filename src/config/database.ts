import mongoose from "mongoose";
import { environment } from "./environment";

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(environment.mongoUri, {
    maxPoolSize: environment.mongoMaxPoolSize,
  });
};
