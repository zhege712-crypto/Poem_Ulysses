import '../writing-info.js';
import '../writing-form.js';
// Embed the exact same browser code in nonce-protected Worker pages without
// external scripts, build tooling, or user data in generated HTML.
export const WRITING_SCRIPT = 'globalThis.PoemWriting=(' + globalThis.PoemWritingFactory.toString() + ')();globalThis.PoemWritingForm=' + globalThis.PoemWritingForm.toString() + ';';
