import * as fs from "fs";
import * as path from "path";

/**
 * writes locale files to your file systems desired locales folder
 */
export class LocaleFileWriter {
  private GetFilePath(locales_path: string, key: string) {
    return path.join(locales_path, `${key}.json`);
  }

  private HasKey<T>(locale_objects: T, key: string) {
    return Object.prototype.hasOwnProperty.call(locale_objects, key);
  }

  private writeJSONFile<T>(filePath: string, locale: T): void {
    const jsonData = JSON.stringify(locale, null, 2);
    fs.writeFileSync(filePath, jsonData, "utf-8");
  }

  public WriteLocaleFiles<T extends object>(
    locale_objects: T,
    locales_path: string
  ) {
    for (const key in locale_objects) {
      if (this.HasKey(locale_objects, key)) {
        const locale = locale_objects[key];
        const filePath = this.GetFilePath(locales_path, key);
        this.writeJSONFile(filePath, locale);
      }
    }
  }
}
