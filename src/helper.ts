import { z, ZodSchema, ZodTypeAny } from "zod";

/**
 * @param object object used as the source of your translation file
 * @returns a zod schema that can be used to validate the object used as the param
 */
export const createSchemaFromObject = (
  object: Record<string, any>
): ZodSchema => {
  const schemaShape: Record<string, ZodTypeAny> = {};

  // this loop will take an object that is arbitrarily deep and create a schema used to validate that object
  for (const key in object) {
    if (typeof object[key] === "string") {
      schemaShape[key] = z.string();
    } else if (typeof object[key] === "object" && object[key] !== null) {
      schemaShape[key] = createSchemaFromObject(object[key]); // Recursively create schema for nested objects
    } else {
      throw new Error(
        `value accessed by key: ${key} is type ${typeof object[
          key
        ]}.  all values should be string or object`
      );
    }
  }

  return z.object(schemaShape);
};
