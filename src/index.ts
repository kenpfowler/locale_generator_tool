import OpenAI from "openai";
import { LocaleFileGenerator } from "./LocaleFileGenerator";
import { LocaleFileValidator } from "./LocaleFileValidator";
import { LocaleFileWriter } from "./LocaleFileWriter";
import { Locale } from "./locales";

// user supplied variables
import rawLocales from "../locales";
import { LocaleFileManager } from "./LocaleFileManager";

// task generate schema from source file

// what is the minimal amount of input that needs to come from the user?
// 1. path to source locale file
// 2. required translate-to locales
// 3. path to destination of generated locale files (even this could be optional if we default from the root of this program.)

const main = async () => {
  try {
    // these values can only be known at runtime since they are provided by the user.
    // therefore we need validate the existance of our keys in the code and end the program if they are not as expected in order to continue with type safety

    const locales = rawLocales.map((locale) => {
      if (locale in Locale) {
        return Locale[locale as keyof typeof Locale];
      } else {
        throw Error("Must supply valid locale");
      }
    });

    const generator = new LocaleFileGenerator(new OpenAI(), {
      apiKey: process.env.OPENAI_API_KEY ?? "",
    });

    const validator = new LocaleFileValidator();

    const writer = new LocaleFileWriter();

    const manager = new LocaleFileManager({
      source_path: "en.json",
      source_locale: "en",
      locales_path: "locales",
      locales,
      generator,
      validator,
      writer,
    });

    // 1. generate a json compliant string that represents our locale files

    // FIXME: translating even a moderately large source file can cause the program to fail.
    // it takes a long time to generate the translations. generation_time = locales * translation_keys * time_to_translate
    // does the gpt have a max space/threshold in the output where it will quit if the end is not reached?
    // can we break translation requests down into multiple requests if they are large and/or complex?

    // 2. validate that each locale is present and that each key-value pair is present with the proper types

    // 3. write the locale files to the configured output folder
    await manager.ManageLocales();
  } catch (error) {
    console.error(error);
  }
};

main();
