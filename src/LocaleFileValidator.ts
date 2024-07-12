import { ZodSchema } from "zod";

type LocaleFileValidatorConfig<T> = {
  source: string | null | undefined;
  schema: ZodSchema<T>;
};

/**
 * validates that locale file data was created successfully
 */
export class LocaleFileValidator<T> {
  private source: string;
  private schema: ZodSchema<T>;

  constructor({ source, schema }: LocaleFileValidatorConfig<T>) {
    if (this.isString(source)) {
      this.source = source;
    } else {
      throw new Error("argument for property source should be type string");
    }

    this.schema = schema;
  }

  private isString(value: string | null | undefined): value is string {
    return typeof value === "string";
  }

  private isObject(obj: unknown): obj is object {
    return typeof obj === "object" && obj !== null;
  }

  private parseJSON() {
    const object = JSON.parse(this.source);

    if (!this.isObject(object)) {
      throw Error("JSON.parse did not return a javascript object");
    }

    return object;
  }

  public ValidateLocaleTranslation() {
    const parsed = this.parseJSON();
    const validated = this.schema.parse(parsed);
    return validated;
  }
}
