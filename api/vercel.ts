import { handle } from "@hono/vercel";
import app from "./app";

export const config = {
  maxDuration: 60,
};

export default handle(app);
