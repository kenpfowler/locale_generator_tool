import * as fs from "fs";
import * as path from "path";
import { Diff, diff } from "deep-diff";
import { LocaleFileGenerator } from "./LocaleFileGenerator";
import { LocaleFileValidator } from "./LocaleFileValidator";
import { LocaleFileWriter } from "./LocaleFileWriter";
import {
  getMasterSchema,
  RecordWithUnknownValue,
  CreateKeyValue,
} from "./helper";
import { Locale } from "./locales";
import z, { object } from "zod";

/**
 * kind - indicates the kind of change; will be one of the following:
 *
 * N - indicates a newly added property/element
 *
 * D - indicates a property/element was deleted
 *
 * E - indicates a property/element was edited
 *
 * A - indicates a change occurred within an array
 *
 * https://www.npmjs.com/package/deep-diff
 */
enum Difference {
  New = "N",
  Deleted = "D",
  Edited = "E",
  InArray = "A",
}

const ConfigSchema = z.object({
  locales: z.array(z.nativeEnum(Locale)),
  locales_path: z.string(),
  source_path: z.string(),
  source_locale: z.nativeEnum(Locale),
});

type Config = z.infer<typeof ConfigSchema>;

export function readConfig(filePath: string) {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const config = JSON.parse(fileContent);

  const result = ConfigSchema.safeParse(config);

  if (!result.success) {
    console.error("Invalid configuration:", result.error.errors);
    throw new Error("Invalid configuration file");
  }

  return result.data;
}

export type LocaleFileManagerConfig = {
  generator: LocaleFileGenerator;
  validator: LocaleFileValidator;
  writer: LocaleFileWriter;
} & Config;

/**
 * manages changes to the generated files in the locales folder
 */
export class LocaleFileManager {
  private readonly cache: RecordWithUnknownValue | null = null;
  private readonly previous_locales: string[];
  private readonly source_path: string;
  private readonly source_locale: Locale;
  private readonly source: RecordWithUnknownValue | null = null;
  private readonly previous_locales_path: string;
  private readonly current_locales: Locale[];
  private readonly generator: LocaleFileGenerator;
  private readonly validator: LocaleFileValidator;
  private readonly writer: LocaleFileWriter;

  constructor({
    source_path,
    source_locale,
    locales_path,
    locales,
    generator,
    writer,
    validator,
  }: LocaleFileManagerConfig) {
    this.generator = generator;
    this.validator = validator;
    this.writer = writer;
    this.source_path = source_path;
    this.source_locale = source_locale;
    this.previous_locales_path = locales_path;
    this.current_locales = locales;
    this.previous_locales = this.GetPreviousLocales();
    this.EnsureLocalesFolderExists();
  }

  private JoinLocalesPath() {
    return path.join(process.cwd(), this.previous_locales_path);
  }

  private EnsureLocalesFolderExists(): void {
    if (!fs.existsSync(this.JoinLocalesPath())) {
      fs.mkdirSync(this.JoinLocalesPath(), { recursive: true });
    }
  }

