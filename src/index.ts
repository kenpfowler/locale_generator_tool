import OpenAI from "openai";
import { LocaleFileGenerator } from "./LocaleFileGenerator";
import { LocaleFileValidator } from "./LocaleFileValidator";
import { LocaleFileWriter } from "./LocaleFileWriter";
import z from "zod";
import { createSchemaFromObject } from "./helper";
import defaultLocale from "../en";

const schema = createSchemaFromObject(defaultLocale);

const masterSchema = z.object({
  en: schema,
  es: schema,
  "pt-BR": schema,
  "fr-CA": schema,
});

const main = async () => {
  try {
    const locales = ["en", "es", "pt-BR", "fr-CA"];

    const generator = new LocaleFileGenerator(new OpenAI(), {
      localeFileSrcPath: "../en",
      apiKey: process.env.OPENAI_API_KEY ?? "",
      defaultLocale: "en",
      locales,
    });

    // 1. generate a json compliant string that represents our locale files

    // FIXME: translating even a moderately large source file can cause the program to fail.
    // it takes a long time to generate the translations. generation_time = locales * translation_keys * time_to_translate
    // does the gpt have a max space/threshold in the output where it will quit if the end is not reached?
    // can we break translation requests down into multiple requests if they are large and/or complex?
    const source = await generator.GetLocaleTranslationsAsJSON();

    const validator = new LocaleFileValidator<z.infer<typeof masterSchema>>({
      source,
      schema: masterSchema,
    });

    // 2. validate that each locale is present and that each key-value pair is present with the proper types
    const translations = validator.ValidateLocaleTranslation();

    // 3. write the locale files to the configured output folder
    const localeWriter = new LocaleFileWriter({
      folderPath: "./locales",
      localeObjects: translations,
    });

    localeWriter.WriteLocaleFiles();
  } catch (error) {
    console.error(error);
  }
};

main();
