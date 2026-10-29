import type { Night } from '../digest/types.js';
import { sortByJob } from '../digest/sort.js';

const dash = '—';

export function DigestPage({ night }: { night: Extract<Night, { kind: 'found' }> }) {
  const rows = sortByJob(night.rows);
  return (
    <>
      <h1>digest · {night.night}</h1>
      <p class="mute">{night.badLines} lines did not parse</p>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>fails</th>
              <th>last</th><th>error</th><th>first</th><th>last at</th><th>flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const flags = [r.retries >= 3 ? 'retries' : '', r.fails > 0 ? 'fail' : ''].filter(Boolean);
              return (
                <tr class={flags.length > 0 ? 'warn' : ''}>
                  <td>{r.job}</td>
                  <td>{r.owner || dash}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>{r.fails}</td>
                  <td>{r.lastStatus}</td>
                  <td>{r.lastError || dash}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                  <td>{flags.join(' + ') || dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
