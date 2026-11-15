import { validatePlanFile } from "../domain/plan-transfer.js";
import { APP_VERSION } from "../domain/app-version.js";
export function encodePlan(file) {
  return JSON.stringify(
    { ...validatePlanFile(file), appVersion: APP_VERSION },
    null,
    2,
  );
}
export function decodePlan(text) {
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  return validatePlanFile(input);
}
