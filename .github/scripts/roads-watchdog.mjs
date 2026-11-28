/* r91 road-job watchdog (owner 28 Nov: "the road job hadnt started the whole of last week ... make sure this works once
   and for all"). Runs with the 6-hourly upload workflow. The road job restarts itself after every run; if that chain ever
   breaks (a run that never started, a cancelled run), this starts it again - only while a roads- release (unfinished
   work) exists, never while a run is queued or running, never within an hour of the last run, and not after two failed
   runs in a row (a job that fails twice needs a fix, not a third start). It changes no file. */
import { execFileSync } from 'node:child_process';
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
export function decide(tags, runs, now = Date.now()) {
  if (!tags.some(t => /^roads-/.test(t))) return { start: false, why: 'no unfinished road job (no roads- release)' };
  if (runs.some(r => r.status !== 'completed')) return { start: false, why: 'a road-job run is queued or running' };
  const last = runs[0];
  if (last && now - Date.parse(last.updatedAt || last.createdAt) < 3600e3) return { start: false, why: 'last run ended less than an hour ago' };
  if (runs.length >= 2 && runs[0].conclusion === 'failure' && runs[1].conclusion === 'failure') return { start: false, why: 'the last two runs failed - left for a fix' };
  return { start: true, why: last ? 'unfinished work and no run since ' + (last.updatedAt || last.createdAt) : 'unfinished work and no run yet' };
}
export function watch() {
  try {
    const tags = JSON.parse(gh('release', 'list', '-L', '30', '--json', 'tagName')).map(x => x.tagName);
    const runs = JSON.parse(gh('run', 'list', '-w', 'cs-roads.yml', '-L', '5', '--json', 'status,conclusion,createdAt,updatedAt'));
    const d = decide(tags, runs);
    if (d.start) gh('workflow', 'run', 'cs-roads.yml');
    console.log('road-job watchdog:', d.start ? 'started the road job -' : 'nothing to do -', d.why); return d;
  } catch (e) { console.log('road-job watchdog skipped:', String(e && e.message || e).slice(0, 160)); return null; }
}
if (import.meta.url === 'file://' + process.argv[1]) watch();
