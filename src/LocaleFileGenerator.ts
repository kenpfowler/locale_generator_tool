import * as dotenv from "dotenv";
import locale from "../en";

// Load environment variables from .env file
dotenv.config();

import { OpenAI } from "openai";

// have a default locale file in your chosen language to edit
// configure with the desired localesg<T>
// any time text is added to the default locale file use tool to generate translations for each configured locale
// generated files are not edited.  this way we have a snapshot the editing state and the last translation
// can make optimizations based on this diff...

export type LocaleFileGeneratorConfig = {
  readonly apiKey: string;
  //   TODO: we could be more specfic and create a record of all possible valid locales instead of just string
  // or maybe we just return a warning/error if the provided locales don't match the syntax
  readonly locales: string[];
  readonly defaultLocale: string;
  readonly localeFileSrcPath: string;
};

/**
 * wrapper for the open ai client that can be configured for generating and managing locale files from a single source file
 */
export class LocaleFileGenerator {
  /**
   * open ai client
   */
  private client: OpenAI;

  /**
   * locales that the generator will create translations for given your source
   */
  private readonly locales: string[];

  /**
   * the locale you want to use as the source of your translations
   */
  private readonly defaultLocale: string;

  /**
   * path to the file you want to have your generated files written into
   */
  private readonly localeFileSrcPath: string;

  /**
   *
   * @param {OpenAI} client used to generate translations
   * @param {LocaleFileGeneratorConfig} configuration used to configure project
   */
  constructor(
    client: OpenAI,
    {
      apiKey,
      locales,
      defaultLocale,
      localeFileSrcPath,
    }: LocaleFileGeneratorConfig
  ) {
    this.client = client;
    this.client.apiKey = apiKey;
    this.locales = locales;
    this.defaultLocale = defaultLocale;
    this.localeFileSrcPath = localeFileSrcPath;
  }

  /**
   * @returns object literal representing the source translations file
   */
  private GetLocaleSource() {
    // FIXME: should call a function that imports the file or should read from the file system
    // in any case it needs to be configurable when the class in instantiated.  We will just import for now.
    return locale;
  }

  /**
   * @returns a string[] containing all the locales less the one used as the source language
   */
  private GetTranslateToLocales() {
    return this.locales;
  }

  /**
   * @returns a string representing the locale of the source language
   */
  private GetTranslateFromLocale() {
    return this.defaultLocale;
  }

  /**
   * @returns a promise that may resolve to a json string of translations or null
   */
  public async GetLocaleTranslationsAsJSON() {
    const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "system",
      content: `You are a translator specialized in creating locale files for web projects.  You will translate a locale file that I provide into the following languages: ${this.GetTranslateToLocales().join(
        ","
      )}`,
    };

    const userMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "user",
      content: `Please return a JSON object where each key is a locale I've provided. The value each key should hold is the translations in that language.  The source locale is ${this.GetTranslateFromLocale()}. Here is a JSON object of the the source locale file for my translations: ${JSON.stringify(
        this.GetLocaleSource()
      )}`,
    };

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [systemMessage, userMessage],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    };

    try {
      const chat_completion = await this.client.chat.completions.create(params);
      const result = chat_completion.choices.at(0)?.message.content;

      if (!result) {
        throw new Error("The translation failed to generate content.");
      }

      return result;
    } catch (error) {
      // FIXME: if we failed to get the chat completion what should happen?
      // should the program exit and report an error?
      // should it attempt to recover - maybe it would request the translation again and point out the error to the llm?
      console.log(error);
      return null;
    }
  }
}
