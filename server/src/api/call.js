import { run } from '../core.js';
import { HttpError } from '../http.js';

/* the core's user-facing rule messages, mapped to the HTTP status that fits them; anything else is 400 */
const STATUS = [
  [/^Please sign in first\.$/, 401],
  [/^Only (staff|an admin) can do this\.$|^You can only open your own profile\.$/, 403],
  [/not found\.?$/i, 404]
];

/* runs a core function for the signed-in user and returns a plain copy of the result.
   The copy is made inside the queue, before the next request can change the records. */
export async function call(req, fn) {
  try {
    return await run(req.user ? req.user.id : null, async (G) => {
      const out = await fn(G);
      return out === undefined ? null : JSON.parse(JSON.stringify(out));
    });
  } catch (err) {
    if (err && err.name === 'AppError') {
      const hit = STATUS.find(([re]) => re.test(err.message));
      throw new HttpError(hit ? hit[1] : 400, err.message);
    }
    throw err;
  }
}
