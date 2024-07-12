import z from "zod";

export const schema = z.object({
  greeting: z.string(),
});
