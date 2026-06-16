"use server";

import { getFolders as getFoldersQuery, getFolder as getFolderQuery } from "./queries";
import {
  createFolder as createFolderMutation,
  updateFolder as updateFolderMutation,
  deleteFolder as deleteFolderMutation,
} from "./mutations";

export async function getFolders() {
  return getFoldersQuery();
}

export async function getFolder(id: string) {
  return getFolderQuery(id);
}

export async function createFolder(formData: FormData) {
  return createFolderMutation(formData);
}

export async function updateFolder(id: string, formData: FormData) {
  return updateFolderMutation(id, formData);
}

export async function deleteFolder(id: string) {
  return deleteFolderMutation(id);
}
