/**
 * Runs a Gradle wrapper on any system: `tsx tools/gradlew.ts <project dir> <tasks...>`.
 * Windows needs gradlew.bat through the shell; everything else runs ./gradlew directly.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [dir, ...tasks] = process.argv.slice(2);
if (!dir || tasks.length === 0 || tasks.some((task) => !/^[\w:-]+$/.test(task))) {
  console.error('usage: tsx tools/gradlew.ts <project dir> <task...>');
  process.exit(2);
}
const cwd = resolve(dir);
const windows = process.platform === 'win32';
if (!existsSync(resolve(cwd, windows ? 'gradlew.bat' : 'gradlew'))) {
  console.error(`No Gradle wrapper in ${cwd}. Run npm run android:sync first.`);
  process.exit(2);
}
const result = spawnSync(windows ? 'gradlew.bat' : './gradlew', [...tasks, '--console=plain'], { cwd, stdio: 'inherit', shell: windows });
process.exit(result.status ?? 1);
