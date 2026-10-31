// FILING PUBLIC API (guide §5.1, §14): the only filing import other modules may use.
// Every function that returns a file includes its computed `url`: that `url`
// is the value other modules store. Permission-free: callers apply their own rules.

import "server-only";

export {
  uploadFile,
  requestUpload,
  confirmUpload,
  replaceFile,
  deleteByUrl,
  getAccessUrl,
  getAccessUrls,
  getFileByUrl,
  type UploadTicket,
} from "../file/file.service";
export type { FileDto } from "../file/file.select";
export { hasActiveStorage } from "./storage/registry";
export { isFilingError, FilingError, type FilingCode } from "./errors";
export { ruleFor, normalizeFolder } from "./folder";
