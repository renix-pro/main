export {
  ObjectStorageService,
  ObjectNotFoundError,
  StorageUnavailableError,
  objectStorageClient,
  isLocalStorageMode,
  LOCAL_UPLOAD_PREFIX,
} from "./objectStorage";

export type {
  ObjectAclPolicy,
  ObjectAccessGroup,
  ObjectAccessGroupType,
  ObjectAclRule,
} from "./objectAcl";

export {
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export { registerObjectStorageRoutes } from "./routes";

