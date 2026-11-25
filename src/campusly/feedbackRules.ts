export function feedbackError(form: { module: string; rating?: number; message: string }) {
  if (!String(form.message || "").trim()) return "Please enter your comments.";
  if (!form.module) return "Please select a module.";
  if (
    !Number.isInteger(Number(form.rating)) ||
    Number(form.rating) < 1 ||
    Number(form.rating) > 5
  ) {
    return "Please choose a rating from 1 to 5.";
  }
  return "";
}
