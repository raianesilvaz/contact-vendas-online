import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import './validate-artifact.mjs';

// Static files and the Worker are already source artifacts; never rewrite them.
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync(new URL('../public/deployment-version.json', import.meta.url),
  JSON.stringify({ commit, builtAt: new Date().toISOString() }) + '\n');
console.log(`Build ready: ${commit}`);
