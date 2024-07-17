import * as fs from "fs";
import * as path from "path";
import { Diff, diff } from "deep-diff";
import { LocaleFileGenerator } from "./LocaleFileGenerator";
import { LocaleFileValidator } from "./LocaleFileValidator";
import { LocaleFileWriter } from "./LocaleFileWriter";
import { getMasterSchema, RecordWithUnknownValue } from "./helper";
import { Locale } from "./locales";
import z from "zod";

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
  private readonly source_path: string;
  private readonly source_locale: Locale;
  private readonly source: RecordWithUnknownValue | null = null;
  private readonly locales_path: string;
  private readonly locales: Array<Locale>;
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
    this.locales_path = locales_path;
    this.locales = locales;
    this.EnsureLocalesFolderExists();
  }

  private JoinLocalesPath() {
    return path.join(process.cwd(), this.locales_path);
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

  private async GenerateAllLocaleFiles(locales?: Locale[]): Promise<void> {
    const source = this.getSource();

    const masterSchema = getMasterSchema(
      locales ? locales : this.locales,
      source
    );

    const result = await this.generator.GetLocaleTranslationsAsJSON(
      source,
      this.source_locale,
      locales ? locales : this.locales
    );

    const validated = this.validator.ValidateLocaleTranslation<
      z.infer<typeof masterSchema>
    >(result, masterSchema);

    this.writer.WriteLocaleFiles(validated, this.locales_path);
  }

  private getSourceAndLocaleDiff(sourceData: object) {
    const locales = fs.readdirSync(this.locales_path);
    const isNotIdentical: Diff<object, object>[][] = [];

    // FIXME: should check each locale file in the locales folder to determine if
    for (const locale of locales) {
      const localeFilePath = path.join(this.JoinLocalesPath(), locale);

      if (!this.fileExists(localeFilePath)) {
        // TODO: what should this code block do.  SHould it even exist?
      }

      const localeData = this.readJSONFile(localeFilePath);

      // we cant just stringify and compare.  we need to compare the keys of each locale file to the source file.
      const differences = diff(localeData, sourceData);

      if (Array.isArray(differences)) {
        if (differences.length) {
          isNotIdentical.push(differences);
        }
      }
    }

    return isNotIdentical;
  }

  private IsLocalesEmpty() {
    return !fs.readdirSync(this.locales_path).length;
  }

  private getSource() {
    if (this.validator.isObject(this.source)) {
      return this.source as RecordWithUnknownValue;
    }

    return this.readJSONFile(
      path.join(process.cwd(), this.source_path)
    ) as RecordWithUnknownValue;
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

  private GetLocaleChanges() {
    const locales = fs.readdirSync(this.locales_path);

    const diffs = this.LocalesArrayDifference(
      this.locales,
      locales
        .map((locale) => locale.split(".")[0])
        .filter((locale) => typeof locale !== "undefined") as Locale[]
    );

    return diffs;
  }

  private IsLocalesChanged(diffs: Locale[]) {
    return !!diffs.length;
  }

  private IsSourceChanged(changes: Diff<object, object>[][]) {
    return !!changes.length;
  }

  private async AddRemoveLocales(diffs: Locale[]) {
    const user_locales = new Set(this.locales);

    function removeLocaleFileGeneration(filePath: string) {
      fs.unlinkSync(filePath);
    }

    const batch: Locale[] = [];

    diffs.forEach((diff) => {
      if (user_locales.has(diff)) {
        // add or
        batch.push(diff);
        // batch add
      } else {
        // remove
        removeLocaleFileGeneration(
          path.join(this.JoinLocalesPath(), `${diff}.json`)
        );
      }
    });

    if (batch.length) {
      await this.GenerateAllLocaleFiles(batch);
    }
  }

  /**
   * determines how the locale files folder contents needs to be modified based on the users configuration
   */
  public async ManageLocales(): Promise<void> {
    const source = this.getSource();
    // 1. there is a source file and no generations
    // action: manager should generate all locale files and all of their key - values
    if (this.IsLocalesEmpty()) {
      await this.GenerateAllLocaleFiles();
      console.log("Generated all locale files.");
      process.exit(0);
    }

    // 2. a locale is added and/or removed.
    // action: manager should generate the added locale and/or remove a deleted locale
    const diff = this.GetLocaleChanges();

    if (this.IsLocalesChanged(diff)) {
      await this.AddRemoveLocales(diff);
    }

    // 3. it's possible that locales was not changed, but that the source file was changed.
    // OR locales was changed and the source file was changed
    // what changes could the user make...
    // (add a property to the source, remove a property from the source, change the value for one of the sources keys. change the name of one of the source keys)
    const changes = this.getSourceAndLocaleDiff(source);

    // NOTE: for the locales that were just generated we have the latest changes so we don't need to compare the objects
    if (!this.IsSourceChanged(changes)) {
      console.log(
        "Source file is identical to locales. Make changes before generating new files."
      );
      process.exit(0);
    }

    changes.forEach((change, index) => {
      console.log(`change# ${index}`, change);
    });

    // 4. a property is added and/or removed from the source file
    // action: manager should add and/or remove properties from all generated files.
    // 5. a key is changed in the source file
    // action: manager should change key is the generated files
    // 6. a value is changed in the source file
    // action: manager should change generate new values for the generated file under that key
  }
}
