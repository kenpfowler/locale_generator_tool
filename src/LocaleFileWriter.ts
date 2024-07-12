import * as fs from "fs";
import * as path from "path";

type LocaleFileWriterConfig<T extends object> = {
  localeObjects: T;
  folderPath: string;
};

/**
 * writes locale files to your file systems desired locales folder
 */
export class LocaleFileWriter<T extends object> {
  private localeObjects;
  private filePath;

  constructor({
    localeObjects,
    folderPath: filePath,
  }: LocaleFileWriterConfig<T>) {
    this.localeObjects = localeObjects;
    this.filePath = filePath;
    this.EnsureFolderExists();
  }

  private EnsureFolderExists(): void {
    if (!fs.existsSync(this.filePath)) {
      fs.mkdirSync(this.filePath, { recursive: true });
    }
  }

  public WriteLocaleFiles() {
    for (const key in this.localeObjects) {
      if (Object.prototype.hasOwnProperty.call(this.localeObjects, key)) {
        const locale = this.localeObjects[key];
        const filePath = path.join(this.filePath, `${key}.json`);
        const jsonData = JSON.stringify(locale, null, 2);
        fs.writeFileSync(filePath, jsonData, "utf-8");
      }
    }
  }
}
