"use server";

import { getSubject as getSubjectQuery } from "./queries";
import {
  createSubject as createSubjectMutation,
  updateSubject as updateSubjectMutation,
  deleteSubject as deleteSubjectMutation,
} from "./mutations";

export async function getSubject(id: string) {
  return getSubjectQuery(id);
}

export async function createSubject(folderId: string, formData: FormData) {
  return createSubjectMutation(folderId, formData);
}

export async function updateSubject(id: string, formData: FormData) {
  return updateSubjectMutation(id, formData);
}

export async function deleteSubject(id: string) {
  return deleteSubjectMutation(id);
}
