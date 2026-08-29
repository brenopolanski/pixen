/**
 * On-disk format version for `.pix` files. Bump it whenever the shape changes
 * in a way an older Pixen could not read, so those builds refuse the file
 * instead of misreading it.
 */
export const PROJECT_FORMAT_VERSION = 1

/** Keep in sync with PROJECT_EXTENSION in src-tauri/src/project.rs */
export const PROJECT_EXTENSION = 'pix'

export interface PixenProject {
  version: number
  /** Display name, derived from the file the project came from. */
  name: string
  /**
   * The image exactly as it was first opened, kept untouched. V1 cannot
   * re-derive edits from it, but storing it means a later format version can.
   */
  source: string
  /** Flattened result of the last save. This is what the editor reloads. */
  image: string
  createdAt: string
  updatedAt: string
}

/** A project together with its location. `path` is null until the first save. */
export interface ProjectFile {
  path: string | null
  project: PixenProject
}

/** A project parked in the app data folder so a crash cannot lose the work. */
export interface RecoverySnapshot extends ProjectFile {
  savedAt: string
}
