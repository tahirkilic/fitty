import { emptyData, validateData } from "../domain/model.js";
export class LocalRepository {
  /** @param {Storage} storage */
  constructor(storage, key = "fitty.fitness.v1") {
    this.storage = storage;
    this.key = key;
    this.revision = null;
  }
  load() {
    const raw = this.storage.getItem(this.key);
    this.revision = raw;
    if (!raw) return emptyData();
    const envelope = JSON.parse(raw);
    if (envelope.schemaVersion !== 1)
      throw new Error("Unsupported stored schema. Your data has been kept.");
    return validateData(envelope.data);
  }
  save(data) {
    validateData(data);
    const current = this.storage.getItem(this.key);
    if (current !== this.revision)
      throw new Error(
        "Data changed in another window. Reload before continuing.",
      );
    const raw = JSON.stringify({ schemaVersion: 1, data });
    try {
      this.storage.setItem(this.key, raw);
    } catch {
      throw new Error(
        "Could not save. Storage may be full or unavailable. Export a backup and free device space.",
      );
    }
    this.revision = raw;
  }
}
/** @param {import('../types.js').Data} data */
export function encodeBackup(data, now) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      appVersion: "0.1.0",
      units: "kg",
      exportedAt: now,
      data: validateData(data),
    },
    null,
    2,
  );
}
export function decodeBackup(text) {
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    envelope.schemaVersion !== 1 ||
    envelope.units !== "kg" ||
    !Number.isFinite(Date.parse(envelope.exportedAt))
  )
    throw new Error("Unsupported backup version or units.");
  return validateData(envelope.data);
}