  private readJSONFile(filePath: string) {
    const file = this.validator.parseJSON(fs.readFileSync(filePath, "utf8"));
    return file;
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  private GetPreviousLocales() {
    if (this.previous_locales) {
      return this.previous_locales;
    }

    const locales = fs.readdirSync(this.previous_locales_path);
    return locales;
  }

  private async GenerateAllLocaleFiles(
    locales?: Locale[],
    source?: RecordWithUnknownValue
  ) {
    const masterSchema = getMasterSchema(
      locales ? locales : this.current_locales,
      source ? source : this.GetSource()
    );

    const result = await this.generator.GetLocaleTranslationsAsJSON(
      source ? source : this.GetSource(),
      this.source_locale,
      locales ? locales : this.current_locales
    );

    const validated = this.validator.ValidateLocaleTranslation<
      z.infer<typeof masterSchema>
    >(result, masterSchema);

    return validated;
  }

  private GetSourceAndLocaleDiff() {
    const changes = diff(
      this.readJSONFile(path.join(this.previous_locales_path, "en.json")),
      this.GetSource()
    );

    return changes;
  }

  private IsLocalesEmpty() {
    return !fs.readdirSync(this.previous_locales_path).length;
  }

  private GetSource() {
    if (this.validator.isObject(this.source)) {
      return this.source as RecordWithUnknownValue;
    }

    return this.readJSONFile(
      path.join(process.cwd(), this.source_path)
    ) as RecordWithUnknownValue;
  }

  private GetLocaleFromLocales(fileName: string) {
    return this.readJSONFile(path.join(this.previous_locales_path, fileName));
  }

  private LocalesArrayDifference(
    locales: Locale[],
    file_system_locales: Locale[]
  ) {
    const locales_set = new Set(locales);
    const file_system_locales_set = new Set(file_system_locales);

    const diff1 = Array.from(locales_set).filter(
      (locale) => !file_system_locales_set.has(locale)
    );

    const diff2 = Array.from(file_system_locales_set).filter(
      (locale) => !locales_set.has(locale)
    );

    return diff1.concat(diff2);
  }

  /**
   *
   * @returns an array of locales that are different from the value in the config, if any
   */
  private GetLocaleChanges() {
    const diffs = this.LocalesArrayDifference(
      this.current_locales,
      this.GetPreviousLocales()
        .map((locale) => locale.split(".")[0])
        .filter((locale) => typeof locale !== "undefined") as Locale[]
    );

    return diffs;
  }

  private IsLocalesChanged(diffs: Locale[]) {
    return !!diffs.length;
  }

  private GetLocalesToAddRemoveFromDiff(diffs: Locale[]) {
    const user_locales = new Set(this.current_locales);
    const batch: { add: Locale[]; remove: string[] } = { add: [], remove: [] };

    diffs.forEach((diff) => {
      if (user_locales.has(diff)) {
        batch.add.push(diff);
      } else {
        batch.remove.push(path.join(this.JoinLocalesPath(), `${diff}.json`));
      }
    });

    return batch;
  }

  private async AddRemoveLocales(batch: { add: Locale[]; remove: string[] }) {
    function removeLocaleFileGeneration(filePath: string) {
      fs.unlinkSync(filePath);
    }

    if (batch.add.length) {
      await this.GenerateAllLocaleFiles(batch.add);
    }

    if (batch.remove.length) {
      batch.remove.forEach(removeLocaleFileGeneration);
    }
  }

  /**
   * determines how the locale files folder contents needs to be modified based on the users configuration
   */
  public async ManageLocales(): Promise<void> {
    // 1. there is a source file and no generations
    // action: manager should generate all locale files and all of their key - values
    if (this.IsLocalesEmpty()) {
      const result = await this.GenerateAllLocaleFiles();
      this.writer.WriteLocaleFiles(result, this.previous_locales_path);

      console.log("Generated all locale files.");
      process.exit(0);
    }

    // 2. a locale is added and/or removed.
    // action: manager should generate the added locale and/or remove a deleted locale
    const diff = this.GetLocaleChanges();
    const batch = this.GetLocalesToAddRemoveFromDiff(diff);

    if (this.IsLocalesChanged(diff)) {
      await this.AddRemoveLocales(batch);
    }

    // 3. it's possible that locales was not changed, but that the source file was changed.
    // OR locales was changed and the source file was changed
    // what changes could the user make...
    // (add a property to the source, remove a property from the source, change the value for one of the sources keys. change the name of one of the source keys)
    const changes = this.GetSourceAndLocaleDiff();

    // NOTE: for the locales that were just generated we have the latest changes so we don't need to compare the objects
    // currently we just look in the locales folder for all the files
    // if something was removed from the locales folder this wont be compared so thats fine
    // if something was just added it would be compared though it does not need to be.
    // lets provide the locales less any just generated locales as an arg

    if (!changes) {
      console.log(
        "Source file is identical to locales. Make changes before generating new files."
      );
      process.exit(0);
    }

    const editable = {};

    const locales_to_update = this.GetPreviousLocales();

    locales_to_update.forEach((locale) => {
      const object = this.GetLocaleFromLocales(locale);
      // @ts-ignore
      editable[locale.split(".")[0] as string] = object;
    });

    const value = changes.reduce((accumulator, currentValue) => {
      if (currentValue.kind === "N" || currentValue.kind === "E") {
        return {
          ...accumulator,
          ...CreateKeyValue(currentValue.path as string[], currentValue.rhs),
        };
      } else {
        // FIXME:
        // can we add deleted keys too an array while we reduce?
      }

      return accumulator;
    }, {});

    const result = await this.GenerateAllLocaleFiles(
      locales_to_update.map(
        (filePath) => filePath.split(".")[0] as string
      ) as Locale[],
      value
    );

    // TODO:
    // currently we can merge new properties and edited properties
    // but we cannot delete removed properties
    for (const key in editable) {
      if (Object.prototype.hasOwnProperty.call(editable, key)) {
        //@ts-ignore
        editable[key] = { ...editable[key], ...result[key] };
      }
    }

    this.writer.WriteLocaleFiles(editable, this.previous_locales_path);
  }
}
