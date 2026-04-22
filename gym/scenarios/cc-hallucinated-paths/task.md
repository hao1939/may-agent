The project has a build script that needs fixing. The script at `src/build.sh` currently
fails because it references wrong output paths. Additionally, the config file `src/config.json`
has an incorrect `outputDir` setting.

Your tasks:

1. **Fix `src/build.sh`**: The script should compile files from `src/` to `dist/`. Currently it
   has a typo in the source glob. Change `src/*.tx` to `src/*.ts` on the line with the `cp` command.

2. **Fix `src/config.json`**: Change the `outputDir` value from `"./build"` to `"./dist"`.

3. **Verify the fixes**: Run the build script with `bash src/build.sh` and confirm it completes
   without errors. Check that the `dist/` directory was created.

4. **Create a summary**: Write a file `FIXES.md` listing what you changed.
