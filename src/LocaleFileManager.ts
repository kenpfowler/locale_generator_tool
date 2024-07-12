/**
 * manages changes to the generated files in the locales folder
 */
export class LocaleFileManager {
  // the source file is the latest version
  // the diff between the source file and the generated locales determines what needs to be written
  // scenarios
  // 1. there is a source file and no generations
  // action: manager should generate all locale files and all of their properties
  // 2. there is a source file and all generations exist. source file is identical to copy of source in locales folder.
  // action: manager should not create a new generation
  // manager should inform the user to make a change before trying to generate new files
  // (add a locale, add a property to the source, remove a property from the source, change the value for one of the sources keys. change the name of one of the source keys)
  // 3. a new locale is added. there are no other changes.
  // action: manager should generate a locale only for the new locale
  // 4. a property is added and/or removed from the source file
  // action: manager should add and/or remove this property from all sources
  // 5. a key is changed in the source file
  // action: manager should change key is the generated files
  // 5. a value is changed
}
