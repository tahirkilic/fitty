// No grouping in editable measurements: commas are always decimal separators.
const decimalFormat = new Intl.NumberFormat("de-DE", {
  useGrouping: false,
  maximumSignificantDigits: 21,
});
export function formatNumber(value) {
  return value == null ? "—" : decimalFormat.format(value === 0 ? 0 : value);
}
export function parseNumber(text, integer = false) {
  const value = text.trim();
  // A single dot remains accepted for pasted values and external keyboards.
  // Grouped, mixed-separator and exponential forms are deliberately ambiguous.
  if (!/^(?:\d+(?:[,.]\d*)?|[,.]\d+)$/.test(value))
    throw new Error(
      "Enter a non-negative number, e.g. 40,5, without thousands separators.",
    );
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number) || number > 100000)
    throw new Error("Enter a number from 0 to 100000.");
  if (integer && !Number.isInteger(number))
    throw new Error("Repetitions and rest seconds must be whole numbers.");
  return number;
}
export function formatPrescription(value) {
  if (typeof value === "string") return value;
  return value.sets
    .map((set) =>
      value.kind === "cardio" || value.kind === "isometric"
        ? `${formatNumber(set.durationSeconds)} seconds`
        : `${formatNumber(set.weight)} kg × ${formatNumber(set.reps)}`,
    )
    .join("; ");
}
