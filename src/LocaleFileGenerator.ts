import * as dotenv from "dotenv";
// Load environment variables from .env file
dotenv.config();

import { OpenAI } from "openai";
import { Locale } from "./locales";

export type LocaleFileGeneratorConfig = {
  readonly apiKey: string;
};

/**
 * wrapper for the open ai client that can be configured to generate locale files from a single source file
 */
export class LocaleFileGenerator {
  /**
   * open ai client
   */
  private client: OpenAI;

  /**
   *
   * @param {OpenAI} client used to generate translations
   * @param {LocaleFileGeneratorConfig} configuration used to configure project
   */
  constructor(client: OpenAI, { apiKey }: LocaleFileGeneratorConfig) {
    this.client = client;
    this.client.apiKey = apiKey;
  }

  /**
   * @returns a promise that may resolve to a json string of translations or null
   */
  public async GetLocaleTranslationsAsJSON(
    source: object,
    default_locale: string,
    locales: Locale[]
  ) {
    const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "system",
      content: `You are a translator specialized in creating locale files for web projects.  You will translate a locale file that I provide into the following languages: ${locales.join(
        ","
      )}`,
    };

    const userMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "user",
      content: `Please return a JSON object where each key is a locale I've provided. The value each key should hold is the translations in that language.  The source locale is ${default_locale}. Here is a JSON object of the the source locale file for my translations: ${JSON.stringify(
        source
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
        throw Error("The translation failed to generate content.");
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
