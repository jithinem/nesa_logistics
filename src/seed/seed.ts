import mongoose, { Types } from "mongoose";
import { connectDatabase } from "../config/database";
import { environment } from "../config/environment";
import { HubModel } from "../modules/hubs/models/hub.model";
import { RouteModel } from "../modules/routes/models/route.model";
import { seedHubs, seedRoutes } from "./seed-data";

export const seedDatabase = async (): Promise<void> => {
  if (environment.nodeEnv !== "development") {
    throw new Error(
      "Database seeding is restricted to NODE_ENV=development.",
    );
  }

  await connectDatabase();

  try {
    const hubIds = new Map<string, Types.ObjectId>();

    for (const hubData of seedHubs) {
      const hub = await HubModel.findOneAndUpdate(
        { code: hubData.code },
        { $set: hubData },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!hub) {
        throw new Error(`Failed to seed hub "${hubData.code}".`);
      }

      hubIds.set(hubData.code, hub._id);
    }

    for (const routeData of seedRoutes) {
      const sourceHub = hubIds.get(routeData.sourceCode);
      const destinationHub = hubIds.get(routeData.destinationCode);

      if (!sourceHub || !destinationHub) {
        throw new Error(
          `Seed route ${routeData.sourceCode} -> ${routeData.destinationCode} references an unknown hub.`,
        );
      }

      const { id, sourceCode, destinationCode, ...routeFields } = routeData;

      const route = await RouteModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        {
          $set: {
            ...routeFields,
            sourceHub,
            destinationHub,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

      if (!route) {
        throw new Error(
          `Failed to seed route ${routeData.sourceCode} -> ${routeData.destinationCode}.`,
        );
      }
    }

    console.info(
      `Seeded ${seedHubs.length} hubs and ${seedRoutes.length} routes.`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  void seedDatabase().catch((error: unknown) => {
    console.error("Database seeding failed.", error);
    process.exitCode = 1;
  });
}
