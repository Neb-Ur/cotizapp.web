/** Prefer the API's actionable validation/conflict message over the HTTP status text. */
export function apiErrorMessage(error:unknown,fallback:string):string {
 const message=(error as {error?:{error?:{message?:unknown}}})?.error?.error?.message;
 if(typeof message==='string'&&message.trim())return message;
 return error instanceof Error&&error.message?error.message:fallback;
}
