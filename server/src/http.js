/* an error whose message is safe to show to the user (the error handler sends it as { error }) */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

/* the GYM core throws AppError for rule violations ("Only staff can do this.", "Member not found." ...):
   those messages are written for users, so they become 400s */
export function fromCoreError(err) {
  if (err && err.name === 'AppError') return new HttpError(400, err.message);
  return err;
}
