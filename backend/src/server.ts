import "dotenv/config";
import { createApp } from "./app.js";
import { connectDb } from "./db/mongo.js";

async function main() {
  await connectDb();
  const app = createApp();
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => {
    console.log(`prep-kit backend listening on :${port}`);
  });
}

main().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
