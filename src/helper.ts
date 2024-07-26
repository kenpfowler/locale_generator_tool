import { z, ZodSchema, ZodTypeAny } from "zod";
import { Locale } from "./locales";

export type RecordWithUnknownValue<T = unknown> = Record<string, T>;

/**
 * @param object object used as the source of your translation file
 * @returns a zod schema that can be used to validate the object used as the param
 */
export const createSchemaFromObject = (
  object: RecordWithUnknownValue
): ZodSchema => {
  const schemaShape: Record<string, ZodTypeAny> = {};

  // this loop will take an object that is arbitrarily deep and create a schema used to validate that object
  for (const key in object) {
    if (typeof object[key] === "string") {
      schemaShape[key] = z.string();
    } else if (typeof object[key] === "object" && object[key] !== null) {
      if (Object.keys(object[key]).length) {
        schemaShape[key] = createSchemaFromObject(
          object[key] as RecordWithUnknownValue
        );
      } else {
        throw Error(
          `value accessed by key: ${key} is type ${typeof object[
            key
          ]}, but has no keys. objects must not be empty`
        );
      } // Recursively create schema for nested objects
    } else {
      throw Error(
        `value accessed by key: ${key} is type ${typeof object[
          key
        ]}.  all values should be string or object`
      );
    }
  }

  return z.object(schemaShape);
};

/**
 *
 * @param locales locale keys to provide validation for
 * @param source source locale file used to create validation schema
 * @returns a zod object where they keys are locales and the value is a schema mapped to the users source locale file
 */
export const getMasterSchema = (
  locales: Array<Locale>,
  source: RecordWithUnknownValue
) => {
  const schemaShape: Partial<Record<Locale, ZodTypeAny>> = {};
  const localeSchema = createSchemaFromObject(source);

  locales.forEach((locale) => {
    schemaShape[locale] = localeSchema;
  });

  return z.object(schemaShape);
};

/**
 *
 * @param path an array of keys to follow where the value will be stored. the last key in the path array is the most deeply nested
 * @param value
 * @returns an object where the value provided is nested given an path of keys
 */
export function CreateKeyValue(path: string[], value: string | object) {
  let obj = {};

  for (let index = path.length - 1; index >= 0; index--) {
    const key = path[index];

    if (index === path.length - 1) {
      // @ts-ignore
      obj[key] = value;
    } else {
      // @ts-ignore
      obj = { [key]: { ...obj } };
    }
  }

  return obj;
}
